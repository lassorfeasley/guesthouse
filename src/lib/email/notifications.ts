import { sendEmail, logNotification, appUrl } from '@/lib/email/send';
import { generateIcs } from '@/lib/ical';
import { formatDateRange, formatDate } from '@/lib/dates';
import { inviteUrl } from '@/lib/invitations';
import { buildAuthenticatedInviteUrl } from '@/lib/auth-links';
import { getBookingWithDetails } from '@/lib/bookings';
import { createAdminClient } from '@/lib/supabase/admin';
import { wantsEmail } from '@/lib/notification-prefs';
import { unsubscribePageUrl, listUnsubscribeHeaders } from '@/lib/unsubscribe';
import type { BookingWithDetails, NotificationPrefs } from '@/types/database';

async function getUserPrefs(
  userId: string
): Promise<NotificationPrefs | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from('users')
    .select('notification_prefs')
    .eq('id', userId)
    .maybeSingle();
  return (data?.notification_prefs as NotificationPrefs) ?? null;
}

/**
 * Resolves whether a guest stay-reminder may send, plus the unsubscribe link
 * and one-click headers to attach. Guests without an account can't set prefs,
 * so they always receive (and get no unsubscribe link).
 */
async function guestReminderDelivery(guestId: string | null): Promise<{
  ok: boolean;
  unsubscribeUrl?: string;
  headers?: Record<string, string>;
}> {
  if (!guestId) return { ok: true };
  const prefs = await getUserPrefs(guestId);
  if (!wantsEmail(prefs, 'guest_reminders')) return { ok: false };
  return {
    ok: true,
    unsubscribeUrl: unsubscribePageUrl(guestId, 'guest_reminders'),
    headers: listUnsubscribeHeaders(guestId, 'guest_reminders'),
  };
}

import InvitationSentEmail from '../../../emails/invitation-sent';
import StayRequestedEmail from '../../../emails/stay-requested';
import BookingApprovedEmail from '../../../emails/booking-approved';
import BookingDeclinedEmail from '../../../emails/booking-declined';
import BookingCancelledEmail from '../../../emails/booking-cancelled';
import TripReminderEmail from '../../../emails/trip-reminder';
import InvitationExpiringEmail from '../../../emails/invitation-expiring';
import CheckoutInstructionsEmail from '../../../emails/checkout-instructions';
import PostStayThankYouEmail from '../../../emails/post-stay-thankyou';
import StayBookedEmail from '../../../emails/stay-booked';
import RequestReceivedEmail from '../../../emails/request-received';
import ArrivalWelcomeEmail from '../../../emails/arrival-welcome';

export async function notifyInvitationSent(invitationId: string) {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from('invitations')
    .select('*, property:properties(name)')
    .eq('id', invitationId)
    .single();

  if (!inv) return;

  const signInUrl = await buildAuthenticatedInviteUrl(
    admin,
    inv.guest_email,
    inv.token
  );

  await sendEmail({
    to: inv.guest_email,
    subject: `You're invited to ${inv.property.name}`,
    react: InvitationSentEmail({
      guestName: inv.guest_name ?? inv.guest_email.split('@')[0],
      propertyName: inv.property.name,
      inviteUrl: signInUrl,
      message: inv.message ?? undefined,
      expiresAt: inv.expires_at
        ? formatDate(inv.expires_at)
        : undefined,
    }),
  });

  await logNotification({ invitationId, type: 'invitation_sent' });
}

export async function notifyStayRequested(bookingId: string) {
  const booking = await getBookingWithDetails(bookingId);
  if (!booking) return;

  const admin = createAdminClient();
  const { data: property } = await admin
    .from('properties')
    .select('*, owner:users!owner_id(*)')
    .eq('id', booking.property_id)
    .single();

  if (!property) return;

  const { data: managers } = await admin
    .from('property_managers')
    .select('user:users(id, email, notification_prefs)')
    .eq('property_id', booking.property_id);

  type HostRecipient = {
    id: string;
    email: string;
    notification_prefs?: NotificationPrefs;
  };

  const recipients = new Map<string, HostRecipient>();
  const ownerRaw = property.owner;
  const owner = (Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw) as HostRecipient;
  if (wantsEmail(owner.notification_prefs, 'booking_requests')) {
    recipients.set(owner.id, owner);
  }

  for (const m of managers ?? []) {
    const userRaw = m.user;
    const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as HostRecipient;
    if (wantsEmail(user.notification_prefs, 'booking_requests')) {
      recipients.set(user.id, user);
    }
  }

  const base = appUrl();
  const dates = formatDateRange(booking.dates.check_in, booking.dates.check_out);
  const rooms = booking.rooms.map((r) => r.name).join(', ');

  const guestLabel =
    booking.guest.name ?? booking.guest.email ?? 'A guest';

  for (const recipient of recipients.values()) {
    await sendEmail({
      to: recipient.email,
      subject: `Stay request from ${guestLabel}`,
      react: StayRequestedEmail({
        guestName: guestLabel,
        propertyName: booking.property.name,
        dates,
        rooms,
        partySize: booking.party_size,
        notes: booking.notes ?? undefined,
        approveUrl: `${base}/dashboard/${booking.property.slug}/requests?booking=${bookingId}&action=approve`,
        declineUrl: `${base}/dashboard/${booking.property.slug}/requests?booking=${bookingId}&action=decline`,
        unsubscribeUrl: unsubscribePageUrl(recipient.id, 'host_activity'),
      }),
      headers: listUnsubscribeHeaders(recipient.id, 'host_activity'),
    });
  }

  await logNotification({ bookingId, type: 'stay_requested' });
}

