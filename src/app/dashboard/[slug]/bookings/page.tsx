import { createClient } from '@/lib/supabase/server';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { getInvitationRoomAvailability } from '@/lib/guest-availability';
import { ComposePageActions } from '@/components/dashboard/compose-page-actions';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';
import {
  BookingsHub,
  type VisitTab,
  type VisitItem,
  type InviteItem,
} from '@/components/dashboard/bookings-hub';
import type { BookingStatus, Invitation } from '@/types/database';

export const metadata = { title: 'Visits' };

const VALID_TABS: VisitTab[] = [
  'all',
  'requested',
  'upcoming',
  'past',
  'cancelled',
  'invited',
];

export default async function BookingsPage({
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
    .select('*')
    .eq('property_id', property.id)
    .order('created_at', { ascending: false });

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      `
      id, status, invitation_id, guest_name, guest_email, party_size, notes,
      guest:users!guest_user_id(name, email),
      dates:booking_dates(check_in, check_out),
      booking_rooms(room:rooms(name)),
      invitation:invitations(token)
    `
    )
    .eq('property_id', property.id)
    .order('created_at', { ascending: false });

  const visits: VisitItem[] = (bookings ?? [])
    .map((b): VisitItem | null => {
      const dates = Array.isArray(b.dates) ? b.dates[0] : b.dates;
      if (!dates?.check_in || !dates?.check_out) return null;
      const guest = (Array.isArray(b.guest) ? b.guest[0] : b.guest) as
        | { name: string | null; email: string }
        | null;
      const guestName =
        guest?.name ??
        b.guest_name ??
        guest?.email?.split('@')[0] ??
        b.guest_email?.split('@')[0] ??
        'Guest';
      const rooms =
        b.booking_rooms?.map((br) => {
          const room = Array.isArray(br.room) ? br.room[0] : br.room;
          return room?.name ?? 'Room';
        }) ?? [];
      const inv = Array.isArray(b.invitation) ? b.invitation[0] : b.invitation;
      return {
        id: b.id,
        guestName,
        email: guest?.email ?? b.guest_email ?? null,
        status: b.status as BookingStatus,
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

  const invites: InviteItem[] = ((invitations ?? []) as Invitation[]).map(
    (inv) => ({
      id: inv.id,
      guestName: inv.guest_name ?? inv.guest_email,
      email: inv.guest_email,
      status: inv.status,
      type: inv.type,
      token: inv.token,
      expiresAt: inv.expires_at,
    })
  );

  const roomAvailability = await getInvitationRoomAvailability(
    (rooms ?? []).map((r) => r.id),
    { includeGuestNames: true }
  );

  const requestedCount = visits.filter((v) => v.status === 'requested').length;
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
          <p className="mt-1 text-muted-foreground">
            {requestedCount > 0
              ? `${requestedCount} request${requestedCount === 1 ? '' : 's'} waiting — approve and see who's coming to ${property.name}.`
              : `See who's coming to ${property.name}.`}
          </p>
        </div>
        <ComposePageActions
          propertyId={property.id}
          rooms={rooms ?? []}
          roomAvailability={roomAvailability}
        />
      </div>

      {rooms?.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Add rooms before inviting guests or adding manual stays.
        </div>
      )}

      <BookingsHub
        slug={slug}
        today={today}
        initialTab={initialTab}
        visits={visits}
        invites={invites}
      />
    </DashboardContainer>
  );
}
