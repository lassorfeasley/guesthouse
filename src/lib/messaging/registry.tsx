import type { ReactElement } from 'react';
import type { NotificationPrefs } from '@/types/database';

import InvitationSentEmail from '../../../emails/invitation-sent';
import StayRequestedEmail from '../../../emails/stay-requested';
import BookingApprovedEmail from '../../../emails/booking-approved';
import BookingDeclinedEmail from '../../../emails/booking-declined';
import BookingCancelledEmail from '../../../emails/booking-cancelled';
import TripReminderEmail from '../../../emails/trip-reminder';
import InvitationExpiringEmail from '../../../emails/invitation-expiring';
import CheckoutInstructionsEmail from '../../../emails/checkout-instructions';
import PostStayThankYouEmail from '../../../emails/post-stay-thankyou';
import AuthConfirmSignupEmail from '../../../emails/auth-confirm-signup';
import AuthMagicLinkEmail from '../../../emails/auth-magic-link';
import AuthRecoveryEmail from '../../../emails/auth-recovery';
import ProductUpdateEmail from '../../../emails/product-update';
import StayBookedEmail from '../../../emails/stay-booked';
import RequestReceivedEmail from '../../../emails/request-received';
import ArrivalWelcomeEmail from '../../../emails/arrival-welcome';

export type MessageChannel = 'email' | 'sms';

/** Who an email is addressed to, used to group the admin view into flows. */
export type MessageRecipient = 'guest' | 'host' | 'account';

export type MessageCategory =
  | 'Account'
  | 'Invitations'
  | 'Booking requests'
  | 'Confirmations'
  | 'Reminders'
  | 'Marketing';

export interface MessagePreviewVariant {
  /** Short label shown when a message renders differently per recipient/context. */
  label: string;
  /** Example subject line for this variant. */
  subject: string;
  /** Rendered React Email element used to generate an HTML preview. */
  element: ReactElement;
}

export interface AutomatedMessage {
  /** Stable id used in the admin URL. */
  id: string;
  name: string;
  channel: MessageChannel;
  category: MessageCategory;
  /** Structured recipient(s) — used to bucket messages into Guest/Host/Account flows. */
  recipients: MessageRecipient[];
  /** Whether the message is wired up today or planned for the future. */
  status: 'active' | 'planned';
  /** Who receives this message. */
  audience: string;
  /** Plain-language summary of what the message is. */
  description: string;
  /** What user action or system event causes it to send. */
  trigger: string;
  /** When it sends relative to the trigger (timing/cadence). */
  timing: string;
  /**
   * notifications_log `type` values this message writes. Used to match real
   * send history. Empty when the message is not logged.
   */
  logTypes: string[];
  /**
   * Host notification preference that can suppress this message, plus whether
   * that preference is currently enforced in code.
   */
  notificationPref: {
    key: keyof NotificationPrefs;
    label: string;
    enforced: boolean;
  } | null;
  /** Source file where the send is triggered, for engineering reference. */
  source: string;
  variants: MessagePreviewVariant[];
}

// ---------------------------------------------------------------------------
// Sample data used purely to render representative previews. None of this is
// real guest/host data — it just exercises every field in each template.
// ---------------------------------------------------------------------------

const SAMPLE = {
  guestName: 'Jordan Rivera',
  ownerName: 'Sam Patel',
  propertyName: 'The Lake House',
  dates: 'Jul 12, 2026 – Jul 16, 2026',
  rooms: 'Master Suite, Bunk Room',
  partySize: 4,
  inviteUrl: 'https://guesthouse.app/invite/sample-token',
  dashboardUrl: 'https://guesthouse.app/dashboard',
  requestUrl: 'https://guesthouse.app/dashboard/the-lake-house/requests',
  address: '482 Shoreline Dr, Tahoe City, CA',
  directions: 'Gate code is 1995. Park in the gravel area to the right.',
  wifiName: 'LakeHouse-5G',
  wifiPassword: 'sunset2026',
  checkIn: 'Self check-in after 3pm. Lockbox code is 4821.',
  houseRules: 'No smoking indoors. Quiet hours after 10pm.',
  checkoutTime: '11:00 AM',
  checkoutInstructions:
    'Strip the beds, start the dishwasher, and drop the keys back in the lockbox.',
  expiresAt: 'Jun 14, 2026',
  authUrl: 'https://guesthouse.app/auth/confirm?token_hash=sample',
};