/**
 * Tells hosts a booking was created on the auto-approve path (no request to
 * act on — purely informational so bookings never appear silently).
 */
export async function notifyStayBooked(bookingId: string) {
  const booking = await getBookingWithDetails(bookingId);
  if (!booking) return;

  const admin = createAdminClient();
  const { data: property } = await admin
    .from('properties')
    .select('*, owner:users!owner_id(*)')
    .eq('id', booking.property_id)
    .single();

  if (!property) return;

  const { data: managers } = await admin
    .from('property_managers')
    .select('user:users(id, email, notification_prefs)')
    .eq('property_id', booking.property_id);

  type HostRecipient = {
    id: string;
    email: string;
    notification_prefs?: NotificationPrefs;
  };

  const recipients = new Map<string, HostRecipient>();
  const ownerRaw = property.owner;
  const owner = (Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw) as HostRecipient;
  if (wantsEmail(owner.notification_prefs, 'booking_requests')) {
    recipients.set(owner.id, owner);
  }

  for (const m of managers ?? []) {
    const userRaw = m.user;
    const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as HostRecipient;
    if (wantsEmail(user.notification_prefs, 'booking_requests')) {
      recipients.set(user.id, user);
    }
  }

  const base = appUrl();
  const dates = formatDateRange(booking.dates.check_in, booking.dates.check_out);
  const rooms = booking.rooms.map((r) => r.name).join(', ');
  const guestLabel = booking.guest.name ?? booking.guest.email ?? 'A guest';

  for (const recipient of recipients.values()) {
    await sendEmail({
      to: recipient.email,
      subject: `${guestLabel} booked a stay at ${booking.property.name}`,
      react: StayBookedEmail({
        guestName: guestLabel,
        propertyName: booking.property.name,
        dates,
        rooms,
        partySize: booking.party_size,
        notes: booking.notes ?? undefined,
        bookingUrl: `${base}/dashboard/${booking.property.slug}/bookings/${bookingId}`,
        unsubscribeUrl: unsubscribePageUrl(recipient.id, 'host_activity'),
      }),
      headers: listUnsubscribeHeaders(recipient.id, 'host_activity'),
    });
  }

  await logNotification({ bookingId, type: 'stay_booked' });
}

/**
 * Receipt to the guest right after they submit a request that needs host
 * approval. Mandatory (a confirmation of their own action), so no unsubscribe.
 */
export async function notifyRequestReceived(bookingId: string) {
  const booking = await getBookingWithDetails(bookingId);
  if (!booking || !booking.notify_guest || !booking.guest.email) return;

  await sendEmail({
    to: booking.guest.email,
    subject: `Your request for ${booking.property.name} is in`,
    react: RequestReceivedEmail({
      guestName: booking.guest.name ?? 'there',
      propertyName: booking.property.name,
      dates: formatDateRange(booking.dates.check_in, booking.dates.check_out),
      rooms: booking.rooms.map((r) => r.name).join(', '),
    }),
  });

  await logNotification({
    userId: booking.guest_user_id ?? undefined,
    bookingId,
    type: 'request_received',
  });
}

