import { createClient } from '@/lib/supabase/server';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { getInvitationRoomAvailability } from '@/lib/guest-availability';
import { ComposePageActions } from '@/components/dashboard/compose-page-actions';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';
import {
  VisitsHub,
  type VisitTab,
  type VisitItem,
  type InviteItem,
} from '@/components/dashboard/visits-hub';
import type { VisitStatus, Invitation } from '@/types/database';

export const metadata = { title: 'Visits' };

const VALID_TABS: VisitTab[] = [
  'all',
  'requested',
  'upcoming',
  'past',
  'cancelled',
  'invited',
];

export default async function VisitsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; notice?: string }>;
}) {
  const { slug } = await params;
  const { status, notice } = await searchParams;
  const property = await getDashboardProperty(slug);
  const today = new Date().toISOString().split('T')[0];

  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('property_id', property.id)
    .order('display_order');

  const { data: invitations } = await supabase
    .from('invitations')
    .select('*, invitation_windows(start_date, end_date)')
    .eq('property_id', property.id)
    .order('created_at', { ascending: false });

  const { data: visitRows } = await supabase
    .from('visits')
    .select(
      `
      id, status, invitation_id, guest_name, guest_email, relationship, party_size, notes,
      guest:users!guest_user_id(name, email, avatar_url),
      dates:visit_dates(check_in, check_out),
      visit_rooms(room:rooms(name)),
      invitation:invitations(token, guest_name, guest_first_name, guest_last_name, guest_email)
    `
    )
    .eq('property_id', property.id)
    .order('created_at', { ascending: false });

  // Batch-fetch avatars by email so account-holding guests show their photo
  // even on rows where there's no guest_user_id join (manual visits, invites).
  const emailSet = new Set<string>();
  for (const b of visitRows ?? []) {
    if (b.guest_email) emailSet.add(b.guest_email.toLowerCase());
  }
  for (const inv of invitations ?? []) {
    if (inv.guest_email) emailSet.add(inv.guest_email.toLowerCase());
  }
  const avatarByEmail = new Map<string, string | null>();
  if (emailSet.size > 0) {
    const { data: members } = await supabase
      .from('users')
      .select('email, avatar_url')
      .in('email', Array.from(emailSet));
    for (const m of members ?? []) {
      avatarByEmail.set(m.email.toLowerCase(), m.avatar_url);
    }
  }

  const visits: VisitItem[] = (visitRows ?? [])
    .map((b): VisitItem | null => {
      const dates = Array.isArray(b.dates) ? b.dates[0] : b.dates;
      if (!dates?.check_in || !dates?.check_out) return null;
      const guest = (Array.isArray(b.guest) ? b.guest[0] : b.guest) as
        | { name: string | null; email: string; avatar_url: string | null }
        | null;
      const inv = Array.isArray(b.invitation) ? b.invitation[0] : b.invitation;
      // Invite-flow visits store only guest_user_id, and RLS hides the guest's
      // users row from the host — so the guest's name/email come off the
      // invitation (which the host can read) rather than the user join.
      const invName =
        inv?.guest_name ||
        [inv?.guest_first_name, inv?.guest_last_name]
          .filter(Boolean)
          .join(' ') ||
        null;
      const guestName =
        guest?.name ??
        b.guest_name ??
        invName ??
        guest?.email?.split('@')[0] ??
        b.guest_email?.split('@')[0] ??
        inv?.guest_email?.split('@')[0] ??
        'Guest';
      const rooms =
        b.visit_rooms?.map((br) => {
          const room = Array.isArray(br.room) ? br.room[0] : br.room;
          return room?.name ?? 'Room';
        }) ?? [];
      const email = guest?.email ?? b.guest_email ?? inv?.guest_email ?? null;
      return {
        id: b.id,
        guestName,
        email,
        avatarUrl:
          guest?.avatar_url ??
          (email ? (avatarByEmail.get(email.toLowerCase()) ?? null) : null),
        relationship: b.relationship ?? null,
        status: b.status as VisitStatus,
        checkIn: dates.check_in,
        checkOut: dates.check_out,
        partySize: b.party_size,
        rooms,
        isManual: !b.invitation_id,
        token: inv?.token ?? null,
        notes: b.notes,
      };
    })
    .filter((v): v is VisitItem => v !== null);

  const invites: InviteItem[] = (
    (invitations ?? []) as (Invitation & {
      invitation_windows?: { start_date: string; end_date: string }[];
    })[]
  ).map((inv) => ({
    id: inv.id,
    guestName: inv.guest_name ?? inv.guest_email,
    email: inv.guest_email,
    avatarUrl: avatarByEmail.get(inv.guest_email.toLowerCase()) ?? null,
    relationship: inv.relationship ?? null,
    status: inv.status,
    type: inv.type,
    token: inv.token,
    expiresAt: inv.expires_at,
    windows: (inv.invitation_windows ?? [])
      .map((w) => ({ start: w.start_date, end: w.end_date }))
      .sort((a, b) => a.start.localeCompare(b.start)),
  }));

  const roomAvailability = await getInvitationRoomAvailability(
    (rooms ?? []).map((r) => r.id),
    { includeGuestNames: true }
  );

  const initialTab: VisitTab = VALID_TABS.includes(status as VisitTab)
    ? (status as VisitTab)
    : 'all';

  const noticeMessage =
    notice === 'approved'
      ? { ok: true, text: 'Request approved — the guest has been notified.' }
      : notice === 'declined'
        ? { ok: true, text: 'Request declined — the guest has been notified.' }
        : notice === 'handled'
          ? {
              ok: false,
              text: 'This request has already been handled — see its current status below.',
            }
          : null;

  return (
    <DashboardContainer className="flex flex-col gap-6">
      {noticeMessage && (
        <div
          className={
            noticeMessage.ok
              ? 'rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900/50 dark:bg-green-950/30 dark:text-green-200'
              : 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200'
          }
        >
          {noticeMessage.text}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visits</h1>
        </div>
        <ComposePageActions
          propertyId={property.id}
          rooms={rooms ?? []}
          roomAvailability={roomAvailability}
        />
      </div>

      {rooms?.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Add rooms before inviting guests or adding manual visits.
        </div>
      )}

      <VisitsHub
        slug={slug}
        today={today}
        initialTab={initialTab}
        visits={visits}
        invites={invites}
        propertyName={property.name}
      />
    </DashboardContainer>
  );
}
