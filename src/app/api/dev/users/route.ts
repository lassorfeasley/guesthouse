import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDevToolsEnabled } from '@/lib/dev-tools';
import type { User } from '@/types/database';

export type DevUserRole = 'admin' | 'host' | 'guest';

export interface DevUser {
  id: string;
  name: string | null;
  email: string;
  role: DevUserRole;
}

/**
 * Dev-only roster of real accounts for the toolbar's "Switch to" impersonation
 * list. Returns 404 in production so this never leaks the user table.
 */
export async function GET() {
  if (!isDevToolsEnabled()) {
    return new NextResponse('Not found', { status: 404 });
  }

  const admin = createAdminClient();
  const [{ data: users }, { data: owners }, { data: managers }] =
    await Promise.all([
      admin
        .from('users')
        .select('id, name, email, is_admin')
        .order('created_at', { ascending: false }),
      admin.from('properties').select('owner_id'),
      admin.from('property_managers').select('user_id'),
    ]);

  // Host is derived: anyone who owns or co-manages at least one property.
  const hostIds = new Set<string>([
    ...(owners ?? []).map((p) => p.owner_id),
    ...(managers ?? []).map((m) => m.user_id),
  ]);

  const roleRank: Record<DevUserRole, number> = { host: 0, admin: 1, guest: 2 };

  const rows: DevUser[] = ((users as Pick<
    User,
    'id' | 'name' | 'email' | 'is_admin'
  >[] | null) ?? [])
    .filter((u) => !!u.email)
    .map((u) => {
      const role: DevUserRole = u.is_admin
        ? 'admin'
        : hostIds.has(u.id)
          ? 'host'
          : 'guest';
      return { id: u.id, name: u.name, email: u.email, role };
    })
    .sort((a, b) => {
      const byRole = roleRank[a.role] - roleRank[b.role];
      if (byRole !== 0) return byRole;
      return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    });

  return NextResponse.json({ users: rows });
}