export const AUTOMATED_MESSAGES: AutomatedMessage[] = [
  {
    id: 'auth-confirm-signup',
    name: 'Confirm email (signup)',
    channel: 'email',
    category: 'Account',
    recipients: ['account'],
    status: 'active',
    audience: 'New user',
    description:
      'Confirms a new account\u2019s email address. Sent by Supabase Auth through our Send Email hook so it matches the GuestHouse design.',
    trigger: 'A user signs up and Supabase requests email confirmation.',
    timing: 'Immediately',
    logTypes: [],
    notificationPref: null,
    source: 'src/app/api/auth/email-hook/route.ts',
    variants: [
      {
        label: 'Default',
        subject: 'Confirm your email for GuestHouse',
        element: (
          <AuthConfirmSignupEmail confirmUrl={SAMPLE.authUrl} token="123456" />
        ),
      },
    ],
  },
  {
    id: 'auth-magic-link',
    name: 'Sign-in link (magic link)',
    channel: 'email',
    category: 'Account',
    recipients: ['account'],
    status: 'active',
    audience: 'Existing user',
    description:
      'A passwordless sign-in link. Sent by Supabase Auth through our Send Email hook.',
    trigger: 'A user requests a magic-link sign-in.',
    timing: 'Immediately',
    logTypes: [],
    notificationPref: null,
    source: 'src/app/api/auth/email-hook/route.ts',
    variants: [
      {
        label: 'Default',
        subject: 'Your GuestHouse sign-in link',
        element: <AuthMagicLinkEmail signInUrl={SAMPLE.authUrl} token="123456" />,
      },
    ],
  },
  {
    id: 'auth-recovery',
    name: 'Password reset',
    channel: 'email',
    category: 'Account',
    recipients: ['account'],
    status: 'active',
    audience: 'Existing user',
    description:
      'A password reset link. Sent by Supabase Auth through our Send Email hook.',
    trigger: 'A user requests a password reset.',
    timing: 'Immediately',
    logTypes: [],
    notificationPref: null,
    source: 'src/app/api/auth/email-hook/route.ts',
    variants: [
      {
        label: 'Default',
        subject: 'Reset your GuestHouse password',
        element: <AuthRecoveryEmail resetUrl={SAMPLE.authUrl} token="123456" />,
      },
    ],
  },
  {
    id: 'invitation-sent',
    name: 'Invitation sent',
    channel: 'email',
    category: 'Invitations',
    recipients: ['guest'],
    status: 'active',
    audience: 'Invited guest',
    description:
      'Invites a guest to view a property and request a stay, with an optional personal message and expiry date.',
    trigger: 'A host creates and sends an invitation.',
    timing: 'Immediately',
    logTypes: ['invitation_sent'],
    notificationPref: null,
    source: 'src/app/api/invitations/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `You're invited to ${SAMPLE.propertyName}`,
        element: (
          <InvitationSentEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            inviteUrl={SAMPLE.inviteUrl}
            message="We'd love to have you for the long weekend — the lake is perfect this time of year."
            expiresAt={SAMPLE.expiresAt}
          />
        ),
      },
    ],
  },
  {
    id: 'stay-requested',
    name: 'Stay request',
    channel: 'email',
    category: 'Booking requests',
    recipients: ['host'],
    status: 'active',
    audience: 'Property owner + co-managers',
    description:
      'Notifies hosts that a guest has requested a stay, with Approve/Decline buttons that deep-link into the dashboard.',
    trigger: 'A guest submits a booking that requires approval.',
    timing: 'Immediately',
    logTypes: ['stay_requested'],
    notificationPref: {
      key: 'booking_requests',
      label: 'Booking requests',
      enforced: true,
    },
    source: 'src/app/api/bookings/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `Stay request from ${SAMPLE.guestName}`,
        element: (
          <StayRequestedEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            rooms={SAMPLE.rooms}
            partySize={SAMPLE.partySize}
            notes="Bringing two kids and a (very well-behaved) dog if that's okay."
            approveUrl={SAMPLE.requestUrl}
            declineUrl={SAMPLE.requestUrl}
          />
        ),
      },
    ],
  },
  {
    id: 'request-received',
    name: 'Request received',
    channel: 'email',
    category: 'Booking requests',
    recipients: ['guest'],
    status: 'active',
    audience: 'Guest',
    description:
      'A receipt to the guest confirming their stay request went through and the hosts have been notified. Only sent when the invitation requires approval.',
    trigger: 'A guest submits a booking that requires host approval.',
    timing: 'Immediately',
    logTypes: ['request_received'],
    notificationPref: null,
    source: 'src/app/api/bookings/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `Your request for ${SAMPLE.propertyName} is in`,
        element: (
          <RequestReceivedEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            rooms={SAMPLE.rooms}
          />
        ),
      },
    ],
  },
  {
    id: 'stay-booked',
    name: 'Stay booked',
    channel: 'email',
    category: 'Booking requests',
    recipients: ['host'],
    status: 'active',
    audience: 'Property owner + co-managers',
    description:
      'Tells hosts a guest booked a stay that didn\u2019t need approval, so confirmed bookings never appear on the calendar silently.',
    trigger: 'A guest books via an invitation that doesn\u2019t require approval.',
    timing: 'Immediately',
    logTypes: ['stay_booked'],
    notificationPref: {
      key: 'booking_requests',
      label: 'Booking requests',
      enforced: true,
    },
    source: 'src/app/api/bookings/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `${SAMPLE.guestName} booked a stay at ${SAMPLE.propertyName}`,
        element: (
          <StayBookedEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            rooms={SAMPLE.rooms}
            partySize={SAMPLE.partySize}
            notes="Bringing two kids and a (very well-behaved) dog if that's okay."
            bookingUrl={SAMPLE.dashboardUrl}
          />
        ),
      },
    ],
  },
  {
    id: 'booking-approved',
    name: 'Booking confirmed',
    channel: 'email',
    category: 'Confirmations',
    recipients: ['guest'],
    status: 'active',
    audience: 'Guest',
    description:
      'Confirms an approved stay with full property details (address, directions, WiFi, check-in, house rules) and attaches a calendar (.ics) file.',
    trigger:
      'A host approves a request, a booking auto-approves, a host creates an offline booking, or an approved booking is updated.',
    timing: 'Immediately',
    logTypes: ['booking_approved'],
    notificationPref: null,
    source: 'src/app/api/bookings/[id]/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `Your stay at ${SAMPLE.propertyName} is confirmed`,
        element: (
          <BookingApprovedEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            rooms={SAMPLE.rooms}
            address={SAMPLE.address}
            directions={SAMPLE.directions}
            wifiName={SAMPLE.wifiName}
            wifiPassword={SAMPLE.wifiPassword}
            checkIn={SAMPLE.checkIn}
            houseRules={SAMPLE.houseRules}
            coguestNote="Others staying during your dates: The Garcia family and others."
            profileUrl={SAMPLE.inviteUrl}
          />
        ),
      },
    ],
  },
  {
    id: 'booking-declined',
    name: 'Booking declined',
    channel: 'email',
    category: 'Confirmations',
    recipients: ['guest'],
    status: 'active',
    audience: 'Guest',
    description:
      'Lets a guest know their request was not approved, with an optional message from the host and a link to request again.',
    trigger: 'A host declines a stay request.',
    timing: 'Immediately',
    logTypes: ['booking_declined'],
    notificationPref: null,
    source: 'src/app/api/bookings/[id]/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `Stay request declined — ${SAMPLE.propertyName}`,
        element: (
          <BookingDeclinedEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            message="So sorry — we have family in town those dates. Would love to host you later in the summer!"
            inviteUrl={SAMPLE.inviteUrl}
          />
        ),
      },
    ],
  },
  {
    id: 'booking-cancelled',
    name: 'Booking cancelled',
    channel: 'email',
    category: 'Confirmations',
    recipients: ['guest', 'host'],
    status: 'active',
    audience: 'Host or guest (whoever did not cancel)',
    description:
      'Notifies the other party that a confirmed stay was cancelled. The wording changes depending on who cancelled.',
    trigger: 'A guest or host cancels a confirmed booking.',
    timing: 'Immediately',
    logTypes: ['booking_cancelled_guest', 'booking_cancelled_owner'],
    notificationPref: {
      key: 'booking_cancelled',
      label: 'Booking cancelled',
      enforced: true,
    },
    source: 'src/app/api/bookings/[id]/route.ts',
    variants: [
      {
        label: 'To host (guest cancelled)',
        subject: `${SAMPLE.guestName} cancelled their stay`,
        element: (
          <BookingCancelledEmail
            recipientName={SAMPLE.ownerName}
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            cancelledBy="guest"
          />
        ),
      },
      {
        label: 'To guest (host cancelled)',
        subject: `Your stay at ${SAMPLE.propertyName} was cancelled`,
        element: (
          <BookingCancelledEmail
            recipientName={SAMPLE.guestName}
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            cancelledBy="owner"
          />
        ),
      },
    ],
  },
  {
    id: 'trip-reminder',
    name: 'Trip reminder',
    channel: 'email',
    category: 'Reminders',
    recipients: ['guest'],
    status: 'active',
    audience: 'Guest',
    description:
      'Reminds a guest about an upcoming stay. The 1-day reminder also includes check-in instructions.',
    trigger: 'A confirmed booking is exactly 7 days or 1 day before check-in.',
    timing: 'Scheduled — ~8am local, 7 days and 1 day before check-in',
    logTypes: ['reminder_7d', 'reminder_1d'],
    notificationPref: {
      key: 'guest_reminders',
      label: 'Stay reminders',
      enforced: true,
    },
    source: 'src/app/api/cron/reminders/route.ts',
    variants: [
      {
        label: '7 days before',
        subject: `One week until your stay at ${SAMPLE.propertyName}`,
        element: (
          <TripReminderEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            daysUntil={7}
            address={SAMPLE.address}
            wifiName={SAMPLE.wifiName}
            wifiPassword={SAMPLE.wifiPassword}
            profileUrl={SAMPLE.inviteUrl}
          />
        ),
      },
      {
        label: '1 day before',
        subject: `Tomorrow: your stay at ${SAMPLE.propertyName}`,
        element: (
          <TripReminderEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            dates={SAMPLE.dates}
            daysUntil={1}
            checkIn={SAMPLE.checkIn}
            address={SAMPLE.address}
            wifiName={SAMPLE.wifiName}
            wifiPassword={SAMPLE.wifiPassword}
            profileUrl={SAMPLE.inviteUrl}
          />
        ),
      },
    ],
  },
  {
    id: 'arrival-welcome',
    name: 'Arrival welcome',
    channel: 'email',
    category: 'Reminders',
    recipients: ['guest'],
    status: 'active',
    audience: 'Guest',
    description:
      'A day-of welcome with everything needed to get in: check-in instructions, address, directions, and WiFi.',
    trigger: 'A confirmed booking reaches its check-in date.',
    timing: 'Scheduled — ~8am local on the day of check-in',
    logTypes: ['arrival_welcome'],
    notificationPref: {
      key: 'guest_reminders',
      label: 'Stay reminders',
      enforced: true,
    },
    source: 'src/app/api/cron/reminders/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `Today's the day — welcome to ${SAMPLE.propertyName}`,
        element: (
          <ArrivalWelcomeEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            checkIn={SAMPLE.checkIn}
            address={SAMPLE.address}
            directions={SAMPLE.directions}
            wifiName={SAMPLE.wifiName}
            wifiPassword={SAMPLE.wifiPassword}
            profileUrl={SAMPLE.inviteUrl}
          />
        ),
      },
    ],
  },
  {
    id: 'checkout-instructions',
    name: 'Checkout instructions',
    channel: 'email',
    category: 'Reminders',
    recipients: ['guest'],
    status: 'active',
    audience: 'Guest',
    description:
      'Proactively sends checkout steps and a house-rules reminder on the morning the guest leaves.',
    trigger: 'A confirmed booking reaches its check-out date.',
    timing: 'Scheduled — ~8am local on the day of checkout',
    logTypes: ['checkout_instructions'],
    notificationPref: {
      key: 'guest_reminders',
      label: 'Stay reminders',
      enforced: true,
    },
    source: 'src/app/api/cron/reminders/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `Checkout details for ${SAMPLE.propertyName}`,
        element: (
          <CheckoutInstructionsEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            checkoutTime={SAMPLE.checkoutTime}
            checkoutInstructions={SAMPLE.checkoutInstructions}
            houseRules={SAMPLE.houseRules}
          />
        ),
      },
    ],
  },
  {
    id: 'post-stay',
    name: 'Post-stay thank-you',
    channel: 'email',
    category: 'Reminders',
    recipients: ['guest'],
    status: 'active',
    audience: 'Guest',
    description:
      'A warm thank-you the day after a guest checks out, with a link back to the house.',
    trigger: 'The day after a confirmed booking\u2019s check-out date.',
    timing: 'Scheduled — ~8am local the day after checkout',
    logTypes: ['post_stay'],
    notificationPref: {
      key: 'guest_reminders',
      label: 'Stay reminders',
      enforced: true,
    },
    source: 'src/app/api/cron/reminders/route.ts',
    variants: [
      {
        label: 'Default',
        subject: `Thanks for staying at ${SAMPLE.propertyName}`,
        element: (
          <PostStayThankYouEmail
            guestName={SAMPLE.guestName}
            propertyName={SAMPLE.propertyName}
            hostName={SAMPLE.ownerName}
            profileUrl={SAMPLE.inviteUrl}
          />
        ),
      },
    ],
  },
  {
    id: 'invitation-expiring',
    name: 'Invitations expiring',
    channel: 'email',
    category: 'Reminders',
    recipients: ['host'],
    status: 'active',
    audience: 'Property owner',
    description:
      'A digest reminding a host about pending invitations that are about to expire, grouped into a single email per host.',
    trigger: 'A pending invitation expires within the next 48 hours.',
    timing: 'Scheduled — daily cron at 9:00 UTC',
    logTypes: [],
    notificationPref: {
      key: 'invitation_expiring',
      label: 'Invitation expiring',
      enforced: true,
    },
    source: 'src/app/api/cron/reminders/route.ts',
    variants: [
      {
        label: 'Default',
        subject: 'Invitations expiring in 48 hours',
        element: (
          <InvitationExpiringEmail
            ownerName={SAMPLE.ownerName}
            invitations={[
              {
                guestName: SAMPLE.guestName,
                propertyName: SAMPLE.propertyName,
                expiresAt: SAMPLE.expiresAt,
              },
              {
                guestName: 'Alex Chen',
                propertyName: SAMPLE.propertyName,
                expiresAt: 'Jun 15, 2026',
              },
            ]}
            dashboardUrl={SAMPLE.dashboardUrl}
          />
        ),
      },
    ],
  },
  {
    id: 'product-updates',
    name: 'Product updates',
    channel: 'email',
    category: 'Marketing',
    recipients: ['host'],
    status: 'planned',
    audience: 'Hosts (anyone who owns a home)',
    description:
      'Occasional marketing email about new GuestHouse features. The only non-transactional email — subscribed by default once a host adds a home, opt-out anytime. No broadcast tooling is built yet.',
    trigger: 'Sent manually when there\u2019s something worth sharing.',
    timing: 'Ad hoc',
    logTypes: [],
    notificationPref: {
      key: 'product_updates',
      label: 'Product updates',
      enforced: true,
    },
    source: 'Not built yet',
    variants: [
      {
        label: 'Default',
        subject: "What's new in GuestHouse",
        element: (
          <ProductUpdateEmail
            hostName={SAMPLE.ownerName}
            headline="Room-level photo galleries are here"
            body="You can now add a photo gallery to each room, so guests see exactly where they'll be staying. Head to any home to try it out."
            ctaLabel="See what's new"
            ctaUrl={SAMPLE.dashboardUrl}
          />
        ),
      },
    ],
  },
];

