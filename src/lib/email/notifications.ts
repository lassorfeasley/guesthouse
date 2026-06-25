import { logNotification, appUrl } from '@/lib/email/send';
import { enqueueEmail } from '@/lib/email/outbox';
import { buildVisitEvent, generateIcs } from '@/lib/ical';
import { googleCalendarUrl, outlookCalendarUrl } from '@/lib/calendar-links';
import { formatDateRange, formatDate } from '@/lib/dates';
import { inviteUrl, inviteSignInUrl } from '@/lib/invitations';
import {
  FINAL_INVITE_REMINDER_STEP,
  inviteReminderLogType,
  type InviteReminderStep,
} from '@/lib/invite-reminders';
import { buildHostOnboardingUrl } from '@/lib/auth-links';
import { userManagesAnyProperty } from '@/lib/auth';
import { getVisitWithDetails } from '@/lib/visits';
import { createAdminClient } from '@/lib/supabase/admin';
import { wantsEmail } from '@/lib/notification-prefs';
import { unsubscribePageUrl, listUnsubscribeHeaders } from '@/lib/unsubscribe';
import { formatPersonName } from '@/lib/names';
import type { VisitWithDetails, NotificationPrefs } from '@/types/database';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Props for the discreet "become a host" footer on guest relationship emails.
 * Suppresses the aside for anyone who already hosts; otherwise mints an
 * authenticated onboarding link so the home they open attaches to this same
 * account. Best-effort — never blocks the email if lookups fail.
 */
async function hostInviteFooterProps(
  admin: AdminClient,
  email: string | null | undefined
): Promise<{ recipientIsHost: boolean; hostOnboardingUrl?: string }> {
  if (!email) return { recipientIsHost: true };
  try {
    const normalized = email.toLowerCase();
    const { data: user } = await admin
      .from('users')
      .select('id')
      .eq('email', normalized)
      .maybeSingle();

    if (user?.id && (await userManagesAnyProperty(user.id))) {
      return { recipientIsHost: true };
    }

    return {
      recipientIsHost: false,
      hostOnboardingUrl: await buildHostOnboardingUrl(admin, normalized),
    };
  } catch {
    // On any failure, err toward not showing the aside.
    return { recipientIsHost: true };
  }
}

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
 * Resolves whether a guest visit-reminder may send, plus the unsubscribe link
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
import InviteReminderEmail from '../../../emails/invite-reminder';
import InviteStalledHostEmail from '../../../emails/invite-stalled-host';
import VisitRequestedEmail from '../../../emails/visit-requested';
import VisitApprovedEmail from '../../../emails/visit-approved';
import VisitDeclinedEmail from '../../../emails/visit-declined';
import VisitCancelledEmail from '../../../emails/visit-cancelled';
import VisitReminderEmail from '../../../emails/visit-reminder';
import InvitationExpiringEmail from '../../../emails/invitation-expiring';
import CheckoutInstructionsEmail from '../../../emails/checkout-instructions';
import PostVisitThankYouEmail from '../../../emails/post-visit-thankyou';
import VisitConfirmedEmail from '../../../emails/visit-confirmed';
import RequestReceivedEmail from '../../../emails/request-received';
import ArrivalWelcomeEmail from '../../../emails/arrival-welcome';

