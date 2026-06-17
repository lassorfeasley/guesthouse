import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  getInvitationByToken,
  isInvitationActive,
} from '@/lib/invitations';
import { getAuthUser } from '@/lib/auth';
import { getGuestStayForInvitation } from '@/lib/bookings';
import { createAdminClient } from '@/lib/supabase/admin';
import { assignColors } from '@/lib/calendar-colors';
import { summarizeBeds } from '@/lib/validations';
import { SectionNav } from '@/components/dashboard/section-nav';
import { SiteFooter } from '@/components/site-footer';
import { BookingProvider } from '@/components/guest/booking-context';
import { SelectableRoomCalendar } from '@/components/guest/selectable-room-calendar';
import { BookingSidebar } from '@/components/guest/booking-sidebar';
import {
  appendGuestPreviewToPath,
  isGuestPreviewEnabled,
  parseGuestPreviewAs,
  parseGuestPreviewBookingStatus,
} from '@/lib/guest-preview';
import { PhotoMosaic } from '@/components/photo-gallery';
import {
  RoomHero,
  RoomAboutSection,
  RoomBedsSection,
  RoomAmenitiesSection,
  RoomBreadcrumb,
  ReturnToHouseCard,
} from '@/components/room-profile';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string; roomId: string }>;
}): Promise<Metadata> {
  const { token, roomId } = await params;
  const invitation = await getInvitationByToken(token);
  const room = invitation?.rooms.find((r) => r.id === roomId);
  if (!invitation || !room) return { title: 'Invitation not found' };

  const title = `${room.name} · ${invitation.property.name}`;
  const description = `Up to ${room.max_occupancy} guests · ${summarizeBeds(room.beds)}`;

  return {
    title,
    description,
    openGraph: { siteName: 'Gracious', type: 'website', title, description },
  };
}

export default async function GuestRoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string; roomId: string }>;
  searchParams: Promise<{ preview?: string; as?: string; status?: string }>;
}) {
  const { token, roomId } = await params;
  const { preview, as, status } = await searchParams;
  const invitation = await getInvitationByToken(token);
  if (!invitation) notFound();

  const room = invitation.rooms.find((r) => r.id === roomId);
  if (!room) notFound();

  const previewMode = isGuestPreviewEnabled(preview);
  const guestPreviewAs = parseGuestPreviewAs(as);
  const guestPreviewBookingStatus = parseGuestPreviewBookingStatus(status);
  const showBookingCalendar =
    !previewMode || guestPreviewAs !== 'booked';
  const active = isInvitationActive(invitation);
  const authUser = await getAuthUser();
  const isAuthenticated =
    !!authUser && authUser.email === invitation.guest_email;
  const property = invitation.property;

  const houseHref = previewMode
    ? appendGuestPreviewToPath(
        `/invite/${invitation.token}`,
        guestPreviewAs,
        guestPreviewBookingStatus
      )
    : `/invite/${invitation.token}`;

  const existingStay =
    isAuthenticated && authUser
      ? await getGuestStayForInvitation(invitation.id, authUser.id)
      : null;

  const isPrixFixe = invitation.type === 'prix_fixe';
  const fixedWindow = isPrixFixe ? invitation.windows[0] : undefined;
  const defaultRange = fixedWindow
    ? { checkIn: fixedWindow.start_date, checkOut: fixedWindow.end_date }
    : undefined;
  const allowedRanges =
    invitation.windows.length > 0
      ? invitation.windows.map((w) => ({
          start: w.start_date,
          end: w.end_date,
        }))
      : undefined;

  const admin = createAdminClient();
  const { data: bookingRows } = await admin
    .from('booking_rooms')
    .select(
      `booking:bookings(id, status, dates:booking_dates(check_in, check_out))`
    )
    .eq('room_id', roomId);

  const roomBookings = assignColors(
    (bookingRows ?? [])
      .map((row) => (Array.isArray(row.booking) ? row.booking[0] : row.booking))
      .filter(
        (b): b is NonNullable<typeof b> =>
          !!b && (b.status === 'approved' || b.status === 'requested')
      )
      .map((b) => {
        const dates = Array.isArray(b.dates) ? b.dates[0] : b.dates;
        return {
          id: b.id,
          guestName: 'Booked',
          checkIn: dates?.check_in ?? '',
          checkOut: dates?.check_out ?? '',
        };
      })
      .filter((b) => b.checkIn && b.checkOut)
  );

  const { data: blocks } = await admin
    .from('room_availability')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_blocked', true);

  const navSections = [
    ...(room.description ? [{ id: 'about', label: 'About' }] : []),
    ...(room.beds.length > 0 ? [{ id: 'sleeping', label: 'Beds' }] : []),
    ...(room.amenities && room.amenities.length > 0
      ? [{ id: 'amenities', label: 'Amenities' }]
      : []),
    ...(showBookingCalendar
      ? [{ id: 'availability', label: 'Availability' }]
      : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Breadcrumb */}
      <div className="border-b">
        <RoomBreadcrumb
          houseHref={houseHref}
          houseName={property.name}
          roomName={room.name}
          className="mx-auto w-full max-w-6xl px-6 py-3"
        />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-24">
        <BookingProvider
          defaultRange={defaultRange}
          defaultGuests={1}
          maxGuestsCap={room.max_occupancy}
        >
          <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[1fr_360px]">
            {/* Left column */}
            <div className="min-w-0">
              {/* Title + hero banner */}
              <PhotoMosaic photos={room.room_images ?? []} />

              <RoomHero room={room} className="mt-6" />

              <ReturnToHouseCard
                href={houseHref}
                houseName={property.name}
                houseImageUrl={property.hero_image_url}
                label="Back to house"
                className="mt-6"
              />

              <SectionNav
                sections={navSections}
                className="top-0 mt-2"
                scrollOffset={100}
              />

              <div className="mt-2 divide-y">
              <RoomAboutSection room={room} />
              <RoomBedsSection room={room} />
              <RoomAmenitiesSection room={room} />

              {showBookingCalendar && (
                <section
                  id="availability"
                  className="scroll-mt-24 py-10 first:pt-0"
                >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Availability
                  </h2>
                  <p className="mt-2 text-base text-muted-foreground">
                    {isPrixFixe
                      ? 'This is a fixed-date stay.'
                      : 'Select your dates — crossed-out days are unavailable.'}
                  </p>
                  <div className="mt-6">
                    <SelectableRoomCalendar
                      bookings={roomBookings}
                      blocks={blocks ?? []}
                      allowedRanges={allowedRanges}
                    />
                  </div>
                </section>
              )}
              </div>
            </div>

            {/* Right column — booking sidebar */}
            <aside className="lg:sticky lg:top-20 lg:self-start">
              {active || previewMode || existingStay ? (
                <BookingSidebar
                  invitation={invitation}
                  propertyName={property.name}
                  room={room}
                  isAuthenticated={isAuthenticated}
                  existingStay={existingStay}
                  previewMode={previewMode}
                  guestPreviewAs={guestPreviewAs}
                  guestPreviewBookingStatus={guestPreviewBookingStatus}
                  isPrixFixe={isPrixFixe}
                  maxGuests={room.max_occupancy}
                  bookings={roomBookings}
                  blocks={blocks ?? []}
                  allowedRanges={allowedRanges}
                />
              ) : (
                <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
                  This invitation is no longer active.
                </div>
              )}
            </aside>
          </div>
        </BookingProvider>
      </div>

      <SiteFooter name={property.name} />
    </div>
  );
}