export async function notifyBookingApproved(bookingId: string) {
  const booking = await getBookingWithDetails(bookingId);
  if (!booking || !booking.notify_guest || !booking.guest.email) return;

  const icsContent = generateIcs(booking);
  const dates = formatDateRange(booking.dates.check_in, booking.dates.check_out);
  const rooms = booking.rooms.map((r) => r.name).join(', ');

  const { getCoGuestsForDates } = await import('@/lib/coguests');
  const coguests = await getCoGuestsForDates(
    booking.property_id,
    booking.dates.check_in,
    booking.dates.check_out,
    booking.guest_user_id ?? undefined
  );
  let coguestNote: string | undefined;
  if (coguests.visible.length > 0) {
    const names = coguests.visible.map((g) => g.label).join(', ');
    coguestNote = `Others staying during your dates: ${names}${coguests.hasHidden ? ' and others' : ''}.`;
  }

  await sendEmail({
    to: booking.guest.email,
    subject: `Your stay at ${booking.property.name} is confirmed`,
    react: BookingApprovedEmail({
      guestName: booking.guest.name ?? 'there',
      propertyName: booking.property.name,
      dates,
      rooms,
      address: booking.property.address ?? undefined,
      directions: booking.property.directions ?? undefined,
      wifiName: booking.property.wifi_name ?? undefined,
      wifiPassword: booking.property.wifi_password ?? undefined,
      checkIn: booking.property.check_in_instructions ?? undefined,
      houseRules: booking.property.house_rules ?? undefined,
      coguestNote,
      profileUrl: booking.invitation
        ? inviteUrl(booking.invitation.token)
        : undefined,
    }),
    attachments: [
      {
        filename: 'stay.ics',
        content: Buffer.from(icsContent),
      },
    ],
  });

  await logNotification({
    userId: booking.guest_user_id ?? undefined,
    bookingId,
    type: 'booking_approved',
  });
}

export async function notifyBookingDeclined(
  bookingId: string,
  declineMessage?: string
) {
  const booking = await getBookingWithDetails(bookingId);
  if (!booking || !booking.guest.email || !booking.invitation) return;

  await sendEmail({
    to: booking.guest.email,
    subject: `Stay request declined — ${booking.property.name}`,
    react: BookingDeclinedEmail({
      guestName: booking.guest.name ?? 'there',
      propertyName: booking.property.name,
      dates: formatDateRange(booking.dates.check_in, booking.dates.check_out),
      message: declineMessage,
      inviteUrl: inviteUrl(booking.invitation.token),
    }),
  });

  await logNotification({
    userId: booking.guest_user_id ?? undefined,
    bookingId,
    type: 'booking_declined',
  });
}

export async function notifyBookingCancelled(
  bookingId: string,
  cancelledBy: 'guest' | 'owner'
) {
  const booking = await getBookingWithDetails(bookingId);
  if (!booking) return;

  const admin = createAdminClient();
  const { data: property } = await admin
    .from('properties')
    .select('*, owner:users!owner_id(*)')
    .eq('id', booking.property_id)
    .single();

  if (!property) return;

  const dates = formatDateRange(booking.dates.check_in, booking.dates.check_out);
  const guestName =
    booking.guest.name ?? booking.guest.email ?? 'Guest';

  if (cancelledBy === 'guest') {
    const ownerRaw = property.owner;
    const owner = (Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw) as {
      id: string;
      email: string;
      name: string | null;
      notification_prefs?: NotificationPrefs;
    };
    // Host copy is an opt-out activity notification.
    if (wantsEmail(owner.notification_prefs, 'booking_cancelled')) {
      await sendEmail({
        to: owner.email,
        subject: `${guestName} cancelled their stay`,
        react: BookingCancelledEmail({
          recipientName: owner.name ?? 'there',
          guestName,
          propertyName: booking.property.name,
          dates,
          cancelledBy: 'guest',
          unsubscribeUrl: unsubscribePageUrl(owner.id, 'host_activity'),
        }),
        headers: listUnsubscribeHeaders(owner.id, 'host_activity'),
      });
    }
  } else if (booking.notify_guest && booking.guest.email) {
    // Guest copy is mandatory — they must know their stay was cancelled.
    await sendEmail({
      to: booking.guest.email,
      subject: `Your stay at ${booking.property.name} was cancelled`,
      react: BookingCancelledEmail({
        recipientName: booking.guest.name ?? 'there',
        guestName,
        propertyName: booking.property.name,
        dates,
        cancelledBy: 'owner',
      }),
    });
  }

  await logNotification({ bookingId, type: `booking_cancelled_${cancelledBy}` });
}

