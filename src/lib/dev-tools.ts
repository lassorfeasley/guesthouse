export type AppView = 'landing' | 'guest' | 'host' | 'admin';

export function isDevToolsEnabled(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Opt-in admin preview: in development, set DEV_ADMIN_PREVIEW=1 to let any
 * signed-in user open /admin to style the UI. Off by default so local dev
 * enforces the same is_admin / SITE_ADMIN_EMAILS gating as production.
 */
export function isDevAdminPreviewEnabled(): boolean {
  return isDevToolsEnabled() && process.env.DEV_ADMIN_PREVIEW === '1';
}

export function detectAppView(pathname: string): AppView | null {
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/dashboard')) return 'host';
  if (pathname.startsWith('/invite') || pathname === '/my-visits') return 'guest';
  if (pathname === '/') return 'landing';
  return null;
}

export function extractInviteToken(pathname: string): string | null {
  const match = pathname.match(/^\/invite\/([^/]+)/);
  return match?.[1] ?? null;
}

export function extractPropertySlug(pathname: string): string | null {
  const match = pathname.match(/^\/dashboard\/([^/]+)/);
  return match?.[1] ?? null;
}

export function buildGuestDevPath(token: string): string {
  return `/invite/${token}`;
}

export function buildHostDevPath(slug?: string | null): string {
  return slug ? `/dashboard/${slug}/overview` : '/dashboard';
}

export const ADMIN_DEV_PATH = '/admin';

/** Landing page with the dev preview flag so signed-in users skip the redirect. */
export const LANDING_DEV_PATH = '/?preview=1';

/** When true (dev only), the marketing landing page renders even if signed in. */
export function isLandingPreviewEnabled(preview?: string): boolean {
  return isDevToolsEnabled() && preview === '1';
}
