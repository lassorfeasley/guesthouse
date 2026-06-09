import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, canManageProperty } from '@/lib/auth';
import { getBookingWithDetails, checkRoomConflicts } from '@/lib/bookings';
import { bookingUpdateSchema } from '@/lib/validations';
import {
  notifyBookingApproved,
  notifyBookingDeclined,
  notifyBookingCancelled,
} from '@/lib/email/notifications';
import {
  assertCanHostStay,
  getPropertyOwnerId,
  incrementHostedStays,
  StayLimitReachedError,
  toLimitReachedPayload,
} from '@/lib/billing';
import type { Room } from '@/types/database';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action, decline_message } = body as {
      action: 'approve' | 'decline' | 'cancel' | 'update';
      decline_message?: string;
    };

    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const booking = await getBookingWithDetails(id);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const isOwner = await canManageProperty(booking.property_id, user.id);
    const isGuest = booking.guest_user_id === user.id;

    const admin = createAdminClient();

    if (action === 'approve') {
      if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const ownerId = await getPropertyOwnerId(booking.property_id);
      try {
        await assertCanHostStay(ownerId);
      } catch (err) {
        if (err instanceof StayLimitReachedError) {
          return NextResponse.json(toLimitReachedPayload(err), { status: 402 });
        }
        throw err;
      }

      await admin.from('bookings').update({ status: 'approved' }).eq('id', id);
      await incrementHostedStays(ownerId);
      notifyBookingApproved(id).catch(console.error);
    } else if (action === 'decline') {
      if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      await admin
        .from('bookings')
        .update({ status: 'declined', decline_message: decline_message ?? null })
        .eq('id', id);
      notifyBookingDeclined(id, decline_message).catch(console.error);
    } else if (action === 'cancel') {
      if (!isOwner && !isGuest) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      await admin.from('bookings').update({ status: 'cancelled' }).eq('id', id);
      notifyBookingCancelled(id, isGuest ? 'guest' : 'owner').catch(console.error);
    } else if (action === 'update') {
      if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

      const parsed = bookingUpdateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.flatten().fieldErrors },
          { status: 400 }
        );
      }
      const data = parsed.data;

      if (new Date(data.check_out) <= new Date(data.check_in)) {
        return NextResponse.json(
          { error: 'Check-out must be after check-in' },
          { status: 400 }
        );
      }

      const { data: rooms } = await admin
        .from('rooms')
        .select('*')
        .eq('property_id', booking.property_id)
        .in('id', data.room_ids);

      if (!rooms || rooms.length !== data.room_ids.length) {
        return NextResponse.json(
          { error: 'One or more selected rooms are invalid for this property' },
          { status: 400 }
        );
      }

      const maxOcc = (rooms as Room[]).reduce(
        (sum, r) => sum + r.max_occupancy,
        0
      );
      if (data.party_size > maxOcc) {
        return NextResponse.json(
          {
            error: `Party size exceeds maximum occupancy (${maxOcc}) for selected rooms`,
          },
          { status: 400 }
        );
      }

      const conflicts = await checkRoomConflicts(
        data.room_ids,
        data.check_in,
        data.check_out,
        id
      );
      if (conflicts.hasConflict) {
        return NextResponse.json(
          { error: 'Selected dates conflict with an existing booking or block' },
          { status: 400 }
        );
      }

      await admin
        .from('bookings')
        .update({ party_size: data.party_size, notes: data.notes ?? null })
        .eq('id', id);

      await admin
        .from('booking_dates')
        .update({ check_in: data.check_in, check_out: data.check_out })
        .eq('booking_id', id);

      await admin.from('booking_rooms').delete().eq('booking_id', id);
      await admin.from('booking_rooms').insert(
        data.room_ids.map((room_id) => ({ booking_id: id, room_id }))
      );

      // Inform the guest of the change (re-sends confirmation with new details).
      if (booking.status === 'approved' && booking.notify_guest && booking.guest.email) {
        notifyBookingApproved(id).catch(console.error);
      }
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updated = await getBookingWithDetails(id);
    return NextResponse.json({ booking: updated });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
