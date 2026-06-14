import { createClient } from '@/lib/supabase/server';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { formatDateRange } from '@/lib/dates';
import { RoomCard } from '@/components/room-card';
import { Button } from '@/components/ui/button';
import { getInvitationRoomAvailability } from '@/lib/guest-availability';
import { ComposePageActions } from '@/components/dashboard/compose-page-actions';
import { HostPageShell } from '@/components/dashboard/host-page-shell';
import { HostCalendarSection } from '@/components/dashboard/host-calendar-section';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';
import { RoomEditDialog } from '@/components/dashboard/room-edit-dialog';
import { PropertyEditDialog } from '@/components/dashboard/property-edit-dialog';
import { PropertyMap } from '@/components/dashboard/property-map';
import { SectionNav } from '@/components/dashboard/section-nav';
import { PhotoGallery } from '@/components/photo-gallery';
import { Pencil, Plus, MapPin, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export const metadata = { title: 'Overview' };

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const property = await getDashboardProperty(slug);

  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('property_id', property.id)
    .order('display_order');

  const { data: propertyImages } = await supabase
    .from('property_images')
    .select('*')
    .eq('property_id', property.id)
    .order('display_order');

  const { data: bookings } = await supabase
    .from('bookings')
    .select(
      `id, status, invitation_id, guest_name, guest_email, guest:users!guest_user_id(name, email), dates:booking_dates(check_in, check_out)`
    )
    .eq('property_id', property.id)
    .in('status', ['approved', 'requested']);

  const normalized = (bookings ?? []).map((b) => {
    const dates = Array.isArray(b.dates) ? b.dates[0] : b.dates;
    const guest = (Array.isArray(b.guest) ? b.guest[0] : b.guest) as
      | { name: string | null; email: string }
      | null;
    const guestName =
      guest?.name ??
      guest?.email?.split('@')[0] ??
      b.guest_name ??
      b.guest_email?.split('@')[0] ??
      'Guest';
    return {
      id: b.id,
      status: b.status,
      guestName,
      checkIn: dates?.check_in ?? '',
      checkOut: dates?.check_out ?? '',
      isManual: !b.invitation_id,
    };
  });

  const upcoming = normalized
    .filter((b) => b.status === 'approved' && b.checkOut >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

  const roomCount = rooms?.length ?? 0;
  const roomAvailability = await getInvitationRoomAvailability(
    (rooms ?? []).map((r) => r.id),
    { includeGuestNames: true }
  );
  const totalGuests = (rooms ?? []).reduce(
    (sum, r) => sum + (r.max_occupancy ?? 0),
    0
  );

  const navSections = [
    { id: 'calendar', label: 'Calendar' },
    { id: 'rooms', label: 'Rooms' },
    { id: 'about', label: 'About' },
    { id: 'location', label: 'Location' },
    { id: 'amenities', label: 'Amenities' },
    { id: 'guest-info', label: 'Guest info' },
    { id: 'upcoming', label: 'Stays' },
  ];

  return (
    <DashboardContainer>
      {/* Title */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {property.name}
          </h1>
        </div>
        <ComposePageActions
          propertyId={property.id}
          rooms={rooms ?? []}
          roomAvailability={roomAvailability}
        />
      </div>

      {/* House card */}
      <div className="relative mt-8 flex h-72 w-full flex-col justify-end overflow-hidden rounded-2xl sm:h-96">
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
        <div className="absolute right-4 top-4">
          <PropertyEditDialog
            property={property}
            images={propertyImages ?? []}
            fields={['image', 'name']}
            title="Edit house"
            trigger={
              <Button variant="secondary" size="icon" aria-label="Edit house">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        </div>
        <div className="relative p-8">
          <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {property.name}
          </h2>
          {property.address && (
            <p className="mt-2 flex items-center gap-1.5 text-base text-white/80">
              <MapPin className="h-4 w-4" />
              {property.address}
            </p>
          )}
          <p className="mt-2 text-base text-white/70">
            {roomCount} {roomCount === 1 ? 'room' : 'rooms'}
            {totalGuests > 0 ? ` · sleeps ${totalGuests}` : ''}
          </p>
        </div>
      </div>

      <PhotoGallery photos={propertyImages ?? []} title="Photos" className="py-6" />

      <SectionNav sections={navSections} />

      <HostPageShell propertyId={property.id} rooms={rooms ?? []} className="mt-6">
        <HostCalendarSection slug={slug} sectionId="calendar" title="Calendar" />

      {/* Rooms */}
      <section id="rooms" className="scroll-mt-28 py-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">Rooms</h2>
          <RoomEditDialog
            propertyId={property.id}
            displayOrder={roomCount}
            fields={['name', 'max_occupancy', 'beds', 'description', 'amenities']}
            title="Add a room"
            trigger={
              <Button variant="outline" size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Add room
              </Button>
            }
          />
        </div>
        {roomCount === 0 ? (
          <div className="mt-6">
            <p className="text-sm text-muted-foreground">
              No rooms yet — add your first room to start inviting guests.
            </p>
            <div className="mt-3">
              <RoomEditDialog
                propertyId={property.id}
                displayOrder={0}
                fields={[
                  'name',
                  'max_occupancy',
                  'beds',
                  'description',
                  'amenities',
                ]}
                title="Add a room"
                trigger={
                  <Button size="sm">
                    <Plus className="mr-1 h-4 w-4" />
                    Add room
                  </Button>
                }
              />
            </div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {(rooms ?? []).map((room) => (
              <Link
                key={room.id}
                href={`/dashboard/${slug}/rooms/${room.id}`}
                className="group block"
              >
                <RoomCard room={room} />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* About */}
      <section id="about" className="scroll-mt-28 py-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            About this place
          </h2>
          <PropertyEditDialog
            property={property}
            fields={['description']}
            title="Edit description"
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit description">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        </div>
        {property.description ? (
          <p className="mt-6 whitespace-pre-wrap text-lg leading-relaxed text-foreground/90">
            {property.description}
          </p>
        ) : (
          <p className="mt-6 text-base text-muted-foreground">
            No description yet. Add one to tell guests about your place.
          </p>
        )}
      </section>

      {/* Location */}
      <section id="location" className="scroll-mt-28 py-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Where you&apos;re hosting
          </h2>
          <PropertyEditDialog
            property={property}
            fields={['address', 'directions', 'timezone']}
            title="Edit location"
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit location">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        </div>
        {property.address ? (
          <div className="mt-6">
            <PropertyMap
              address={property.address}
              latitude={property.latitude}
              longitude={property.longitude}
            />
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No address set yet. Add one to show guests where you&apos;re
            hosting.
          </p>
        )}
        {property.directions && (
          <div className="mt-8">
            <h3 className="text-lg font-medium">Getting there</h3>
            <p className="mt-2 whitespace-pre-wrap text-base text-muted-foreground">
              {property.directions}
            </p>
          </div>
        )}
      </section>

      {/* House amenities */}
      <section id="amenities" className="scroll-mt-28 py-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            What this place offers
          </h2>
          <PropertyEditDialog
            property={property}
            fields={['amenities']}
            title="Edit amenities"
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit amenities">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        </div>
        {property.amenities && property.amenities.length > 0 ? (
          <ul className="mt-8 grid gap-x-12 gap-y-5 sm:grid-cols-2">
            {property.amenities.map((a) => (
              <li
                key={a.key}
                className="flex items-start gap-4 border-b border-border/60 pb-5 text-base"
              >
                <Check
                  className="mt-0.5 h-5 w-5 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span>
                  {a.label}
                  {a.note ? (
                    <span className="block text-sm text-muted-foreground">
                      {a.note}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            No house amenities yet. Use the edit button above to add them.
          </p>
        )}
      </section>

      {/* Guest information */}
      <section id="guest-info" className="scroll-mt-28 py-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold tracking-tight">
            Guest information
          </h2>
          <PropertyEditDialog
            property={property}
            fields={[
              'check_in_instructions',
              'checkout_instructions',
              'checkout_time',
              'wifi',
              'house_rules',
            ]}
            title="Edit guest information"
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit guest information">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        </div>
        <dl className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <dt className="text-base font-medium">Check-in instructions</dt>
            <dd className="mt-2 whitespace-pre-wrap text-base text-muted-foreground">
              {property.check_in_instructions || 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-base font-medium">
              Checkout instructions
              {property.checkout_time ? ` · ${property.checkout_time}` : ''}
            </dt>
            <dd className="mt-2 whitespace-pre-wrap text-base text-muted-foreground">
              {property.checkout_instructions || 'Not set'}
            </dd>
          </div>
          <div>
            <dt className="text-base font-medium">WiFi</dt>
            <dd className="mt-2 text-base text-muted-foreground">
              {property.wifi_name ? (
                <>
                  {property.wifi_name}
                  {property.wifi_password ? ` · ${property.wifi_password}` : ''}
                </>
              ) : (
                'Not set'
              )}
            </dd>
          </div>
          <div>
            <dt className="text-base font-medium">House rules</dt>
            <dd className="mt-2 whitespace-pre-wrap text-base text-muted-foreground">
              {property.house_rules || 'Not set'}
            </dd>
          </div>
        </dl>
      </section>

      {/* Upcoming stays */}
      <section id="upcoming" className="scroll-mt-28 py-10">
        <h2 className="text-2xl font-semibold tracking-tight">Upcoming stays</h2>
        {upcoming.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No upcoming approved stays.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {upcoming.map((booking) => (
              <li key={booking.id}>
                <div className="flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm">
                  <div>
                    <p className="text-lg font-medium">{booking.guestName}</p>
                    {booking.checkIn && booking.checkOut && (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatDateRange(booking.checkIn, booking.checkOut)}
                      </p>
                    )}
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/${slug}/bookings/${booking.id}`}>
                      Manage
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </HostPageShell>
    </DashboardContainer>
  );
}
