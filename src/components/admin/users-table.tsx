'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { UserAdminToggle } from './user-admin-toggle';
import { UserInvitationGrant } from './user-invitation-grant';

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  isHost: boolean;
  isAdmin: boolean;
  disableAdminToggle: boolean;
  bonusInvitations: number;
  joined: string;
  usage: { used: number; limit: number } | null;
  visits: { complete: number; pending: number; upcoming: number };
}

export function UsersTable({ rows }: { rows: AdminUserRow[] }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.name?.toLowerCase().includes(q) ?? false) ||
        r.email.toLowerCase().includes(q)
    );
  }, [rows, query]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {query.trim() && (
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {rows.length} users
          </p>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Capabilities</th>
              <th className="px-4 py-3 font-medium">Visits</th>
              <th className="px-4 py-3 font-medium">Free invitations</th>
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="px-4 py-3">{u.name ?? '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {u.isHost ? <Badge variant="secondary">Host</Badge> : null}
                    <Badge variant="outline">Guest</Badge>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 tabular-nums">
                    <VisitStat n={u.visits.complete} label="complete" />
                    <VisitStat n={u.visits.pending} label="pending" />
                    <VisitStat n={u.visits.upcoming} label="upcoming" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  {u.usage ? (
                    <UserInvitationGrant
                      userId={u.id}
                      bonusInvitations={u.bonusInvitations}
                      used={u.usage.used}
                      limit={u.usage.limit}
                    />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <UserAdminToggle
                    userId={u.id}
                    isAdmin={u.isAdmin}
                    disabled={u.disableAdminToggle}
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{u.joined}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-8 text-center text-muted-foreground">
            {rows.length === 0
              ? 'No users yet.'
              : 'No users match your search.'}
          </p>
        )}
      </div>
    </div>
  );
}

function VisitStat({ n, label }: { n: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <span
        className={n > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}
      >
        {n}
      </span>{' '}
      <span className="text-xs text-muted-foreground">{label}</span>
    </span>
  );
}
