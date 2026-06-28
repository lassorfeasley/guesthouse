import { createAdminClient } from '@/lib/supabase/admin';
import { datesOverlap } from '@/lib/dates';
import type {
  VisitGuest,
  VisitWithDetails,
  InvitationWithDetails,
  Room,
  User,
} from '@/types/database';

function normalizeVisitGuest(
  data: {
    guest_name: string | null;
    guest_email: string | null;
    guest: User | User[] | null;
  }
): VisitGuest {
  const userGuest = data.guest
    ? (Array.isArray(data.guest) ? data.guest[0] : data.guest)
    : null;

  if (userGuest) {
    return {
      id: userGuest.id,
      name: userGuest.name,
      email: userGuest.email,
      avatar_url: userGuest.avatar_url,
    };
  }

  return {
    id: null,
    name: data.guest_name,
    email: data.guest_email,
    avatar_url: null,
  };
}

export async function getVisitWithDetails(
  visitId: string
): Promise<VisitWithDetails | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('visits')
    .select(
      `
      *,
      guest:users!guest_user_id(*),
      dates:visit_dates(*),
      visit_rooms(room:rooms(*)),
      property:properties(*, property_notes(*)),
      invitation:invitations(*)
    `
    )
    .eq('id', visitId)
    .single();

  if (!data) return null;

  const invitation = data.invitation
    ? Array.isArray(data.invitation)
      ? data.invitation[0]
      : data.invitation
    : null;

  return {
    ...data,
    guest: normalizeVisitGuest(data),
    dates: Array.isArray(data.dates) ? data.dates[0] : data.dates,
    rooms: data.visit_rooms?.map((br: { room: Room }) => br.room) ?? [],
    property: Array.isArray(data.property) ? data.property[0] : data.property,
    invitation,
  } as VisitWithDetails;
}

/** Minimal visit info for showing a guest their own visit on invite pages. */
export interface GuestVisitSummary {
  id: string;
  status: 'requested' | 'approved';
  checkIn: string;
  checkOut: string;
  roomNames: string[];
  partySize: number;
}

/**
 * The guest's current visit for an invitation, if any: an active (requested or
 * approved) visit that hasn't ended yet. Used so invite pages keep showing
 * the confirmed visit — with add-to-calendar — instead of the visit widget.
 */
export async function getGuestVisitForInvitation(
  invitationId: string,
  guestUserId: string
): Promise<GuestVisitSummary | null> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await admin
    .from('visits')
    .select(
      `
      id,
      status,
      party_size,
      dates:visit_dates(check_in, check_out),
      visit_rooms(room:rooms(name))
    `
    )
    .eq('invitation_id', invitationId)
    .eq('guest_user_id', guestUserId)
    .in('status', ['requested', 'approved']);

  const visits: GuestVisitSummary[] = [];
  for (const v of data ?? []) {
    const dates = Array.isArray(v.dates) ? v.dates[0] : v.dates;
    if (!dates || dates.check_out < today) continue;
    visits.push({
      id: v.id,
      status: v.status as 'requested' | 'approved',
      checkIn: dates.check_in,
      checkOut: dates.check_out,
      roomNames:
        v.visit_rooms?.map((br: { room: { name: string } | { name: string }[] }) => {
          const room = Array.isArray(br.room) ? br.room[0] : br.room;
          return room.name;
        }) ?? [],
      partySize: v.party_size,
    });
  }

  visits.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return visits[0] ?? null;
}

/**
 * The active visit for an invitation, regardless of which guest it belongs to.
 * Used on the host's view of the invite page so it can reflect "accepted" and
 * link through to the visit, without needing the guest's user id.
 */
export async function getVisitForInvitation(
  invitationId: string
): Promise<GuestVisitSummary | null> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await admin
    .from('visits')
    .select(
      `
      id,
      status,
      party_size,
      dates:visit_dates(check_in, check_out),
      visit_rooms(room:rooms(name))
    `
    )
    .eq('invitation_id', invitationId)
    .in('status', ['requested', 'approved']);

  const visits: GuestVisitSummary[] = [];
  for (const v of data ?? []) {
    const dates = Array.isArray(v.dates) ? v.dates[0] : v.dates;
    if (!dates || dates.check_out < today) continue;
    visits.push({
      id: v.id,
      status: v.status as 'requested' | 'approved',
      checkIn: dates.check_in,
      checkOut: dates.check_out,
      roomNames:
        v.visit_rooms?.map(
          (br: { room: { name: string } | { name: string }[] }) => {
            const room = Array.isArray(br.room) ? br.room[0] : br.room;
            return room.name;
          }
        ) ?? [],
      partySize: v.party_size,
    });
  }

  visits.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return visits[0] ?? null;
}

/**
 * Every approved (confirmed) visit at a property, shaped for the calendar feed.
 * Past visits are kept so subscribers retain history; calendar apps cope fine.
 */