export function getMessage(id: string): AutomatedMessage | undefined {
  return AUTOMATED_MESSAGES.find((m) => m.id === id);
}

/** All notifications_log types that map to a known message, for history queries. */
export const ALL_LOG_TYPES: string[] = AUTOMATED_MESSAGES.flatMap(
  (m) => m.logTypes
);

/** Reverse lookup from a notifications_log type to its message. */
export function messageForLogType(
  type: string
): AutomatedMessage | undefined {
  return AUTOMATED_MESSAGES.find((m) => m.logTypes.includes(type));
}

// ---------------------------------------------------------------------------
// Journeys — the ordered sequence of emails a guest (and host) experiences,
// described in their own words with a strong sense of timing. Steps link to a
// real registered email when one exists; steps we envision but haven't built
// yet are flagged `planned` so the timeline stays honest about what sends today.
// ---------------------------------------------------------------------------

export interface JourneyStep {
  /** How the recipient would perceive this moment. */
  title: string;
  /** Plain-language timing — a strong suggestion of when it arrives. */
  when: string;
  /** Optional context, especially for planned steps. */
  description?: string;
  /** Registered email message id(s) this step maps to, if built. */
  messageIds?: string[];
  /** Envisioned but not yet implemented. */
  planned?: boolean;
}

export const GUEST_JOURNEY: JourneyStep[] = [
  {
    title: "You've been invited",
    when: 'As soon as a host invites you',
    messageIds: ['invitation-sent'],
  },
  {
    title: 'Your sign-in link',
    when: 'When you open your invite and sign in',
    messageIds: ['auth-magic-link'],
  },
  {
    title: 'Your dates have been requested',
    when: 'Moments after you submit your dates',
    description:
      'Only when the invitation requires host approval — instant bookings skip straight to the confirmation.',
    messageIds: ['request-received'],
  },
  {
    title: 'Your dates were approved — or declined',
    when: 'When the host responds to your request',
    messageIds: ['booking-approved', 'booking-declined'],
  },
  {
    title: 'Your visit is coming up',
    when: 'About a week before check-in',
    messageIds: ['trip-reminder'],
  },
  {
    title: 'Your visit is tomorrow',
    when: 'The day before check-in',
    messageIds: ['trip-reminder'],
  },
  {
    title: "Welcome — here's how to get in",
    when: 'The morning of check-in',
    messageIds: ['arrival-welcome'],
  },
  {
    title: 'Time to head out',
    when: 'The morning you leave',
    messageIds: ['checkout-instructions'],
  },
  {
    title: 'Thanks for visiting',
    when: 'The morning after you check out',
    messageIds: ['post-stay'],
  },
];

