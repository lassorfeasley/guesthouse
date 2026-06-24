import { createAdminClient } from '@/lib/supabase/admin';
import { requireSiteAdmin } from '@/lib/auth';
import { getAccountUsage } from '@/lib/billing';
import { UsersTable, type AdminUserRow } from '@/components/admin/users-table';
import { formatDate } from '@/lib/dates';
import type { User } from '@/types/database';

export const metadata = { title: 'Users · Admin' };

type VisitCounts = { complete: number; pending: number; upcoming: number };

export default async function AdminUsersPage() {
  const actor = await requireSiteAdmin();
  const admin = createAdminClient();

  const [{ data: users }, { data: owners }, { data: managers }, { data: visits }] =
    await Promise.all([
      admin
        .from('users')
        .select('*')
        .order('created_at', { ascending: false }),
      admin.from('properties').select('owner_id'),
      admin.from('property_managers').select('user_id'),
      admin
        .from('visits')
        .select('guest_user_id, status, dates:visit_dates(check_out)'),
    ]);

  // Host is derived: anyone who owns or co-manages at least one property.
  const hostIds = new Set<string>([
    ...(owners ?? []).map((p) => p.owner_id),
    ...(managers ?? []).map((m) => m.user_id),
  ]);

  const ownerIds = [...new Set((owners ?? []).map((p) => p.owner_id))];
  const usageEntries = await Promise.all(
    ownerIds.map(async (id) => [id, await getAccountUsage(id)] as const)
  );
  const usageByOwnerId = new Map(usageEntries);

  // Per-guest visit tallies. "pending" = awaiting host approval; approved stays
  // split into "upcoming" vs "complete" by whether checkout is still ahead.
  const today = new Date().toISOString().slice(0, 10);
  const visitsByUser = new Map<string, VisitCounts>();
  for (const v of visits ?? []) {
    const uid = v.guest_user_id;
    if (!uid) continue;
    const counts = visitsByUser.get(uid) ?? {
      complete: 0,
      pending: 0,
      upcoming: 0,
    };
    if (v.status === 'requested') {
      counts.pending += 1;
    } else if (v.status === 'approved') {
      const date = Array.isArray(v.dates) ? v.dates[0] : v.dates;
      if (date?.check_out && date.check_out >= today) {
        counts.upcoming += 1;
      } else {
        counts.complete += 1;
      }
    }
    visitsByUser.set(uid, counts);
  }

  const rows: AdminUserRow[] = ((users as User[] | null) ?? []).map((u) => {
    const usage = usageByOwnerId.get(u.id);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isHost: hostIds.has(u.id),
      isAdmin: u.is_admin,
      disableAdminToggle: u.id === actor.id,
      bonusInvitations: u.bonus_invitations ?? 0,
      joined: formatDate(u.created_at),
      usage: usage ? { used: usage.used, limit: usage.limit } : null,
      visits: visitsByUser.get(u.id) ?? { complete: 0, pending: 0, upcoming: 0 },
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="mt-1 text-muted-foreground">
          {rows.length} accounts on the platform
        </p>
      </div>

      <UsersTable rows={rows} />
    </div>
  );
}
