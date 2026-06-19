import { createAdminClient } from '@/lib/supabase/admin';

const TABLE = 'email_suppressions';

/**
 * Why an address is on the suppression list.
 *  - hard_bounce: the mailbox/domain does not exist — sending again is futile
 *    and repeated unknown-user bounces actively damage sender reputation.
 *  - complaint: the recipient marked our mail as spam. We must stop.
 *  - manual: suppressed by an operator (e.g. abuse, request).
 */
export type SuppressionReason = 'hard_bounce' | 'complaint' | 'manual';

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Partitions a recipient list into addresses we may still send to and those on
 * the suppression list. Fails open: if the lookup errors, every address is
 * treated as allowed so a transient DB problem never silently drops mail.
 */
export async function filterSuppressed(emails: string[]): Promise<{
  allowed: string[];
  suppressed: string[];
}> {
  const normalized = Array.from(new Set(emails.map(normalize))).filter(Boolean);
  if (normalized.length === 0) return { allowed: emails, suppressed: [] };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from(TABLE)
    .select('email')
    .in('email', normalized);

  if (error) {
    console.error('[suppression] lookup failed, sending anyway:', error.message);
    return { allowed: emails, suppressed: [] };
  }

  const blocked = new Set((data ?? []).map((r) => r.email as string));
  const allowed: string[] = [];
  const suppressed: string[] = [];
  for (const email of emails) {
    if (blocked.has(normalize(email))) suppressed.push(email);
    else allowed.push(email);
  }
  return { allowed, suppressed };
}

/** True when the single address is currently suppressed. */
export async function isSuppressed(email: string): Promise<boolean> {
  const { suppressed } = await filterSuppressed([email]);
  return suppressed.length > 0;
}

/**
 * Adds (or refreshes) a suppression entry. Idempotent on the address so repeat
 * webhook deliveries are harmless.
 */
export async function suppressEmail(
  email: string,
  reason: SuppressionReason,
  meta?: { providerMessageId?: string | null; detail?: string | null }
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from(TABLE).upsert(
    {
      email: normalize(email),
      reason,
      provider_message_id: meta?.providerMessageId ?? null,
      detail: meta?.detail ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'email' }
  );
  if (error) throw new Error(`suppressEmail failed: ${error.message}`);
}
