'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, LogOut, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { DevUser, DevUserRole } from '@/app/api/dev/users/route';

const ROLE_LANDING: Record<DevUserRole, string> = {
  admin: '/admin',
  host: '/dashboard',
  guest: '/my-visits',
};

const ROLE_BADGE: Record<DevUserRole, string> = {
  admin: 'bg-amber-400/15 text-amber-300',
  host: 'bg-sky-400/15 text-sky-300',
  guest: 'bg-emerald-400/15 text-emerald-300',
};

function initials(user: DevUser): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return (parts[0]?.[0] ?? '?').concat(parts[1]?.[0] ?? '').toUpperCase();
}

export function DevImpersonateControls() {
  const router = useRouter();
  const [users, setUsers] = useState<DevUser[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/dev/users');
        if (!res.ok) throw new Error('failed');
        const data = (await res.json()) as { users: DevUser[] };
        if (active) setUsers(data.users);
      } catch {
        if (active) setLoadError(true);
      }
    })();
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (active) setCurrentEmail(data.user?.email?.toLowerCase() ?? null);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!users) return [];
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        (u.name ?? '').toLowerCase().includes(q) ||
        u.role.includes(q)
    );
  }, [users, query]);

  function impersonate(user: DevUser) {
    if (pending) return;
    setPending(user.email);
    const next = ROLE_LANDING[user.role];
    // Full navigation so the /auth/confirm redirect chain sets cookies before
    // the destination renders.
    window.location.assign(
      `/api/dev/impersonate?email=${encodeURIComponent(
        user.email
      )}&next=${encodeURIComponent(next)}`
    );
  }

  async function signOut() {
    setPending('__out__');
    await createClient().auth.signOut();
    setPending(null);
    router.push('/?preview=1');
    router.refresh();
  }

  return (
    <div className="space-y-2 border-t border-zinc-700/80 pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-zinc-400">Switch to</p>
        <button
          type="button"
          onClick={signOut}
          disabled={pending !== null}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-zinc-400 transition-colors hover:text-white disabled:opacity-50"
        >
          <LogOut className="h-3 w-3" />
          {pending === '__out__' ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search users…"
          className="w-full rounded-lg border border-zinc-700 bg-black/20 py-1.5 pl-8 pr-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {loadError ? (
        <p className="rounded-md bg-black/20 px-3 py-2 text-xs text-zinc-400">
          Couldn&apos;t load users. Run{' '}
          <code className="text-zinc-300">npm run db:seed:dev</code> and reload.
        </p>
      ) : users === null ? (
        <p className="px-1 py-2 text-xs text-zinc-500">Loading users…</p>
      ) : filtered.length === 0 ? (
        <p className="px-1 py-2 text-xs text-zinc-500">No matching users.</p>
      ) : (
        <ul className="max-h-64 space-y-1 overflow-y-auto pr-0.5">
          {filtered.map((user) => {
            const isCurrent = currentEmail === user.email.toLowerCase();
            const busy = pending === user.email;
            return (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => impersonate(user)}
                  disabled={pending !== null || isCurrent}
                  aria-current={isCurrent ? 'true' : undefined}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors',
                    isCurrent
                      ? 'bg-white/10'
                      : 'hover:bg-white/5 disabled:opacity-50',
                    pending && !busy && !isCurrent && 'opacity-50'
                  )}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[10px] font-semibold text-zinc-200">
                    {initials(user)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-zinc-100">
                      {user.name?.trim() || user.email}
                    </span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {user.email}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                      ROLE_BADGE[user.role]
                    )}
                  >
                    {user.role}
                  </span>
                  {isCurrent ? (
                    <Check className="h-3.5 w-3.5 shrink-0 text-zinc-300" />
                  ) : busy ? (
                    <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
