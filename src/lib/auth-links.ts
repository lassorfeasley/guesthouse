import 'server-only';
import type { createAdminClient } from '@/lib/supabase/admin';
import { inviteUrl } from '@/lib/invitations';
import { appUrl } from '@/lib/env';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Builds a one-click sign-in link for an invited guest. Clicking it verifies a
 * token_hash via /auth/confirm and drops them on the visit page already
 * authenticated — no password and no second email — for both new and existing
 * accounts. Falls back to the plain (unauthenticated) invite link if anything
 * goes wrong.
 *
 * The token_hash flow is cross-device safe (unlike the PKCE `?code=` flow),
 * because verification doesn't depend on a locally stored code verifier.
 */
export async function buildAuthenticatedInviteUrl(
  admin: AdminClient,
  email: string,
  token: string
): Promise<string> {
  const plain = inviteUrl(token);
  const base = appUrl();
  const next = `/invite/${token}`;
  const normalizedEmail = email.toLowerCase();

  return buildTokenHashLink(admin, normalizedEmail, next, plain);
}

/**
 * Builds a one-click sign-in link that drops a guest onto the host dashboard
 * already authenticated as their existing account, so the home they add there
 * attaches to that account (no duplicate). Used by the discreet "become a host"
 * footer on relationship emails.
 *
 * Falls back to the public signup wizard (/signup) if a sign-in link can't be
 * minted — the wizard still lets them open a home, just without auto-pairing.
 */
export async function buildHostOnboardingUrl(
  admin: AdminClient,
  email: string
): Promise<string> {
  const base = appUrl();
  return buildTokenHashLink(
    admin,
    email.toLowerCase(),
    '/dashboard',
    `${base}/signup`
  );
}

/**
 * Ensures a passwordless account exists for `email`, then mints a single-use
 * Supabase `token_hash` magic-link credential for it. Returns `null` if the
 * account can't be created or the link can't be minted.
 *
 * This is the raw credential behind both the emailed token_hash links and the
 * durable `/invite/{token}/enter` flow, which mints and verifies a hash inside
 * a single server request so it's never exposed in an email.
 */
export async function mintGuestTokenHash(
  admin: AdminClient,
  email: string
): Promise<string | null> {
  const base = appUrl();
  const normalizedEmail = email.toLowerCase();
  try {
    // generateLink({ type: 'magiclink' }) requires the user to already exist,
    // so create a passwordless guest account first if there isn't one.
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!existing) {
      const { error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        email_confirm: true,
      });
      // Ignore "already registered" races; any other failure falls through.
      if (createError && !/registered|exists/i.test(createError.message)) {
        return null;
      }
    }

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
      options: { redirectTo: `${base}/auth/confirm` },
    });

    const tokenHash = data?.properties?.hashed_token;
    if (error || !tokenHash) return null;
    return tokenHash;
  } catch {
    return null;
  }
}

/**
 * Mints a cross-device-safe token_hash magic link that verifies via
 * /auth/confirm and redirects to `next`, creating a passwordless account first
 * if the email is new. Returns `fallback` if anything goes wrong.
 */
async function buildTokenHashLink(
  admin: AdminClient,
  normalizedEmail: string,
  next: string,
  fallback: string
): Promise<string> {
  const tokenHash = await mintGuestTokenHash(admin, normalizedEmail);
  if (!tokenHash) return fallback;

  const url = new URL(`${appUrl()}/auth/confirm`);
  url.searchParams.set('token_hash', tokenHash);
  url.searchParams.set('type', 'magiclink');
  url.searchParams.set('next', next);
  return url.toString();
}
