import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { getAccountUsage } from '@/lib/billing';
import { AvailabilityBlocks } from '@/components/dashboard/availability-blocks';
import { HostPageShell } from '@/components/dashboard/host-page-shell';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';
import { HostCalendarSection } from '@/components/dashboard/host-calendar-section';
import { PropertyMap } from '@/components/dashboard/property-map';
import { SectionNav } from '@/components/dashboard/section-nav';
import { InviteGuestDialog } from '@/components/dashboard/invite-guest-dialog';
import { RoomEditDialog } from '@/components/dashboard/room-edit-dialog';
import { PhotoMosaic } from '@/components/photo-gallery';
import { Button } from '@/components/ui/button';
import {
  RoomHero,
  RoomAboutSection,
  RoomBedsSection,
  RoomAmenitiesSection,
  RoomBreadcrumb,
  ReturnToHouseCard,
} from '@/components/room-profile';

export const metadata = { title: 'Room' };

export default async function RoomProfilePage({
  params,
}: {
  params: Promise<{ slug: string; roomId: string }>;
}) {
  const { slug, roomId } = await params;
  const property = await getDashboardProperty(slug);
  const user = await getCurrentUser();
  const isPropertyOwner = user?.id === property.owner_id;
  const usage =
    isPropertyOwner ? await getAccountUsage(property.owner_id) : null;
  const invitationUsage =
    usage?.plan === 'free'
      ? {
          remaining: usage.remaining,
          limit: usage.limit,
          settingsPath: `/dashboard/${slug}/settings`,
        }
      : undefined;

  const supabase = await createClient();
  const { data: rooms } = await supabase
    .from('rooms')
    .select('*')
    .eq('property_id', property.id)
    .order('display_order');

  const room = rooms?.find((r) => r.id === roomId);
  if (!room) notFound();

  const { data: blocks } = await supabase
    .from('room_availability')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_blocked', true);

  const { data: roomImages } = await supabase
    .from('room_images')
    .select('*')
    .eq('room_id', roomId)
    .order('display_order');

  const blocksForEditor = (blocks ?? []).map((b) => ({ ...b, room }));

  const roomActions = (
    <div className="flex items-center gap-2">
      <RoomEditDialog
        room={room}
        images={roomImages ?? []}
        fields={['name', 'max_occupancy', 'image']}
        deleteRedirectTo={`/dashboard/${slug}/overview`}
        title="Edit room details"
        trigger={
          <Button variant="outline" size="icon" aria-label="Edit">
            <Pencil className="h-4 w-4" />
          </Button>
        }
      />
      <InviteGuestDialog
        propertyId={property.id}
        rooms={rooms ?? []}
        preselectedRoomIds={[room.id]}
      />
    </div>
  );

  const navSections = [
    ...(roomImages && roomImages.length > 0
      ? [{ id: 'photos', label: 'Photos' }]
      : []),
    { id: 'about', label: 'About' },
    { id: 'sleeping', label: 'Beds' },
    { id: 'amenities', label: 'Amenities' },
    { id: 'availability', label: 'Availability' },
    ...(property.address ? [{ id: 'location', label: 'Location' }] : []),
  ];

  return (
    <DashboardContainer>
      <div className="flex items-center justify-between gap-4">
        <RoomBreadcrumb
          houseHref={`/dashboard/${slug}/overview`}
          houseName={property.name}
          roomName={room.name}
        />
        {roomActions}
      </div>

      <HostPageShell
        propertyId={property.id}
        rooms={rooms ?? []}
        defaultSelectedRoomIds={[room.id]}
        lockRoomSelection
        preselectedRoomIds={[room.id]}
        className="mt-3"
        invitationUsage={invitationUsage}
        leading={
          <>
            <section id="photos" className="scroll-mt-28">
              <PhotoMosaic
                photos={roomImages ?? []}
                emptyState={
                  <p className="text-sm text-muted-foreground">
                    Add photos to showcase this room
                  </p>
                }
                manageAction={
                  <RoomEditDialog
                    room={room}
                    images={roomImages ?? []}
                    fields={['image']}
                    title="Manage photos"
                    trigger={
                      <Button variant="secondary" size="sm" className="shadow-md">
                        <Pencil className="mr-1 h-4 w-4" />
                        Manage photos
                      </Button>
                    }
                  />
                }
              />
            </section>

            <RoomHero room={room} className="mt-6" />

            <ReturnToHouseCard
              href={`/dashboard/${slug}/overview`}
              houseName={property.name}
              houseImageUrl={property.hero_image_url}
              label="Back to home"
              className="mt-6"
            />

            <SectionNav sections={navSections} className="top-14 mt-6" />
          </>
        }
      >
      <RoomAboutSection
        room={room}
        showEmpty
        className="scroll-mt-28"
        headingClassName="text-[22px]"
        action={
          <RoomEditDialog
            room={room}
            fields={['description']}
            title="Edit description"
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        }
      />

      <RoomBedsSection
        room={room}
        showEmpty
        heading="Where guests sleep"
        className="scroll-mt-28"
        headingClassName="text-[22px]"
        action={
          <RoomEditDialog
            room={room}
            fields={['beds']}
            title="Edit beds"
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        }
      />

      <RoomAmenitiesSection
        room={room}
        showEmpty
        className="scroll-mt-28"
        headingClassName="text-[22px]"
        action={
          <RoomEditDialog
            room={room}
            fields={['amenities']}
            title="Edit amenities"
            trigger={
              <Button variant="ghost" size="icon" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Button>
            }
          />
        }
      />

      <HostCalendarSection
        slug={slug}
        sectionId="availability"
        title="Availability"
        footer={
          <div className="mt-8 border-t pt-8">
            <AvailabilityBlocks rooms={[room]} blocks={blocksForEditor} />
          </div>
        }
      />

      {/* Location */}
      {property.address && (
        <section id="location" className="scroll-mt-28 py-10">
          <h2 className="text-[22px] font-semibold tracking-tight">
            Where you&apos;re hosting
          </h2>
          <div className="mt-6">
            <PropertyMap
              address={property.address}
              latitude={property.latitude}
              longitude={property.longitude}
            />
          </div>
        </section>
      )}

      </HostPageShell>
    </DashboardContainer>
  );
}
