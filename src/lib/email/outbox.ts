import { after } from 'next/server';
import { render } from '@react-email/components';
import { createAdminClient } from '@/lib/supabase/admin';
import { deliverRendered, fromAddressAs } from '@/lib/email/send';

const TABLE = 'email_outbox';
/** Rows handled per claim batch; keeps each delivery pass well under timeouts. */
const BATCH_SIZE = 25;
/** Failures back off 2^attempt minutes, capped here (6h). */
const MAX_BACKOFF_MS = 6 * 60 * 60 * 1000;

type StoredAttachment = { filename: string; content: string };

type OutboxRow = {
  id: string;
  status: string;
  to_addresses: string[];
  from_address: string;
  reply_to: string | null;
  subject: string;
  html: string;
  text: string | null;
  headers: Record<string, string> | null;
  attachments: StoredAttachment[] | null;
  attempts: number;
  max_attempts: number;
};

export type EnqueueEmailOptions = {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  attachments?: { filename: string; content: Buffer | string }[];
  headers?: Record<string, string>;
  /** Where replies should go when it differs from the sender. */
  replyTo?: string;
  /** Personalizes the sender display name: "{fromName} via Gracious". */
  fromName?: string | null;
  /**
   * Optional dedupe key. When set, re-enqueuing with the same key is a no-op,
   * which makes at-least-once callers (e.g. retried requests) safe.
   */
  idempotencyKey?: string;
};

function encodeAttachments(
  attachments: EnqueueEmailOptions['attachments']
): StoredAttachment[] | null {
  if (!attachments?.length) return null;
  return attachments.map((a) => ({
    filename: a.filename,
    content: (Buffer.isBuffer(a.content)
      ? a.content
      : Buffer.from(a.content)
    ).toString('base64'),
  }));
}

/**
 * Durably queues a rendered email for out-of-band delivery, then schedules a
 * best-effort drain via `after()` so it still goes out right after the current
 * request. The per-minute cron is the safety net if that drain is skipped or
 * fails. Renders the template now, so later template/data changes never alter an
 * already-queued message.
 */
export async function enqueueEmail(
  opts: EnqueueEmailOptions
): Promise<{ id: string | null }> {
  const [html, text] = await Promise.all([
    render(opts.react),
    render(opts.react, { plainText: true }),
  ]);
  const admin = createAdminClient();

  const row = {
    to_addresses: Array.isArray(opts.to) ? opts.to : [opts.to],
    from_address: fromAddressAs(opts.fromName),
    reply_to: opts.replyTo ?? null,
    subject: opts.subject,
    html,
    text,
    headers: opts.headers ?? null,
    attachments: encodeAttachments(opts.attachments),
    idempotency_key: opts.idempotencyKey ?? null,
  };

  const { data, error } = opts.idempotencyKey
    ? await admin
        .from(TABLE)
        .upsert(row, { onConflict: 'idempotency_key', ignoreDuplicates: true })
        .select('id')
        .maybeSingle()
    : await admin.from(TABLE).insert(row).select('id').single();

  if (error) throw new Error(`enqueueEmail failed: ${error.message}`);

  scheduleDrain();
  return { id: data?.id ?? null };
}

/** Best-effort post-response drain; no-op outside a request scope. */
function scheduleDrain() {
  try {
    after(async () => {
      try {
        await drainEmailOutbox();
      } catch (err) {
        console.error('[outbox] background drain failed', err);
      }
    });
  } catch {
    // Not in a request context (e.g. a script). The cron will drain instead.
  }
}

export type DrainResult = {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
};

/**
 * Claims a batch of due messages and attempts delivery. Successes are marked
 * `sent`; transient failures are rescheduled with exponential backoff; messages
 * that exhaust `max_attempts` become `failed` (a dead letter for inspection).
 */
export async function drainEmailOutbox(): Promise<DrainResult> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('claim_email_outbox', {
    batch_size: BATCH_SIZE,
  });
  if (error) throw new Error(`claim_email_outbox failed: ${error.message}`);

  const rows = (data ?? []) as OutboxRow[];
  const result: DrainResult = {
    claimed: rows.length,
    sent: 0,
    retried: 0,
    failed: 0,
  };

  for (const row of rows) {
    try {
      const sendResult = await deliverRendered({
        to: row.to_addresses,
        from: row.from_address,
        subject: row.subject,
        html: row.html,
        text: row.text ?? undefined,
        replyTo: row.reply_to ?? undefined,
        headers: row.headers ?? undefined,
        attachments: row.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content, 'base64'),
        })),
      });

      await admin
        .from(TABLE)
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          provider_message_id: sendResult.id,
          last_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      result.sent++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // `attempts` was incremented by claim_email_outbox, so it reflects the try
      // we just made.
      const exhausted = row.attempts >= row.max_attempts;
      const backoffMs = Math.min(2 ** row.attempts * 60_000, MAX_BACKOFF_MS);

      await admin
        .from(TABLE)
        .update({
          status: exhausted ? 'failed' : 'pending',
          last_error: message,
          next_attempt_at: new Date(Date.now() + backoffMs).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      if (exhausted) {
        result.failed++;
        console.error(
          `[outbox] message ${row.id} failed permanently after ${row.attempts} attempts: ${message}`
        );
      } else {
        result.retried++;
      }
    }
  }

  return result;
}
