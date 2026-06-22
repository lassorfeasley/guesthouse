import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, canManageProperty } from '@/lib/auth';
import { invitationSchema } from '@/lib/validations';
import {
  notifyInvitationSent,
  notifyVisitApproved,
  notifyStayConfirmed,
} from '@/lib/email/notifications';
import { checkRoomConflicts } from '@/lib/visits';
import {
  assertCanSendInvitation,
  getPropertyOwnerId,
  InvitationLimitReachedError,
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
    const { property_id, ...rest } = body;
    const parsed = invitationSchema.safeParse(rest);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const canManage = await canManageProperty(property_id, user.id);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = parsed.data;
    const admin = createAdminClient();

    // For an entire-home invitation, the offer must cover every room in the
    // property so the guest genuinely books the whole place.
    let roomIds = data.room_ids;
    if (data.whole_home) {
      const { data: allRooms } = await admin
        .from('rooms')
        .select('id')
        .eq('property_id', property_id);
      roomIds = (allRooms ?? []).map((r) => r.id);
      if (roomIds.length === 0) {
        return NextResponse.json(
          { error: 'Add at least one room before offering the entire home' },
          { status: 400 }
        );
      }
    }

    // Pre-approved stays still record an invitation (kept "accepted" so guest
    // emails can deep-link back into the app), but skip the acceptance flow and
    // create the confirmed booking immediately.
    const preApproved = data.pre_approved === true;
    const window = data.windows?.[0];

    if (preApproved && !window) {
      return NextResponse.json(
        { error: 'A fixed stay date is required to request a visit directly' },
        { status: 400 }
      );
    }

    const ownerId = await getPropertyOwnerId(property_id);

    try {
      await assertCanSendInvitation(ownerId);
    } catch (err) {
      if (err instanceof InvitationLimitReachedError) {
        return NextResponse.json(toLimitReachedPayload(err), { status: 402 });
      }
      throw err;
    }

    const { data: invitation, error } = await admin
      .from('invitations')
      .insert({
        property_id,
        guest_email: data.guest_email.toLowerCase(),
        guest_first_name: data.guest_first_name ?? null,
        guest_last_name: data.guest_last_name ?? null,
        relationship: data.relationship?.trim() || null,
        type: data.type,
        message: data.message ?? null,
        requires_approval: preApproved ? false : data.requires_approval,
        whole_home: data.whole_home ?? false,
        expires_at: data.expires_at ?? null,
        created_by: user.id,
        status: preApproved ? 'accepted' : 'pending',
      })
      .select()
      .single();

    if (error || !invitation) {
      return NextResponse.json({ error: error?.message }, { status: 500 });
    }

    await admin.from('invitation_rooms').insert(
      roomIds.map((room_id) => ({
        invitation_id: invitation.id,
        room_id,
      }))
    );

    if (data.windows && data.windows.length > 0) {
      await admin.from('invitation_windows').insert(
        data.windows.map((w) => ({
          invitation_id: invitation.id,
          start_date: w.start_date,
          end_date: w.end_date,
        }))
      );
    }

    if (preApproved && window) {
      return bookPreApprovedStay({
        admin,
        invitationId: invitation.id,
        propertyId: property_id,
        createdBy: user.id,
        guestEmail: data.guest_email.toLowerCase(),
        guestFirstName: data.guest_first_name ?? null,
        guestLastName: data.guest_last_name ?? null,
        relationship: data.relationship?.trim() || null,
        roomIds,
        partySize: data.party_size ?? 1,
        checkIn: window.start_date,
        checkOut: window.end_date,
      });
    }

    let emailSent = true;
    let emailError: string | undefined;
    try {
      await notifyInvitationSent(invitation.id);
    } catch (err) {
      emailSent = false;
      emailError =
        err instanceof Error ? err.message : 'Failed to send invitation email';
      console.error(err);
    }

    return NextResponse.json({ invitation, emailSent, emailError });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

interface PreApprovedStayArgs {
  admin: ReturnType<typeof createAdminClient>;
  invitationId: string;
  propertyId: string;
  createdBy: string;
  guestEmail: string;
  guestFirstName: string | null;
  guestLastName: string | null;
  relationship: string | null;
  roomIds: string[];
  partySize: number;
  checkIn: string;
  checkOut: string;
}

/**
 * Creates a confirmed booking on behalf of a guest the host has already
 * coordinated with. The invitation row already exists (and is "accepted"); on
 * failure we revoke it so it doesn't linger as a dead accepted invite.
 */
async function bookPreApprovedStay(args: PreApprovedStayArgs) {
  const {
    admin,
    invitationId,
    propertyId,
    createdBy,
    guestEmail,
    guestFirstName,
    guestLastName,
    relationship,
    roomIds,
    partySize,
    checkIn,
    checkOut,
  } = args;

  async function rollback() {
    await admin.from('invitations').update({ status: 'revoked' }).eq('id', invitationId);
  }

  if (new Date(checkOut) <= new Date(checkIn)) {
    await rollback();
    return NextResponse.json(
      { error: 'Check-out must be after check-in' },
      { status: 400 }
    );
  }

  const { data: rooms } = await admin
    .from('rooms')
    .select('*')
    .eq('property_id', propertyId)
    .in('id', roomIds);

  if (!rooms || rooms.length !== roomIds.length) {
    await rollback();
    return NextResponse.json(
      { error: 'One or more selected rooms are invalid for this property' },
      { status: 400 }
    );
  }

  const maxOcc = (rooms as Room[]).reduce((sum, r) => sum + r.max_occupancy, 0);
  if (partySize > maxOcc) {
    await rollback();
    return NextResponse.json(
      { error: `Party size exceeds maximum occupancy (${maxOcc}) for selected rooms` },
      { status: 400 }
    );
  }

  const conflicts = await checkRoomConflicts(roomIds, checkIn, checkOut);
  if (conflicts.hasConflict) {
    await rollback();
    return NextResponse.json(
      { error: 'Selected dates conflict with an existing visit or block' },
      { status: 400 }
    );
  }

  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', guestEmail)
    .maybeSingle();

  const { data: visit, error: visitError } = await admin
    .from('visits')
    .insert({
      invitation_id: invitationId,
      property_id: propertyId,
      guest_user_id: existingUser?.id ?? null,
      guest_first_name: guestFirstName,
      guest_last_name: guestLastName,
      guest_email: guestEmail,
      relationship,
      notify_guest: true,
      created_by: createdBy,
      status: 'approved',
      party_size: partySize,
      notes: null,
    })
    .select()
    .single();

  if (visitError || !visit) {
    await rollback();
    return NextResponse.json(
      { error: visitError?.message ?? 'Failed to create visit' },
      { status: 500 }
    );
  }

  await admin.from('visit_dates').insert({
    visit_id: visit.id,
    check_in: checkIn,
    check_out: checkOut,
  });

  await admin.from('visit_rooms').insert(
    roomIds.map((room_id) => ({ visit_id: visit.id, room_id }))
  );

  notifyVisitApproved(visit.id).catch(console.error);
  notifyStayConfirmed(visit.id).catch(console.error);

  return NextResponse.json({ invitation_id: invitationId, visit, preApproved: true });
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { invitation_id, action } = await request.json();
    const admin = createAdminClient();

    const { data: invitation } = await admin
      .from('invitations')
      .select('*')
      .eq('id', invitation_id)
      .single();

    if (!invitation) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const canManage = await canManageProperty(invitation.property_id, user.id);
    if (!canManage) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (action === 'revoke') {
      await admin
        .from('invitations')
        .update({ status: 'revoked' })
        .eq('id', invitation_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
