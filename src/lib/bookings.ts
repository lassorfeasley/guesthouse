import { createAdminClient } from '@/lib/supabase/admin';
import { datesOverlap } from '@/lib/dates';
import type {
  BookingGuest,
  BookingWithDetails,
  InvitationWithDetails,
  Room,
  User,
} from '@/types/database';

function normalizeBookingGuest(
  data: {
    guest_name: string | null;
    guest_email: string | null;
    guest: User | User[] | null;
  }
): BookingGuest {
  const userGuest = data.guest
    ? (Array.isArray(data.guest) ? data.guest[0] : data.guest)
    : null;

  if (userGuest) {
    return {
      id: userGuest.id,
      name: userGuest.name,
      email: userGuest.email,
    };
  }

  return {
    id: null,
    name: data.guest_name,
    email: data.guest_email,
  };
}

export async function getBookingWithDetails(
  bookingId: string
): Promise<BookingWithDetails | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('bookings')
    .select(
      `
      *,
      guest:users!guest_user_id(*),
      dates:booking_dates(*),
      booking_rooms(room:rooms(*)),
      property:properties(*, property_notes(*)),
      invitation:invitations(*)
    `
    )
    .eq('id', bookingId)
    .single();

  if (!data) return null;

  const invitation = data.invitation
    ? Array.isArray(data.invitation)
      ? data.invitation[0]
      : data.invitation
    : null;

  return {
    ...data,
    guest: normalizeBookingGuest(data),
    dates: Array.isArray(data.dates) ? data.dates[0] : data.dates,
    rooms: data.booking_rooms?.map((br: { room: Room }) => br.room) ?? [],
    property: Array.isArray(data.property) ? data.property[0] : data.property,
    invitation,
  } as BookingWithDetails;
}

/** Minimal stay info for showing a guest their own booking on invite pages. */
export interface GuestStaySummary {
  id: string;
  status: 'requested' | 'approved';
  checkIn: string;
  checkOut: string;
  roomNames: string[];
  partySize: number;
}

/**
 * The guest's current stay for an invitation, if any: an active (requested or
 * approved) booking that hasn't ended yet. Used so invite pages keep showing
 * the confirmed stay — with add-to-calendar — instead of the booking widget.
 */
export async function getGuestStayForInvitation(
  invitationId: string,
  guestUserId: string
): Promise<GuestStaySummary | null> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data } = await admin
    .from('bookings')
    .select(
      `
      id,
      status,
      party_size,
      dates:booking_dates(check_in, check_out),
      booking_rooms(room:rooms(name))
    `
    )
    .eq('invitation_id', invitationId)
    .eq('guest_user_id', guestUserId)
    .in('status', ['requested', 'approved']);

  const stays: GuestStaySummary[] = [];
  for (const b of data ?? []) {
    const dates = Array.isArray(b.dates) ? b.dates[0] : b.dates;
    if (!dates || dates.check_out < today) continue;
    stays.push({
      id: b.id,
      status: b.status as 'requested' | 'approved',
      checkIn: dates.check_in,
      checkOut: dates.check_out,
      roomNames:
        b.booking_rooms?.map((br: { room: { name: string } | { name: string }[] }) => {
          const room = Array.isArray(br.room) ? br.room[0] : br.room;
          return room.name;
        }) ?? [],
      partySize: b.party_size,
    });
  }

  stays.sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return stays[0] ?? null;
}

export async function checkRoomConflicts(
  roomIds: string[],
  checkIn: string,
  checkOut: string,
  excludeBookingId?: string
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

    // Check approved bookings
    const { data: bookingRooms } = await admin
      .from('booking_rooms')
      .select(
        `
        booking_id,
        booking:bookings(status, dates:booking_dates(check_in, check_out))
      `
      )
      .eq('room_id', roomId);

    for (const br of bookingRooms ?? []) {
      const booking = (Array.isArray(br.booking) ? br.booking[0] : br.booking) as {
        status: string;
        dates: { check_in: string; check_out: string } | { check_in: string; check_out: string }[];
      };
      if (excludeBookingId && br.booking_id === excludeBookingId) continue;
      if (booking.status !== 'approved' && booking.status !== 'requested')
        continue;

      const dates = Array.isArray(booking.dates)
        ? booking.dates[0]
        : booking.dates;
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

export function validateBookingAgainstInvitation(
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
        error: 'Dates must match the fixed stay offered in your invitation',
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
