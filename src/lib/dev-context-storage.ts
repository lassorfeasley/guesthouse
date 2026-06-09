const INVITE_TOKEN_KEY = 'guesthouse:dev:inviteToken';
const PROPERTY_SLUG_KEY = 'guesthouse:dev:propertySlug';
const DEV_TOOLBAR_OPEN_KEY = 'guesthouse:dev:toolbarOpen';

export function getStoredInviteToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem(INVITE_TOKEN_KEY) ??
    process.env.NEXT_PUBLIC_DEV_INVITE_TOKEN ??
    null
  );
}

export function setStoredInviteToken(token: string) {
  localStorage.setItem(INVITE_TOKEN_KEY, token);
}

export function getStoredPropertySlug(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(PROPERTY_SLUG_KEY);
}

export function setStoredPropertySlug(slug: string) {
  localStorage.setItem(PROPERTY_SLUG_KEY, slug);
}

export function getStoredDevToolbarOpen(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(DEV_TOOLBAR_OPEN_KEY) === 'true';
}

export function setStoredDevToolbarOpen(open: boolean) {
  localStorage.setItem(DEV_TOOLBAR_OPEN_KEY, open ? 'true' : 'false');
}
