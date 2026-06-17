import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { getBookingWithDetails } from '@/lib/bookings';
import { getInvitationRoomAvailability } from '@/lib/guest-availability';
import { guestKeyFromEmail, guestKeyFromManualBooking } from '@/lib/guest-keys';
import { formatDateRange } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { PropertySections } from '@/components/property-sections';
import { BookingManageView } from '@/components/dashboard/booking-manage-view';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';
import type { RoomAvailability } from '@/lib/guest-calendar';

function excludeBooking(
  map: Record<string, RoomAvailability>,
  bookingId: string
): Record<string, RoomAvailability> {
  const out: Record<string, RoomAvailability> = {};
  for (const [roomId, avail] of Object.entries(map)) {
    out[roomId] = {
      bookings: avail.bookings.filter((b) => b.id !== bookingId),
      blocks: avail.blocks,
    };
  }
  return out;
}

export const metadata = { title: 'Booking' };

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ slug: string; bookingId: string }>;
}) {
  const { slug, bookingId } = await params;
  const property = await getDashboardProperty(slug);
  const booking = await getBookingWithDetails(bookingId);

  if (!booking || booking.property_id !== property.id) notFound();

  const supabase = await createClient();
  const { data: roomRows } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy')
    .eq('property_id', property.id)
    .order('display_order');

  const bookableRooms = (roomRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    max_occupancy: r.max_occupancy,
  }));

  const allRoomIds = bookableRooms.map((r) => r.id);
  const fullAvailability = await getInvitationRoomAvailability(allRoomIds, {
    includeGuestNames: true,
  });
  const roomAvailability = excludeBooking(fullAvailability, booking.id);

  const guestProfileHref = booking.guest.email
    ? `/dashboard/${slug}/guests/${guestKeyFromEmail(booking.guest.email)}`
    : `/dashboard/${slug}/guests/${guestKeyFromManualBooking(booking.id)}`;

  const guestName = booking.guest.name ?? 'Guest';
  const roomNames = booking.rooms.map((r) => r.name).join(', ');
  const heroSubtitle = [
    formatDateRange(booking.dates.check_in, booking.dates.check_out),
    property.name,
    roomNames,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DashboardContainer>
      <Link
        href={`/dashboard/${slug}/requests`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to requests
      </Link>

      {/* House card */}
      <div className="relative mt-4 flex h-64 w-full flex-col justify-end overflow-hidden rounded-2xl sm:h-80">
        {property.hero_image_url ? (
          <>
            <Image
              src={property.hero_image_url}
              alt={property.name}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="absolute inset-0 bg-linear-to-br from-slate-700 via-slate-800 to-slate-950" />
        )}
        <div className="relative p-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {guestName}&apos;s Stay
          </h1>
          <p className="mt-2 text-base text-white/80">{heroSubtitle}</p>
        </div>
      </div>

      <BookingManageView
        booking={booking}
        rooms={bookableRooms}
        roomAvailability={roomAvailability}
        guestProfileHref={guestProfileHref}
        bookingHrefBase={`/dashboard/${slug}/bookings`}
      >
        <PropertySections
          property={property}
          noteCategories={['house', 'checkin', 'checkout']}
        />
      </BookingManageView>
    </DashboardContainer>
  );
}