export async function getApprovedVisitsForFeed(
  propertyId: string
): Promise<
  {
    id: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    roomNames: string[];
    partySize: number;
  }[]
> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('visits')
    .select(
      `
      id,
      party_size,
      guest_name,
      guest_email,
      guest:users!guest_user_id(name, email),
      dates:visit_dates(check_in, check_out),
      visit_rooms(room:rooms(name))
    `
    )
    .eq('property_id', propertyId)
    .eq('status', 'approved');

  const visits = [];
  for (const v of data ?? []) {
    const dates = Array.isArray(v.dates) ? v.dates[0] : v.dates;
    if (!dates) continue;
    const guest = (Array.isArray(v.guest) ? v.guest[0] : v.guest) as
      | { name: string | null; email: string | null }
      | null;
    const guestName =
      guest?.name ??
      guest?.email?.split('@')[0] ??
      v.guest_name ??
      v.guest_email?.split('@')[0] ??
      'Guest';
    const roomNames =
      v.visit_rooms?.map((br: { room: { name: string } | { name: string }[] }) => {
        const room = Array.isArray(br.room) ? br.room[0] : br.room;
        return room.name;
      }) ?? [];
    visits.push({
      id: v.id as string,
      guestName,
      checkIn: dates.check_in,
      checkOut: dates.check_out,
      roomNames,
      partySize: v.party_size as number,
    });
  }
  return visits;
}

export async function checkRoomConflicts(
  roomIds: string[],
  checkIn: string,
  checkOut: string,
  excludeVisitId?: string
): Promise<{ hasConflict: boolean; conflictRoom?: string }> {
  const admin = createAdminClient();

  for (const roomId of roomIds) {
    // Check owner blocks
    const { data: blocks } = await admin
      .from('room_availability')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_blocked', true);

    for (const block of blocks ?? []) {
      if (datesOverlap(checkIn, checkOut, block.start_date, block.end_date)) {
        return { hasConflict: true, conflictRoom: roomId };
      }
    }

    // Check approved visits
    const { data: visitRooms } = await admin
      .from('visit_rooms')
      .select(
        `
        visit_id,
        visit:visits(status, dates:visit_dates(check_in, check_out))
      `
      )
      .eq('room_id', roomId);

    for (const br of visitRooms ?? []) {
      const visit = (Array.isArray(br.visit) ? br.visit[0] : br.visit) as {
        status: string;
        dates: { check_in: string; check_out: string } | { check_in: string; check_out: string }[];
      };
      if (excludeVisitId && br.visit_id === excludeVisitId) continue;
      if (visit.status !== 'approved' && visit.status !== 'requested')
        continue;

      const dates = Array.isArray(visit.dates)
        ? visit.dates[0]
        : visit.dates;
      if (!dates) continue;

      if (
        datesOverlap(checkIn, checkOut, dates.check_in, dates.check_out)
      ) {
        return { hasConflict: true, conflictRoom: roomId };
      }
    }
  }

  return { hasConflict: false };
}

export function validateVisitAgainstInvitation(
  invitation: InvitationWithDetails,
  checkIn: string,
  checkOut: string,
  roomIds: string[],
  partySize: number
): { valid: boolean; error?: string } {
  const offeredRoomIds = invitation.rooms.map((r) => r.id);
  for (const rid of roomIds) {
    if (!offeredRoomIds.includes(rid)) {
      return { valid: false, error: 'Selected room is not included in your invitation' };
    }
  }

  // Entire-home invitations can only be requested as the whole place.
  if (invitation.whole_home) {
    const visitAllRooms =
      roomIds.length === offeredRoomIds.length &&
      offeredRoomIds.every((id) => roomIds.includes(id));
    if (!visitAllRooms) {
      return {
        valid: false,
        error: 'This home is offered as a whole — your visit must include every room',
      };
    }
  }

  const selectedRooms = invitation.rooms.filter((r) => roomIds.includes(r.id));
  const maxOcc = selectedRooms.reduce((sum, r) => sum + r.max_occupancy, 0);
  if (partySize > maxOcc) {
    return {
      valid: false,
      error: `Party size exceeds maximum occupancy (${maxOcc}) for selected rooms`,
    };
  }

  if (invitation.type === 'prix_fixe' && invitation.windows.length > 0) {
    const w = invitation.windows[0];
    if (checkIn !== w.start_date || checkOut !== w.end_date) {
      return {
        valid: false,
        error: 'Dates must match the fixed visit offered in your invitation',
      };
    }
  }

  if (invitation.type === 'date_offer' && invitation.windows.length > 0) {
    const inWindow = invitation.windows.some(
      (w) => checkIn >= w.start_date && checkOut <= w.end_date
    );
    if (!inWindow) {
      return {
        valid: false,
        error: 'Selected dates must fall within an offered date window',
      };
    }
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    return { valid: false, error: 'Check-out must be after check-in' };
  }

  return { valid: true };
}
