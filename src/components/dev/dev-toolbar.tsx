'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, ExternalLink, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DevImpersonateControls } from '@/components/dev/dev-impersonate-controls';
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

const MAILPIT_URL =
  process.env.NEXT_PUBLIC_MAILPIT_URL ?? 'http://localhost:8025';

const APP_VIEWS: { id: AppView; label: string }[] = [
  { id: 'landing', label: 'Landing' },
  { id: 'guest', label: 'Guest' },
  { id: 'host', label: 'Host' },
  { id: 'admin', label: 'Admin' },
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

export function DevToolbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const currentView = detectAppView(pathname);

  const inviteToken =
    extractInviteToken(pathname) ?? getStoredInviteToken();
  const propertySlug = getStoredPropertySlug();

  const viewHrefs = useMemo(
    () => ({
      landing: LANDING_DEV_PATH,
      guest: inviteToken ? buildGuestDevPath(inviteToken) : '/my-visits',
      host: buildHostDevPath(propertySlug),
      admin: ADMIN_DEV_PATH,
    }),
    [inviteToken, propertySlug]
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
              Local only — impersonate any account
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
            <div className="flex flex-wrap items-center gap-2">
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
              <a
                href={MAILPIT_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md bg-black/20 px-3 py-1.5 text-xs font-medium text-white/80 transition-colors hover:text-white"
              >
                Mailpit
                <ExternalLink className="h-3 w-3" />
              </a>
              <Link
                href="/admin/email-queue"
                aria-current={
                  pathname === '/admin/email-queue' ? 'page' : undefined
                }
                className={cn(
                  'inline-flex rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  pathname === '/admin/email-queue'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'bg-black/20 text-white/80 hover:text-white'
                )}
              >
                Email queue
              </Link>
            </div>
          </div>

          <DevImpersonateControls />
        </div>
      </aside>
    </>
  );
}
