import { notFound } from 'next/navigation';
import Image from 'next/image';
import { PlaceholderImage } from '@/components/placeholder-image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { getVisitWithDetails } from '@/lib/visits';
import { getInvitationRoomAvailability } from '@/lib/guest-availability';
import { guestKeyFromEmail, guestKeyFromManualVisit } from '@/lib/guest-keys';
import { formatDateRange } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';
import { PropertySections } from '@/components/property-sections';
import { PersonCard } from '@/components/person-card';
import { Button } from '@/components/ui/button';
import { VisitManageView } from '@/components/dashboard/visit-manage-view';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';
import type { RoomAvailability } from '@/lib/guest-calendar';

function excludeVisit(
  map: Record<string, RoomAvailability>,
  visitId: string
): Record<string, RoomAvailability> {
  const out: Record<string, RoomAvailability> = {};
  for (const [roomId, avail] of Object.entries(map)) {
    out[roomId] = {
      visits: avail.visits.filter((b) => b.id !== visitId),
      blocks: avail.blocks,
    };
  }
  return out;
}

export const metadata = { title: 'Visit' };

export default async function ManageVisitPage({
  params,
}: {
  params: Promise<{ slug: string; visitId: string }>;
}) {
  const { slug, visitId } = await params;
  const property = await getDashboardProperty(slug);
  const visit = await getVisitWithDetails(visitId);

  if (!visit || visit.property_id !== property.id) notFound();

  const supabase = await createClient();
  const { data: roomRows } = await supabase
    .from('rooms')
    .select('id, name, max_occupancy')
    .eq('property_id', property.id)
    .order('display_order');

  const requestableRooms = (roomRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    max_occupancy: r.max_occupancy,
  }));

  const allRoomIds = requestableRooms.map((r) => r.id);
  const fullAvailability = await getInvitationRoomAvailability(allRoomIds, {
    includeGuestNames: true,
  });
  const roomAvailability = excludeVisit(fullAvailability, visit.id);

  const guestProfileHref = visit.guest.email
    ? `/dashboard/${slug}/guests/${guestKeyFromEmail(visit.guest.email)}`
    : `/dashboard/${slug}/guests/${guestKeyFromManualVisit(visit.id)}`;

  const guestName = visit.guest.name ?? 'Guest';
  const roomNames = visit.rooms.map((r) => r.name).join(', ');
  const heroSubtitle = [
    formatDateRange(visit.dates.check_in, visit.dates.check_out),
    property.name,
    roomNames,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <DashboardContainer>
      <Link
        href={`/dashboard/${slug}/visits`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to visits
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
          <PlaceholderImage
            type="home"
            name={property.name}
            seed={property.id}
            className="absolute inset-0"
            iconClassName="h-16 w-16"
          />
        )}
        <div className="relative p-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {guestName}&apos;s Stay
          </h1>
          <p className="mt-2 text-base text-white/80">{heroSubtitle}</p>
        </div>
      </div>

      <PersonCard
        name={guestName}
        imageUrl={visit.guest.avatar_url}
        seed={visit.guest.email}
        role={visit.relationship}
        email={visit.guest.email}
        phone={visit.guest_phone}
        className="mt-6"
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={guestProfileHref}>View guest profile</Link>
          </Button>
        }
      />

      <VisitManageView
        visit={visit}
        rooms={requestableRooms}
        roomAvailability={roomAvailability}
        guestProfileHref={guestProfileHref}
        visitHrefBase={`/dashboard/${slug}/visits`}
      >
        <PropertySections
          property={property}
          noteCategories={['house', 'checkin', 'checkout']}
        />
      </VisitManageView>
    </DashboardContainer>
  );
}