export const HOST_JOURNEY: JourneyStep[] = [
  {
    title: 'A guest requested a stay',
    when: 'As soon as a guest submits their dates',
    description: 'When the invitation requires your approval.',
    messageIds: ['stay-requested'],
  },
  {
    title: 'A guest booked a stay',
    when: 'The moment an instant booking lands on your calendar',
    description:
      'When the invitation doesn\u2019t require approval — informational, nothing to act on.',
    messageIds: ['stay-booked'],
  },
  {
    title: 'A stay was cancelled',
    when: 'If a guest cancels a confirmed booking',
    messageIds: ['booking-cancelled'],
  },
];

// Account/auth touchpoints. Not a chronological journey like a booking — these
// fire whenever the matching auth event happens — but listing them as a short
// flow keeps the "what arrives when" framing consistent.
export const ACCOUNT_JOURNEY: JourneyStep[] = [
  {
    title: 'Confirm your email',
    when: 'Right after you sign up',
    messageIds: ['auth-confirm-signup'],
  },
  {
    title: 'Your sign-in link',
    when: 'When you request a passwordless sign-in',
    messageIds: ['auth-magic-link'],
  },
  {
    title: 'Reset your password',
    when: 'When you ask to reset your password',
    messageIds: ['auth-recovery'],
  },
];

/** All messages addressed to a given recipient, in registry order. */
export function messagesForRecipient(
  recipient: MessageRecipient
): AutomatedMessage[] {
  return AUTOMATED_MESSAGES.filter((m) => m.recipients.includes(recipient));
}
