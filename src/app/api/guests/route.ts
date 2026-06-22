import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, canManageProperty } from '@/lib/auth';
import { buildGuestRoster } from '@/lib/guest-roster';
import type { Invitation } from '@/types/database';

export interface GuestDirectoryEntry {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  relationship: string | null;
  avatarUrl: string | null;
  isMember: boolean;
  pastStaysCount: number;
  hasUpcoming: boolean;
  invitationStatus: string | null;
}

/**
 * Returns the host's past/known guests for a property, enriched with account
 * status (member?) and avatar. Powers the guest combo-box at invite time.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const propertyId = request.nextUrl.searchParams.get('property_id');
  if (!propertyId) {
    return NextResponse.json({ error: 'property_id is required' }, { status: 400 });
  }

  if (!(await canManageProperty(propertyId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const admin = createAdminClient();
  const today = new Date().toISOString().split('T')[0];

  const [{ data: invitations }, { data: visits }] = await Promise.all([
    admin.from('invitations').select('*').eq('property_id', propertyId),
    admin
      .from('visits')
      .select(
        `
        id, status, invitation_id, guest_name, guest_email, guest_phone, relationship, party_size, notes,
        guest:users!guest_user_id(name, email),
        dates:visit_dates(check_in, check_out),
        visit_rooms(room:rooms(name)),
        invitation:invitations(*)
      `
      )
      .eq('property_id', propertyId)
      .order('created_at', { ascending: false }),
  ]);

  const roster = buildGuestRoster(
    (invitations ?? []) as Invitation[],
    visits ?? [],
    today
  );

  // Enrich with account status + avatar via a single batched lookup.
  const emails = roster
    .map((g) => g.email)
    .filter((e): e is string => Boolean(e));

  const memberByEmail = new Map<string, { avatar_url: string | null }>();
  if (emails.length > 0) {
    const { data: members } = await admin
      .from('users')
      .select('email, avatar_url')
      .in('email', emails);
    for (const m of members ?? []) {
      memberByEmail.set(m.email.toLowerCase(), { avatar_url: m.avatar_url });
    }
  }

  const entries: GuestDirectoryEntry[] = roster.map((g) => {
    const member = g.email ? memberByEmail.get(g.email) : undefined;
    return {
      key: g.key,
      name: g.name,
      email: g.email,
      phone: g.phone,
      relationship: g.relationship,
      avatarUrl: member?.avatar_url ?? null,
      isMember: Boolean(member),
      pastStaysCount: g.pastStaysCount,
      hasUpcoming: Boolean(g.upcomingStay),
      invitationStatus: g.invitation?.status ?? null,
    };
  });

  return NextResponse.json({ guests: entries });
}