export async function notifyTripReminder(
  booking: BookingWithDetails,
  daysUntil: number
) {
  if (!booking.notify_guest || !booking.guest.email) return;

  const delivery = await guestReminderDelivery(booking.guest.id);
  if (!delivery.ok) return;

  const type = daysUntil <= 1 ? 'reminder_1d' : 'reminder_7d';

  await sendEmail({
    to: booking.guest.email,
    subject:
      daysUntil <= 1
        ? `Tomorrow: your stay at ${booking.property.name}`
        : `One week until your stay at ${booking.property.name}`,
    react: TripReminderEmail({
      guestName: booking.guest.name ?? 'there',
      propertyName: booking.property.name,
      dates: formatDateRange(booking.dates.check_in, booking.dates.check_out),
      daysUntil,
      checkIn: booking.property.check_in_instructions ?? undefined,
      address: booking.property.address ?? undefined,
      wifiName: booking.property.wifi_name ?? undefined,
      wifiPassword: booking.property.wifi_password ?? undefined,
      profileUrl: booking.invitation
        ? inviteUrl(booking.invitation.token)
        : undefined,
      unsubscribeUrl: delivery.unsubscribeUrl,
    }),
    headers: delivery.headers,
  });

  await logNotification({
    userId: booking.guest_user_id ?? undefined,
    bookingId: booking.id,
    type,
  });
}

export async function notifyArrivalWelcome(booking: BookingWithDetails) {
  if (!booking.notify_guest || !booking.guest.email) return;

  const delivery = await guestReminderDelivery(booking.guest.id);
  if (!delivery.ok) return;

  await sendEmail({
    to: booking.guest.email,
    subject: `Today's the day — welcome to ${booking.property.name}`,
    react: ArrivalWelcomeEmail({
      guestName: booking.guest.name ?? 'there',
      propertyName: booking.property.name,
      checkIn: booking.property.check_in_instructions ?? undefined,
      address: booking.property.address ?? undefined,
      directions: booking.property.directions ?? undefined,
      wifiName: booking.property.wifi_name ?? undefined,
      wifiPassword: booking.property.wifi_password ?? undefined,
      profileUrl: booking.invitation
        ? inviteUrl(booking.invitation.token)
        : undefined,
      unsubscribeUrl: delivery.unsubscribeUrl,
    }),
    headers: delivery.headers,
  });

  await logNotification({
    userId: booking.guest_user_id ?? undefined,
    bookingId: booking.id,
    type: 'arrival_welcome',
  });
}

export async function notifyCheckoutInstructions(booking: BookingWithDetails) {
  if (!booking.notify_guest || !booking.guest.email) return;

  const delivery = await guestReminderDelivery(booking.guest.id);
  if (!delivery.ok) return;

  await sendEmail({
    to: booking.guest.email,
    subject: `Checkout details for ${booking.property.name}`,
    react: CheckoutInstructionsEmail({
      guestName: booking.guest.name ?? 'there',
      propertyName: booking.property.name,
      checkoutTime: booking.property.checkout_time ?? undefined,
      checkoutInstructions: booking.property.checkout_instructions ?? undefined,
      houseRules: booking.property.house_rules ?? undefined,
      unsubscribeUrl: delivery.unsubscribeUrl,
    }),
    headers: delivery.headers,
  });

  await logNotification({
    userId: booking.guest_user_id ?? undefined,
    bookingId: booking.id,
    type: 'checkout_instructions',
  });
}

export async function notifyPostStay(booking: BookingWithDetails) {
  if (!booking.notify_guest || !booking.guest.email) return;

  const delivery = await guestReminderDelivery(booking.guest.id);
  if (!delivery.ok) return;

  await sendEmail({
    to: booking.guest.email,
    subject: `Thanks for staying at ${booking.property.name}`,
    react: PostStayThankYouEmail({
      guestName: booking.guest.name ?? 'there',
      propertyName: booking.property.name,
      profileUrl: booking.invitation
        ? inviteUrl(booking.invitation.token)
        : undefined,
      unsubscribeUrl: delivery.unsubscribeUrl,
    }),
    headers: delivery.headers,
  });

  await logNotification({
    userId: booking.guest_user_id ?? undefined,
    bookingId: booking.id,
    type: 'post_stay',
  });
}

export async function notifyInvitationsExpiring(
  ownerId: string,
  ownerEmail: string,
  ownerName: string,
  invitations: { guestName: string; propertyName: string; expiresAt: string }[]
) {
  await sendEmail({
    to: ownerEmail,
    subject: 'Invitations expiring in 48 hours',
    react: InvitationExpiringEmail({
      ownerName,
      invitations,
      dashboardUrl: `${appUrl()}/dashboard`,
      unsubscribeUrl: unsubscribePageUrl(ownerId, 'host_activity'),
    }),
    headers: listUnsubscribeHeaders(ownerId, 'host_activity'),
  });
}
