import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { mintGuestTokenHash } from '@/lib/auth-links';
import { isDevToolsEnabled } from '@/lib/dev-tools';

/**
 * Dev-only impersonation. Mints a single-use session for any existing account
 * and hands off to /auth/confirm to establish the cookie, so you can see the
 * app exactly as that user does. Returns 404 in production.
 */
export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);

  if (!isDevToolsEnabled()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const email = searchParams.get('email')?.trim().toLowerCase();
  const nextParam = searchParams.get('next') ?? '/';
  const next = nextParam.startsWith('/') ? nextParam : `/${nextParam}`;

  if (!email) {
    return NextResponse.redirect(`${origin}/login?error=impersonate`);
  }

  const admin = createAdminClient();
  const tokenHash = await mintGuestTokenHash(admin, email);
  if (!tokenHash) {
    return NextResponse.redirect(`${origin}/login?error=impersonate`);
  }

  const confirm = new URL(`${origin}/auth/confirm`);
  confirm.searchParams.set('token_hash', tokenHash);
  confirm.searchParams.set('type', 'magiclink');
  confirm.searchParams.set('next', next);
  return NextResponse.redirect(confirm);
}