export async function notifyInvitationSent(invitationId: string) {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from('invitations')
    .select(
      '*, property:properties(name, hero_image_url), creator:users!created_by(first_name, last_name, email)'
    )
    .eq('id', invitationId)
    .single();

  if (!inv) return;

  const signInUrl = inviteSignInUrl(inv.token);

  const hostFooter = await hostInviteFooterProps(admin, inv.guest_email);

  const creatorRaw = inv.creator;
  const creator = (Array.isArray(creatorRaw) ? creatorRaw[0] : creatorRaw) as {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  // Only personalize with an actual name — "bob@x.com via Gracious" is worse
  // than the plain brand sender.
  const hostName = formatPersonName(
    creator ? { ...creator, email: null } : null
  );

  await enqueueEmail({
    to: inv.guest_email,
    subject: hostName
      ? `${hostName} has invited you to ${inv.property.name}`
      : `You're invited to ${inv.property.name}`,
    react: InvitationSentEmail({
      guestName: inv.guest_name ?? inv.guest_email.split('@')[0],
      hostName,
      propertyName: inv.property.name,
      inviteUrl: signInUrl,
      message: inv.message ?? undefined,
      expiresAt: inv.expires_at
        ? formatDate(inv.expires_at)
        : undefined,
      heroImageUrl: inv.property.hero_image_url ?? undefined,
      recipientIsHost: hostFooter.recipientIsHost,
      hostOnboardingUrl: hostFooter.hostOnboardingUrl,
    }),
    fromName: hostName,
    // Guests can reply straight to their host.
    replyTo: creator?.email ?? undefined,
  });

  await logNotification({ invitationId, type: 'invitation_sent' });
}

/**
 * A drip reminder to a guest who hasn't responded to their invitation yet.
 * Mirrors `notifyInvitationSent` (re-mints the one-click sign-in link, sends as
 * the host) but with nudge copy that escalates on the final step. Transactional
 * — the host personally invited them, so there's no opt-out, same as the
 * original invite. Caller is responsible for only sending while the invitation
 * is still `pending` and unexpired.
 */
export async function notifyInviteReminder(
  invitationId: string,
  step: InviteReminderStep
) {
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from('invitations')
    .select(
      '*, property:properties(name, hero_image_url), creator:users!created_by(first_name, last_name, email)'
    )
    .eq('id', invitationId)
    .single();

  if (!inv) return;

  const signInUrl = inviteSignInUrl(inv.token);

  const hostFooter = await hostInviteFooterProps(admin, inv.guest_email);

  const creatorRaw = inv.creator;
  const creator = (Array.isArray(creatorRaw) ? creatorRaw[0] : creatorRaw) as {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
  const hostName = formatPersonName(
    creator ? { ...creator, email: null } : null
  );

  const isFinal = step >= FINAL_INVITE_REMINDER_STEP;
  const subject = isFinal
    ? `Last reminder: your invite to ${inv.property.name}`
    : hostName
      ? `Reminder: ${hostName} invited you to ${inv.property.name}`
      : `Reminder: you're invited to ${inv.property.name}`;

  await enqueueEmail({
    to: inv.guest_email,
    subject,
    react: InviteReminderEmail({
      guestName: inv.guest_name ?? inv.guest_email.split('@')[0],
      hostName: hostName ?? undefined,
      propertyName: inv.property.name,
      inviteUrl: signInUrl,
      message: inv.message ?? undefined,
      expiresAt: inv.expires_at ? formatDate(inv.expires_at) : undefined,
      heroImageUrl: inv.property.hero_image_url ?? undefined,
      step,
      recipientIsHost: hostFooter.recipientIsHost,
      hostOnboardingUrl: hostFooter.hostOnboardingUrl,
    }),
    fromName: hostName,
    replyTo: creator?.email ?? undefined,
  });

  await logNotification({ invitationId, type: inviteReminderLogType(step) });
}

/**
 * A per-host digest for invitations that have gone quiet after the full guest
 * drip — nudging the host to share the link directly (text/message). Grouped
 * one email per host. Logging the per-invitation `invite_host_nudge` rows is the
 * caller's job (so the cron can dedup), since one email can cover several invites.
 */
export async function notifyInviteStalled(
  ownerId: string,
  ownerEmail: string,
  ownerName: string,
  invitations: {
    guestName: string;
    guestEmail: string;
    propertyName: string;
    inviteUrl: string;
  }[]
) {
  await enqueueEmail({
    to: ownerEmail,
    subject:
      invitations.length > 1
        ? "Some guests haven't opened their invite"
        : "A guest hasn't opened their invite",
    react: InviteStalledHostEmail({
      ownerName,
      invitations,
      dashboardUrl: `${appUrl()}/dashboard`,
      unsubscribeUrl: unsubscribePageUrl(ownerId, 'host_activity'),
    }),
    headers: listUnsubscribeHeaders(ownerId, 'host_activity'),
  });
}

export async function notifyVisitRequested(visitId: string) {
  const visit = await getVisitWithDetails(visitId);
  if (!visit) return;

  const admin = createAdminClient();
  const { data: property } = await admin
    .from('properties')
    .select('*, owner:users!owner_id(*)')
    .eq('id', visit.property_id)
    .single();

  if (!property) return;

  const { data: managers } = await admin
    .from('property_managers')
    .select('user:users(id, email, notification_prefs)')
    .eq('property_id', visit.property_id);

  type HostRecipient = {
    id: string;
    email: string;
    notification_prefs?: NotificationPrefs;
  };

  const recipients = new Map<string, HostRecipient>();
  const ownerRaw = property.owner;
  const owner = (Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw) as HostRecipient;
  if (wantsEmail(owner.notification_prefs, 'visit_requests')) {
    recipients.set(owner.id, owner);
  }

  for (const m of managers ?? []) {
    const userRaw = m.user;
    const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as HostRecipient;
    if (wantsEmail(user.notification_prefs, 'visit_requests')) {
      recipients.set(user.id, user);
    }
  }

  const base = appUrl();
  const rooms = visit.rooms.map((r) => r.name).join(', ');

  const guestLabel =
    visit.guest.name ?? visit.guest.email ?? 'A guest';

  for (const recipient of recipients.values()) {
    await enqueueEmail({
      to: recipient.email,
      subject: `Visit request from ${guestLabel}`,
      react: VisitRequestedEmail({
        guestName: guestLabel,
        propertyName: visit.property.name,
        checkInDate: visit.dates.check_in,
        checkOutDate: visit.dates.check_out,
        rooms,
        partySize: visit.party_size,
        notes: visit.notes ?? undefined,
        approveUrl: `${base}/dashboard/${visit.property.slug}/requests?visit=${visitId}&action=approve`,
        declineUrl: `${base}/dashboard/${visit.property.slug}/requests?visit=${visitId}&action=decline`,
        unsubscribeUrl: unsubscribePageUrl(recipient.id, 'host_activity'),
      }),
      headers: listUnsubscribeHeaders(recipient.id, 'host_activity'),
      // Hosts can reply straight to the guest to ask a question.
      replyTo: visit.guest.email ?? undefined,
    });
  }

  await logNotification({ visitId, type: 'visit_requested' });
}

/**
 * Tells hosts a visit was created on the auto-approve path (no request to
 * act on — purely informational so visits never appear silently).
 */
export async function notifyVisitConfirmed(visitId: string) {
  const visit = await getVisitWithDetails(visitId);
  if (!visit) return;

  const admin = createAdminClient();
  const { data: property } = await admin
    .from('properties')
    .select('*, owner:users!owner_id(*)')
    .eq('id', visit.property_id)
    .single();

  if (!property) return;

  const { data: managers } = await admin
    .from('property_managers')
    .select('user:users(id, email, notification_prefs)')
    .eq('property_id', visit.property_id);

  type HostRecipient = {
    id: string;
    email: string;
    notification_prefs?: NotificationPrefs;
  };

  const recipients = new Map<string, HostRecipient>();
  const ownerRaw = property.owner;
  const owner = (Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw) as HostRecipient;
  if (wantsEmail(owner.notification_prefs, 'visit_requests')) {
    recipients.set(owner.id, owner);
  }

  for (const m of managers ?? []) {
    const userRaw = m.user;
    const user = (Array.isArray(userRaw) ? userRaw[0] : userRaw) as HostRecipient;
    if (wantsEmail(user.notification_prefs, 'visit_requests')) {
      recipients.set(user.id, user);
    }
  }

  const base = appUrl();
  const rooms = visit.rooms.map((r) => r.name).join(', ');
  const guestLabel = visit.guest.name ?? visit.guest.email ?? 'A guest';

  for (const recipient of recipients.values()) {
    await enqueueEmail({
      to: recipient.email,
      subject: `${guestLabel} booked a visit at ${visit.property.name}`,
      react: VisitConfirmedEmail({
        guestName: guestLabel,
        propertyName: visit.property.name,
        checkInDate: visit.dates.check_in,
        checkOutDate: visit.dates.check_out,
        rooms,
        partySize: visit.party_size,
        notes: visit.notes ?? undefined,
        visitUrl: `${base}/dashboard/${visit.property.slug}/visits/${visitId}`,
        unsubscribeUrl: unsubscribePageUrl(recipient.id, 'host_activity'),
      }),
      headers: listUnsubscribeHeaders(recipient.id, 'host_activity'),
      // Hosts can reply straight to the guest.
      replyTo: visit.guest.email ?? undefined,
    });
  }

  await logNotification({ visitId, type: 'visit_booked' });
}

/**
 * Receipt to the guest right after they submit a request that needs host
 * approval. Mandatory (a confirmation of their own action), so no unsubscribe.
 */
export async function notifyRequestReceived(visitId: string) {
  const visit = await getVisitWithDetails(visitId);
  if (!visit || !visit.notify_guest || !visit.guest.email) return;

  await enqueueEmail({
    to: visit.guest.email,
    subject: `Your request for ${visit.property.name} is in`,
    react: RequestReceivedEmail({
      guestName: visit.guest.name ?? 'there',
      propertyName: visit.property.name,
      checkInDate: visit.dates.check_in,
      checkOutDate: visit.dates.check_out,
      rooms: visit.rooms.map((r) => r.name).join(', '),
    }),
  });

  await logNotification({
    userId: visit.guest_user_id ?? undefined,
    visitId,
    type: 'request_received',
  });
}

export async function notifyVisitApproved(visitId: string) {
  const visit = await getVisitWithDetails(visitId);
  if (!visit || !visit.notify_guest || !visit.guest.email) return;

  const icsContent = generateIcs(visit);
  const visitEvent = buildVisitEvent(visit);
  const rooms = visit.rooms.map((r) => r.name).join(', ');

  const { getCoGuestsForDates } = await import('@/lib/coguests');
  const coguests = await getCoGuestsForDates(
    visit.property_id,
    visit.dates.check_in,
    visit.dates.check_out,
    visit.guest_user_id ?? undefined
  );
  let coguestNote: string | undefined;
  if (coguests.visible.length > 0) {
    const names = coguests.visible.map((g) => g.label).join(', ');
    coguestNote = `Others staying during your dates: ${names}${coguests.hasHidden ? ' and others' : ''}.`;
  }

  const admin = createAdminClient();
  const hostFooter = await hostInviteFooterProps(admin, visit.guest.email);

  await enqueueEmail({
    to: visit.guest.email,
    subject: `Your visit at ${visit.property.name} is confirmed`,
    react: VisitApprovedEmail({
      guestName: visit.guest.name ?? 'there',
      propertyName: visit.property.name,
      checkInDate: visit.dates.check_in,
      checkOutDate: visit.dates.check_out,
      partySize: visit.party_size,
      rooms,
      address: visit.property.address ?? undefined,
      directions: visit.property.directions ?? undefined,
      wifiName: visit.property.wifi_name ?? undefined,
      wifiPassword: visit.property.wifi_password ?? undefined,
      checkIn: visit.property.check_in_instructions ?? undefined,
      houseRules: visit.property.house_rules ?? undefined,
      coguestNote,
      hostNote: visit.invitation?.message ?? undefined,
      profileUrl: visit.invitation
        ? inviteUrl(visit.invitation.token)
        : undefined,
      heroImageUrl: visit.property.hero_image_url ?? undefined,
      googleCalendarUrl: googleCalendarUrl(visitEvent),
      outlookCalendarUrl: outlookCalendarUrl(visitEvent),
      recipientIsHost: hostFooter.recipientIsHost,
      hostOnboardingUrl: hostFooter.hostOnboardingUrl,
    }),
    attachments: [
      {
        filename: 'visit.ics',
        content: Buffer.from(icsContent),
      },
    ],
  });

  await logNotification({
    userId: visit.guest_user_id ?? undefined,
    visitId,
    type: 'visit_approved',
  });
}

export async function notifyVisitDeclined(
  visitId: string,
  declineMessage?: string
) {
  const visit = await getVisitWithDetails(visitId);
  if (!visit || !visit.guest.email || !visit.invitation) return;

  await enqueueEmail({
    to: visit.guest.email,
    subject: `Visit request declined — ${visit.property.name}`,
    react: VisitDeclinedEmail({
      guestName: visit.guest.name ?? 'there',
      propertyName: visit.property.name,
      dates: formatDateRange(visit.dates.check_in, visit.dates.check_out),
      message: declineMessage,
      inviteUrl: inviteUrl(visit.invitation.token),
    }),
  });

  await logNotification({
    userId: visit.guest_user_id ?? undefined,
    visitId,
    type: 'visit_declined',
  });
}

export async function notifyVisitCancelled(
  visitId: string,
  cancelledBy: 'guest' | 'owner'
) {
  const visit = await getVisitWithDetails(visitId);
  if (!visit) return;

  const admin = createAdminClient();
  const { data: property } = await admin
    .from('properties')
    .select('*, owner:users!owner_id(*)')
    .eq('id', visit.property_id)
    .single();

  if (!property) return;

  const dates = formatDateRange(visit.dates.check_in, visit.dates.check_out);
  const guestName =
    visit.guest.name ?? visit.guest.email ?? 'Guest';

  if (cancelledBy === 'guest') {
    const ownerRaw = property.owner;
    const owner = (Array.isArray(ownerRaw) ? ownerRaw[0] : ownerRaw) as {
      id: string;
      email: string;
      name: string | null;
      notification_prefs?: NotificationPrefs;
    };
    // Host copy is an opt-out activity notification.
    if (wantsEmail(owner.notification_prefs, 'visit_cancelled')) {
      await enqueueEmail({
        to: owner.email,
        subject: `${guestName} cancelled their visit`,
        react: VisitCancelledEmail({
          recipientName: owner.name ?? 'there',
          guestName,
          propertyName: visit.property.name,
          dates,
          cancelledBy: 'guest',
          unsubscribeUrl: unsubscribePageUrl(owner.id, 'host_activity'),
        }),
        headers: listUnsubscribeHeaders(owner.id, 'host_activity'),
      });
    }
  } else if (visit.notify_guest && visit.guest.email) {
    // Guest copy is mandatory — they must know their visit was cancelled.
    await enqueueEmail({
      to: visit.guest.email,
      subject: `Your visit at ${visit.property.name} was cancelled`,
      react: VisitCancelledEmail({
        recipientName: visit.guest.name ?? 'there',
        guestName,
        propertyName: visit.property.name,
        dates,
        cancelledBy: 'owner',
      }),
    });
  }

  await logNotification({ visitId, type: `visit_cancelled_${cancelledBy}` });
}

export async function notifyVisitReminder(
  visit: VisitWithDetails,
  daysUntil: number
) {
  if (!visit.notify_guest || !visit.guest.email) return;

  const delivery = await guestReminderDelivery(visit.guest.id);
  if (!delivery.ok) return;

  const type = daysUntil <= 1 ? 'reminder_1d' : 'reminder_7d';
  const visitEvent = buildVisitEvent(visit);

  await enqueueEmail({
    to: visit.guest.email,
    subject:
      daysUntil <= 1
        ? `Tomorrow: your visit at ${visit.property.name}`
        : `One week until your visit at ${visit.property.name}`,
    react: VisitReminderEmail({
      guestName: visit.guest.name ?? 'there',
      propertyName: visit.property.name,
      checkInDate: visit.dates.check_in,
      checkOutDate: visit.dates.check_out,
      daysUntil,
      checkIn: visit.property.check_in_instructions ?? undefined,
      address: visit.property.address ?? undefined,
      wifiName: visit.property.wifi_name ?? undefined,
      wifiPassword: visit.property.wifi_password ?? undefined,
      profileUrl: visit.invitation
        ? inviteUrl(visit.invitation.token)
        : undefined,
      unsubscribeUrl: delivery.unsubscribeUrl,
      heroImageUrl: visit.property.hero_image_url ?? undefined,
      googleCalendarUrl: googleCalendarUrl(visitEvent),
      outlookCalendarUrl: outlookCalendarUrl(visitEvent),
    }),
    headers: delivery.headers,
  });

  await logNotification({
    userId: visit.guest_user_id ?? undefined,
    visitId: visit.id,
    type,
  });
}

export async function notifyArrivalWelcome(visit: VisitWithDetails) {
  if (!visit.notify_guest || !visit.guest.email) return;

  const delivery = await guestReminderDelivery(visit.guest.id);
  if (!delivery.ok) return;

  await enqueueEmail({
    to: visit.guest.email,
    subject: `Today's the day — welcome to ${visit.property.name}`,
    react: ArrivalWelcomeEmail({
      guestName: visit.guest.name ?? 'there',
      propertyName: visit.property.name,
      checkIn: visit.property.check_in_instructions ?? undefined,
      address: visit.property.address ?? undefined,
      directions: visit.property.directions ?? undefined,
      wifiName: visit.property.wifi_name ?? undefined,
      wifiPassword: visit.property.wifi_password ?? undefined,
      profileUrl: visit.invitation
        ? inviteUrl(visit.invitation.token)
        : undefined,
      unsubscribeUrl: delivery.unsubscribeUrl,
      heroImageUrl: visit.property.hero_image_url ?? undefined,
    }),
    headers: delivery.headers,
  });

  await logNotification({
    userId: visit.guest_user_id ?? undefined,
    visitId: visit.id,
    type: 'arrival_welcome',
  });
}

export async function notifyCheckoutInstructions(visit: VisitWithDetails) {
  if (!visit.notify_guest || !visit.guest.email) return;

  const delivery = await guestReminderDelivery(visit.guest.id);
  if (!delivery.ok) return;

  await enqueueEmail({
    to: visit.guest.email,
    subject: `Checkout details for ${visit.property.name}`,
    react: CheckoutInstructionsEmail({
      guestName: visit.guest.name ?? 'there',
      propertyName: visit.property.name,
      checkoutTime: visit.property.checkout_time ?? undefined,
      checkoutInstructions: visit.property.checkout_instructions ?? undefined,
      houseRules: visit.property.house_rules ?? undefined,
      unsubscribeUrl: delivery.unsubscribeUrl,
    }),
    headers: delivery.headers,
  });

  await logNotification({
    userId: visit.guest_user_id ?? undefined,
    visitId: visit.id,
    type: 'checkout_instructions',
  });
}

export async function notifyPostVisit(visit: VisitWithDetails) {
  if (!visit.notify_guest || !visit.guest.email) return;

  const delivery = await guestReminderDelivery(visit.guest.id);
  if (!delivery.ok) return;

  const admin = createAdminClient();
  const hostFooter = await hostInviteFooterProps(admin, visit.guest.email);

  await enqueueEmail({
    to: visit.guest.email,
    subject: `Thanks for staying at ${visit.property.name}`,
    react: PostVisitThankYouEmail({
      guestName: visit.guest.name ?? 'there',
      propertyName: visit.property.name,
      profileUrl: visit.invitation
        ? inviteUrl(visit.invitation.token)
        : undefined,
      unsubscribeUrl: delivery.unsubscribeUrl,
      recipientIsHost: hostFooter.recipientIsHost,
      hostOnboardingUrl: hostFooter.hostOnboardingUrl,
    }),
    headers: delivery.headers,
  });

  await logNotification({
    userId: visit.guest_user_id ?? undefined,
    visitId: visit.id,
    type: 'post_visit',
  });
}

export async function notifyInvitationsExpiring(
  ownerId: string,
  ownerEmail: string,
  ownerName: string,
  invitations: { guestName: string; propertyName: string; expiresAt: string }[]
) {
  await enqueueEmail({
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
