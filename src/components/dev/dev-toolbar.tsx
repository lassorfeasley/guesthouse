'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import devAccounts from '@/lib/dev-accounts.json';
import {
  type GuestPreviewAs,
  type GuestPreviewBookingStatus,
  isGuestPreviewEnabled,
  parseGuestPreviewAs,
  parseGuestPreviewBookingStatus,
} from '@/lib/guest-preview';
import {
  type AppView,
  ADMIN_DEV_PATH,
  LANDING_DEV_PATH,
  buildGuestDevPath,
  buildHostDevPath,
  detectAppView,
  extractInviteToken,
  extractPropertySlug,
  isDevToolsEnabled,
} from '@/lib/dev-tools';
import {
  getStoredDevToolbarOpen,
  getStoredInviteToken,
  getStoredPropertySlug,
  setStoredDevToolbarOpen,
  setStoredInviteToken,
  setStoredPropertySlug,
} from '@/lib/dev-context-storage';

const APP_VIEWS: { id: AppView; label: string }[] = [
  { id: 'landing', label: 'Landing' },
  { id: 'guest', label: 'Guest' },
  { id: 'host', label: 'Host' },
  { id: 'admin', label: 'Admin' },
];

const GUEST_STATES: { id: GuestPreviewAs; label: string }[] = [
  { id: 'signed-out', label: 'Before sign-in' },
  { id: 'booking', label: 'Booking' },
  { id: 'booked', label: 'Manage stay' },
];

const BOOKING_STATUSES: { id: GuestPreviewBookingStatus; label: string }[] = [
  { id: 'requested', label: 'Requested' },
  { id: 'approved', label: 'Approved' },
];

