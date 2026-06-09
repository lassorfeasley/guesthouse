import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, canManageProperty } from '@/lib/auth';
import { hostBookingSchema } from '@/lib/validations';
import { checkRoomConflicts } from '@/lib/bookings';
import { notifyBookingApproved } from '@/lib/email/notifications';
import {
  assertCanHostStay,
  getPropertyOwnerId,
  incrementHostedStays,
  StayLimitReachedError,
  toLimitReachedPayload,
} from '@/lib/billing';
import type { Room } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = hostBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const canManage = await canManageProperty(data.property_id, user.id);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (new Date(data.check_out) <= new Date(data.check_in)) {
      return NextResponse.json(
        { error: 'Check-out must be after check-in' },
        { status: 400 }
      );
    }

    const ownerId = await getPropertyOwnerId(data.property_id);

    try {
      await assertCanHostStay(ownerId);
    } catch (err) {
      if (err instanceof StayLimitReachedError) {
        return NextResponse.json(toLimitReachedPayload(err), { status: 402 });
      }
      throw err;
    }

    const admin = createAdminClient();

    const { data: rooms, error: roomsError } = await admin
      .from('rooms')
      .select('*')
      .eq('property_id', data.property_id)
      .in('id', data.room_ids);

    if (roomsError) {
      return NextResponse.json({ error: roomsError.message }, { status: 500 });
    }

    if (!rooms || rooms.length !== data.room_ids.length) {
      return NextResponse.json(
        { error: 'One or more selected rooms are invalid for this property' },
        { status: 400 }
      );
    }

    const maxOcc = (rooms as Room[]).reduce((sum, r) => sum + r.max_occupancy, 0);
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
      data.check_out
    );
    if (conflicts.hasConflict) {
      return NextResponse.json(
        { error: 'Selected dates conflict with an existing booking or block' },
        { status: 400 }
      );
    }

    const guestEmail = data.guest_email?.trim().toLowerCase() || null;
    let guestUserId: string | null = null;

    if (guestEmail) {
      const { data: existingUser } = await admin
        .from('users')
        .select('id')
        .eq('email', guestEmail)
        .maybeSingle();
      guestUserId = existingUser?.id ?? null;
    }

    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .insert({
        property_id: data.property_id,
        invitation_id: null,
        guest_user_id: guestUserId,
        guest_first_name: data.guest_first_name,
        guest_last_name: data.guest_last_name ?? null,
        guest_email: guestEmail,
        guest_phone: data.guest_phone?.trim() || null,
        notify_guest: data.notify_guest,
        created_by: user.id,
        status: 'approved',
        party_size: data.party_size,
        notes: data.notes ?? null,
      })
      .select()
      .single();

    if (bookingError || !booking) {
      return NextResponse.json({ error: bookingError?.message }, { status: 500 });
    }

    await incrementHostedStays(ownerId);

    await admin.from('booking_dates').insert({
      booking_id: booking.id,
      check_in: data.check_in,
      check_out: data.check_out,
    });

    await admin.from('booking_rooms').insert(
      data.room_ids.map((room_id) => ({
        booking_id: booking.id,
        room_id,
      }))
    );

    if (data.notify_guest && guestEmail) {
      notifyBookingApproved(booking.id).catch(console.error);
    }

    return NextResponse.json({ booking });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
