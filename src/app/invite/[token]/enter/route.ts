import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthUser } from '@/lib/auth';
import { getInvitationByToken, isInvitationActive } from '@/lib/invitations';
import { mintGuestTokenHash } from '@/lib/auth-links';

/**
 * Durable one-click sign-in entry point embedded in invitation emails.
 *
 * The invitation token in the URL is the credential: for an active invitation,
 * we mint a single-use Supabase token_hash and verify it within this same
 * server request to establish the guest's session, then redirect to the invite
 * page. Because the one-time token is created and consumed server-side, the
 * emailed link never carries it — so it can't be burned by email link scanners
 * or expire before the guest clicks, which is why guests previously had to
 * request a fresh magic link.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const { origin } = new URL(request.url);
  const dest = `${origin}/invite/${token}`;

  const invitation = await getInvitationByToken(token);

  // Unknown or inactive invitations just fall through to the invite page, which
  // renders its own not-found / "no longer active" states.
  if (invitation && isInvitationActive(invitation)) {
    // Only establish a session when nobody's signed in, so we never silently
    // hijack a host (or a different guest) who is already authenticated. They
    // land on the invite page, which handles the email-match / sign-in UI.
    const authUser = await getAuthUser();
    if (!authUser) {
      const admin = createAdminClient();
      const tokenHash = await mintGuestTokenHash(admin, invitation.guest_email);
      if (tokenHash) {
        const supabase = await createClient();
        await supabase.auth.verifyOtp({
          type: 'magiclink',
          token_hash: tokenHash,
        });
      }
    }
  }

  return NextResponse.redirect(dest);
}
