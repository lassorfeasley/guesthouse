import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { addDays, parseISO, differenceInCalendarDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getBookingWithDetails } from '@/lib/bookings';
import {
  notifyTripReminder,
  notifyArrivalWelcome,
  notifyCheckoutInstructions,
  notifyPostStay,
  notifyInvitationsExpiring,
} from '@/lib/email/notifications';
import { wasNotificationSent } from '@/lib/email/send';
import { formatDate } from '@/lib/dates';
import { wantsEmail } from '@/lib/notification-prefs';
import type { NotificationPrefs } from '@/types/database';

// Fallback timezone for properties that haven't set one.
const DEFAULT_TIMEZONE = 'America/Denver';
// Local hour (24h) at which time-of-day emails go out.
const SEND_HOUR = 8;
// UTC hour at which once-daily host digests are sent (kept stable even though
// the cron now runs hourly).
const DIGEST_UTC_HOUR = 9;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  // Lifecycle emails — evaluated per booking against the property's local time
  // so each one lands in the guest's morning, not a fixed UTC hour.
  const { data: approvedBookings } = await admin
    .from('bookings')
    .select('id')
    .eq('status', 'approved');

  let lifecycleSends = 0;

  for (const { id } of approvedBookings ?? []) {
    const booking = await getBookingWithDetails(id);
    if (!booking?.dates) continue;

    const tz = booking.property.timezone || DEFAULT_TIMEZONE;
    const localHour = Number(formatInTimeZone(now, tz, 'H'));
    // Only act during the property's local send hour. Combined with the
    // notifications_log dedup, this means at most one send per booking per day.
    if (localHour !== SEND_HOUR) continue;

    const localToday = formatInTimeZone(now, tz, 'yyyy-MM-dd');
    const today = parseISO(localToday);
    const checkIn = parseISO(booking.dates.check_in);
    const checkOut = parseISO(booking.dates.check_out);

    const daysUntilCheckIn = differenceInCalendarDays(checkIn, today);
    const daysSinceCheckOut = differenceInCalendarDays(today, checkOut);

    if (daysUntilCheckIn === 7) {
      if (!(await wasNotificationSent(id, 'reminder_7d'))) {
        await notifyTripReminder(booking, 7);
        lifecycleSends++;
      }
    } else if (daysUntilCheckIn === 1) {
      if (!(await wasNotificationSent(id, 'reminder_1d'))) {
        await notifyTripReminder(booking, 1);
        lifecycleSends++;
      }
    } else if (daysUntilCheckIn === 0) {
      // Morning of arrival: welcome + how to get in.
      if (!(await wasNotificationSent(id, 'arrival_welcome'))) {
        await notifyArrivalWelcome(booking);
        lifecycleSends++;
      }
    }

    // Morning of departure: send checkout instructions.
    if (daysSinceCheckOut === 0) {
      if (!(await wasNotificationSent(id, 'checkout_instructions'))) {
        await notifyCheckoutInstructions(booking);
        lifecycleSends++;
      }
    }

    // Morning after departure: send the post-stay thank-you.
    if (daysSinceCheckOut === 1) {
      if (!(await wasNotificationSent(id, 'post_stay'))) {
        await notifyPostStay(booking);
        lifecycleSends++;
      }
    }
  }

  // Invitation expiring digest — once per day at a fixed UTC hour so hosts
  // don't get an hourly repeat.
  let expiringCount = 0;
  if (now.getUTCHours() === DIGEST_UTC_HOUR) {
    const in48h = addDays(now, 2);
    const { data: expiring } = await admin
      .from('invitations')
      .select('*, property:properties(name, owner_id, owner:users!owner_id(id, email, name, notification_prefs))')
      .eq('status', 'pending')
      .not('expires_at', 'is', null)
      .lte('expires_at', in48h.toISOString())
      .gte('expires_at', now.toISOString());

    expiringCount = expiring?.length ?? 0;

    const byOwner = new Map<
      string,
      { id: string; email: string; name: string; invitations: { guestName: string; propertyName: string; expiresAt: string }[] }
    >();

    for (const inv of expiring ?? []) {
      const owner = inv.property?.owner as {
        id: string;
        email: string;
        name: string | null;
        notification_prefs?: NotificationPrefs;
      };
      if (!owner) continue;
      // Opt-out: skip hosts who muted invitation-expiring notices.
      if (!wantsEmail(owner.notification_prefs, 'invitation_expiring')) continue;
      const key = owner.id;
      if (!byOwner.has(key)) {
        byOwner.set(key, {
          id: owner.id,
          email: owner.email,
          name: owner.name ?? 'there',
          invitations: [],
        });
      }
      byOwner.get(key)!.invitations.push({
        guestName: inv.guest_name ?? inv.guest_email,
        propertyName: inv.property.name,
        expiresAt: formatDate(inv.expires_at),
      });
    }

    for (const owner of Array.from(byOwner.values())) {
      await notifyInvitationsExpiring(
        owner.id,
        owner.email,
        owner.name,
        owner.invitations
      );
    }
  }

  return NextResponse.json({
    ok: true,
    processed: approvedBookings?.length ?? 0,
    lifecycleSends,
    expiring: expiringCount,
  });
}