function SegmentTabs<T extends string>({
  items,
  value,
  getHref,
  ariaLabel,
  activeClassName,
}: {
  items: { id: T; label: string }[];
  value: T;
  getHref: (id: T) => string;
  ariaLabel: string;
  activeClassName?: string;
}) {
  return (
    <div
      className="inline-flex rounded-lg bg-black/20 p-0.5"
      role="tablist"
      aria-label={ariaLabel}
    >
      {items.map(({ id, label }) => (
        <Link
          key={id}
          href={getHref(id)}
          role="tab"
          aria-selected={value === id}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === id
              ? (activeClassName ?? 'bg-white text-zinc-900 shadow-sm')
              : 'text-white/80 hover:text-white'
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

const ROLE_DESTINATIONS: Record<string, string> = {
  owner: '/dashboard',
  admin: '/admin',
  guest: '/my-trips',
};

function DevAuthControls() {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function signInAs(email: string, role: string) {
    setPending(role);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: devAccounts.password,
    });
    setPending(null);
    if (error) {
      toast.error(
        `Sign in failed: ${error.message}. Have you run "npm run db:seed:dev"?`
      );
      return;
    }
    router.push(ROLE_DESTINATIONS[role] ?? '/');
    router.refresh();
  }

  async function signOut() {
    setPending('out');
    const supabase = createClient();
    await supabase.auth.signOut();
    setPending(null);
    router.push('/?preview=1');
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-zinc-700/80 pt-2">
      <span className="text-xs text-zinc-400">Sign in as:</span>
      {devAccounts.accounts.map((acct) => (
        <button
          key={acct.role}
          type="button"
          disabled={pending !== null}
          onClick={() => signInAs(acct.email, acct.role)}
          className="rounded-md bg-black/20 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:text-white disabled:opacity-50"
        >
          {pending === acct.role ? '…' : acct.label}
        </button>
      ))}
      <button
        type="button"
        disabled={pending !== null}
        onClick={signOut}
        className="ml-auto rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:text-white disabled:opacity-50"
      >
        {pending === 'out' ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );
}

export function DevToolbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const currentView = detectAppView(pathname);
  const guestPreview = isGuestPreviewEnabled(searchParams.get('preview') ?? undefined);
  const guestAs = parseGuestPreviewAs(searchParams.get('as') ?? undefined);
  const guestStatus = parseGuestPreviewBookingStatus(
    searchParams.get('status') ?? undefined
  );
  const showGuestSubControls =
    currentView === 'guest' && pathname.startsWith('/invite/') && guestPreview;

  const inviteToken =
    extractInviteToken(pathname) ?? getStoredInviteToken();
  const propertySlug = getStoredPropertySlug();

  const viewHrefs = useMemo(
    () => ({
      landing: LANDING_DEV_PATH,
      guest: inviteToken
        ? buildGuestDevPath(inviteToken, guestAs, guestStatus)
        : '/my-trips',
      host: buildHostDevPath(propertySlug),
      admin: ADMIN_DEV_PATH,
    }),
    [inviteToken, guestAs, guestStatus, propertySlug]
  );

  useEffect(() => {
    const token = extractInviteToken(pathname);
    if (token) setStoredInviteToken(token);
    const slug = extractPropertySlug(pathname);
    if (slug) setStoredPropertySlug(slug);
  }, [pathname]);

  useEffect(() => {
    setMounted(true);
    setOpen(getStoredDevToolbarOpen());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        setStoredDevToolbarOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  function setToolbarOpen(next: boolean) {
    setOpen(next);
    setStoredDevToolbarOpen(next);
  }

  if (!isDevToolsEnabled() || !mounted) return null;

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setToolbarOpen(true)}
          aria-label="Open dev tools"
          className="fixed bottom-6 right-0 z-[100] flex items-center gap-1 rounded-l-lg border border-r-0 border-zinc-700 bg-zinc-900 px-2 py-3 text-xs font-semibold uppercase tracking-wide text-zinc-300 shadow-[0_6px_16px_rgba(0,0,0,0.24)] transition-colors hover:bg-zinc-800 hover:text-white"
        >
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="[writing-mode:vertical-rl] rotate-180">Dev</span>
        </button>
      )}

      <aside
        aria-hidden={!open}
        className={cn(
          'fixed inset-y-0 right-0 z-[100] flex w-[min(100vw,20rem)] flex-col border-l border-zinc-700 bg-zinc-900 text-zinc-100 shadow-2xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : 'pointer-events-none translate-x-full'
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-700 px-4 py-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Dev tools
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Admin preview — sign in required
            </p>
          </div>
          <button
            type="button"
            onClick={() => setToolbarOpen(false)}
            aria-label="Close dev tools"
            className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <p className="text-xs text-zinc-400">Application view</p>
            <SegmentTabs
              items={APP_VIEWS}
              value={currentView ?? 'guest'}
              getHref={(id) => viewHrefs[id]}
              ariaLabel="Application view"
            />
            <Link
              href="/styleguide"
              aria-current={pathname === '/styleguide' ? 'page' : undefined}
              className={cn(
                'inline-flex rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                pathname === '/styleguide'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'bg-black/20 text-white/80 hover:text-white'
              )}
            >
              Design
            </Link>
          </div>

          <DevAuthControls />

          {showGuestSubControls && (
            <div className="space-y-2 border-t border-zinc-700/80 pt-4">
              <p className="text-xs text-zinc-400">Guest UI</p>
              <SegmentTabs
                items={GUEST_STATES}
                value={guestAs}
                getHref={(as) =>
                  inviteToken
                    ? buildGuestDevPath(inviteToken, as, guestStatus)
                    : '/my-trips'
                }
                ariaLabel="Guest preview state"
                activeClassName="bg-amber-400 text-amber-950 shadow-sm"
              />
              {guestAs === 'booked' && (
                <SegmentTabs
                  items={BOOKING_STATUSES}
                  value={guestStatus}
                  getHref={(status) =>
                    inviteToken
                      ? buildGuestDevPath(inviteToken, 'booked', status)
                      : '/my-trips'
                  }
                  ariaLabel="Booking status preview"
                  activeClassName="bg-amber-300 text-amber-950 shadow-sm"
                />
              )}
              <p className="text-xs text-zinc-500">
                Guest preview — no submissions
              </p>
            </div>
          )}

          {currentView === 'guest' &&
            pathname.startsWith('/invite/') &&
            !guestPreview && (
              <p className="border-t border-zinc-700/80 pt-4 text-xs text-zinc-400">
                Open guest preview:{' '}
                <Link
                  href={
                    inviteToken
                      ? buildGuestDevPath(inviteToken, 'booking')
                      : '/my-trips'
                  }
                  className="font-medium text-amber-400 underline underline-offset-2"
                >
                  enable preview mode
                </Link>
              </p>
            )}
        </div>
      </aside>
    </>
  );
}
