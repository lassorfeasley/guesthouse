import { Resend } from 'resend';
import nodemailer, { type Transporter } from 'nodemailer';
import { createAdminClient } from '@/lib/supabase/admin';
import { render } from '@react-email/components';
import { appUrl } from '@/lib/env';
import { filterSuppressed } from '@/lib/email/suppression';

let resend: Resend | null = null;
let smtp: Transporter | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!resend) resend = new Resend(key);
  return resend;
}

/**
 * SMTP transport, used when `SMTP_HOST` is set. In local development this
 * points at Mailpit (default `localhost:1025`) so every outgoing email is
 * captured in the Mailpit inbox (http://localhost:8025) instead of hitting
 * Resend or a real recipient. Takes precedence over Resend when configured.
 */
function getSmtp(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  if (!smtp) {
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    smtp = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === 'true',
      auth: user && pass ? { user, pass } : undefined,
    });
  }
  return smtp;
}

/** The configured sender for every outgoing email. */
export const fromAddress = () =>
  process.env.RESEND_FROM ?? 'Gracious <onboarding@resend.dev>';

/**
 * Personalized sender: keeps the verified sending address but swaps the
 * display name to "{name} via Gracious" (e.g. for invitations, so the inbox
 * row leads with the host). Falls back to the plain sender without a name.
 */
export function fromAddressAs(name?: string | null): string {
  const configured = fromAddress();
  if (!name?.trim()) return configured;
  const email = configured.match(/<([^>]+)>/)?.[1] ?? configured;
  const display = name.replace(/["<>]/g, '').trim();
  return `"${display} via Gracious" <${email}>`;
}

/** A fully-rendered email ready to hand to a transport. */
export type DeliverableEmail = {
  to: string[];
  from: string;
  subject: string;
  html: string;
  /** Plain-text alternative sent alongside the HTML (multipart/alternative). */
  text?: string;
  attachments?: { filename: string; content: Buffer | string }[];
  headers?: Record<string, string>;
  replyTo?: string;
  /**
   * Bypass the suppression list. Reserved for critical, user-initiated mail
   * (auth/magic-link, password reset) that must send even to an address that
   * previously bounced or complained — locking those out would be worse than
   * the deliverability hit. Lifecycle/marketing mail must never set this.
   */
  skipSuppressionCheck?: boolean;
};

/**
 * Hands an already-rendered email to the active transport (SMTP/Mailpit →
 * Resend → console). Shared by the synchronous `sendEmail` path and the outbox
 * drainer, so both behave identically. Throws on provider errors so the caller
 * (or the outbox retry loop) can react.
 *
 * Recipients on the suppression list (hard bounces, spam complaints) are
 * dropped before sending to protect sender reputation; if every recipient is
 * suppressed the send is skipped and reported as a no-op success so the outbox
 * does not retry.
 */
export async function deliverRendered(
  msg: DeliverableEmail
): Promise<{ id: string | null }> {
  let to = msg.to;
  if (!msg.skipSuppressionCheck) {
    const { allowed, suppressed } = await filterSuppressed(msg.to);
    if (suppressed.length > 0) {
      console.warn(
        `[email] skipping ${suppressed.length} suppressed recipient(s): ${suppressed.join(', ')}`
      );
    }
    if (allowed.length === 0) return { id: 'suppressed' };
    to = allowed;
  }

  const smtpClient = getSmtp();
  if (smtpClient) {
    const info = await smtpClient.sendMail({
      from: msg.from,
      to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      attachments: msg.attachments,
      headers: msg.headers,
      replyTo: msg.replyTo,
    });
    return { id: info.messageId };
  }

  const client = getResend();
  if (!client) {
    console.log('[email:dev]', {
      to,
      subject: msg.subject,
      replyTo: msg.replyTo,
      headers: msg.headers,
      html: msg.html.slice(0, 200),
    });
    return { id: 'dev' };
  }

  const { data, error } = await client.emails.send({
    from: msg.from,
    to,
    subject: msg.subject,
    html: msg.html,
    text: msg.text,
    attachments: msg.attachments,
    headers: msg.headers,
    replyTo: msg.replyTo,
  });

  if (error) throw new Error(error.message);
  return { id: data?.id ?? null };
}

/**
 * Renders a React Email template and sends it immediately (synchronously).
 *
 * Use this only for latency-sensitive mail that must not wait on a queue —
 * auth/magic-link emails and the on-demand guest sign-in link. Everything else
 * (booking/invitation/reminder notifications) should go through `enqueueEmail`
 * in `@/lib/email/outbox` so a transient provider failure can be retried.
 */
export async function sendEmail({
  to,
  subject,
  react,
  attachments,
  headers,
  replyTo,
  fromName,
  skipSuppressionCheck = true,
}: {
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
   * Defaults to `true`: this sync path is reserved for critical auth/sign-in
   * mail that must reach the user even if their address was suppressed. Set
   * `false` to honor the suppression list.
   */
  skipSuppressionCheck?: boolean;
}) {
  const [html, text] = await Promise.all([
    render(react),
    render(react, { plainText: true }),
  ]);
  return deliverRendered({
    to: Array.isArray(to) ? to : [to],
    from: fromAddressAs(fromName),
    subject,
    html,
    text,
    attachments,
    headers,
    replyTo,
    skipSuppressionCheck,
  });
}

export async function logNotification({
  userId,
  bookingId,
  invitationId,
  type,
}: {
  userId?: string;
  bookingId?: string;
  invitationId?: string;
  type: string;
}) {
  const admin = createAdminClient();
  await admin.from('notifications_log').insert({
    user_id: userId ?? null,
    booking_id: bookingId ?? null,
    invitation_id: invitationId ?? null,
    type,
  });
}

export async function wasNotificationSent(
  bookingId: string,
  type: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('notifications_log')
    .select('id')
    .eq('booking_id', bookingId)
    .eq('type', type)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export { appUrl };
