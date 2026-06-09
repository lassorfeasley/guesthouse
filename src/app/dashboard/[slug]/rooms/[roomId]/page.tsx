import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, BedDouble, Check, UserPlus, Pencil } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { summarizeBeds, BED_SIZE_LABELS } from '@/lib/validations';
import { AvailabilityBlocks } from '@/components/dashboard/availability-blocks';
import { HostPageShell } from '@/components/dashboard/host-page-shell';
import { HostCalendarSection } from '@/components/dashboard/host-calendar-section';
import { PropertyMap } from '@/components/dashboard/property-map';
import { SectionNav } from '@/components/dashboard/section-nav';
import { InviteGuestDialog } from '@/components/dashboard/invite-guest-dialog';
import { RoomEditDialog } from '@/components/dashboard/room-edit-dialog';
import { DeleteRoomButton } from '@/components/dashboard/delete-room-button';
import { PhotoGallery } from '@/components/photo-gallery';
import { Button } from '@/components/ui/button';
import type { Amenity } from '@/types/database';

function bedLabel(bed: string): string {
  return BED_SIZE_LABELS[bed as keyof typeof BED_SIZE_LABELS] ?? bed;
}

export default async function RoomProfilePage({
  params,
}: {
  params: Promise<{ slug: string; roomId: string }>;
}) {
  const { slug, roomId } = await params;
  const property = await getDashboardProperty(slug);

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
    <div className="mx-auto max-w-6xl">
      <div className="flex items-center justify-between gap-4">
        <Link
          href={`/dashboard/${slug}/overview`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>
        {roomActions}
      </div>

      {room.image_url ? (
        <>
          {/* Title */}
          <div className="mt-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {room.name}
            </h1>
            <p className="mt-1 text-muted-foreground">
              Up to {room.max_occupancy} guests · {summarizeBeds(room.beds)}
            </p>
          </div>

          {/* Hero */}
          <div className="mt-6 overflow-hidden rounded-2xl">
            <div className="relative h-72 w-full sm:h-[420px]">
              <Image
                src={room.image_url}
                alt={room.name}
                fill
                className="object-cover"
                priority
              />
            </div>
          </div>
        </>
      ) : (
        /* Hero with overlaid info (no photo yet) */
        <>
          <div className="relative mt-4 flex h-72 w-full flex-col justify-end overflow-hidden rounded-2xl bg-linear-to-br from-slate-700 via-slate-800 to-slate-950 p-6 sm:h-[420px]">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {room.name}
            </h1>
            <p className="mt-2 text-white/70">
              Up to {room.max_occupancy} guests · {summarizeBeds(room.beds)}
            </p>
          </div>
        </>
      )}

      <section id="photos" className="scroll-mt-28">
        <div className="mt-6 flex items-center justify-between gap-4">
          <h2 className="text-[22px] font-semibold tracking-tight">Photos</h2>
          <RoomEditDialog
            room={room}
            images={roomImages ?? []}
            fields={['image']}
            title="Manage photos"
            trigger={
              <Button variant="outline" size="sm">
                <Pencil className="mr-1 h-4 w-4" />
                Manage photos
              </Button>
            }
          />
        </div>
        {(roomImages ?? []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No photos yet. Add photos to showcase this room.
          </p>
        ) : (
          <PhotoGallery photos={roomImages ?? []} className="py-6" />
        )}
      </section>

      <SectionNav sections={navSections} />

      <HostPageShell
        propertyId={property.id}
        rooms={rooms ?? []}
        defaultSelectedRoomIds={[room.id]}
        lockRoomSelection
        preselectedRoomIds={[room.id]}
        className="mt-6"
      >
      {/* Description */}
      <section id="about" className="scroll-mt-28 py-10 first:pt-0">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[22px] font-semibold tracking-tight">
            About this room
          </h2>
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
        </div>
        {room.description ? (
          <p className="mt-4 whitespace-pre-wrap leading-relaxed text-foreground/90">
            {room.description}
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            No description yet. Add one to tell guests about this room.
          </p>
        )}
      </section>

      {/* Where guests sleep */}
      <section id="sleeping" className="scroll-mt-28 py-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[22px] font-semibold tracking-tight">
            Where guests sleep
          </h2>
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
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {room.beds.map((bed: string, i: number) => (
            <div key={i} className="rounded-xl border p-4">
              <BedDouble className="h-7 w-7" strokeWidth={1.5} />
              <p className="mt-3 font-medium">{bedLabel(bed)} bed</p>
            </div>
          ))}
        </div>
      </section>

      {/* What this room offers */}
      <section id="amenities" className="scroll-mt-28 py-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-[22px] font-semibold tracking-tight">
            What this room offers
          </h2>
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
        </div>
        {room.amenities && room.amenities.length > 0 ? (
          <ul className="mt-6 grid gap-x-10 gap-y-4 sm:grid-cols-2">
            {room.amenities.map((a: Amenity) => (
              <li
                key={a.key}
                className="flex items-start gap-4 border-b border-border/60 pb-4"
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
            No amenities listed for this room yet.
          </p>
        )}
      </section>

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

      {/* Danger zone */}
      <section className="py-10">
        <h2 className="text-[22px] font-semibold tracking-tight text-destructive">
          Danger zone
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-destructive/40 p-4">
          <div>
            <p className="font-medium">Delete this room</p>
            <p className="text-sm text-muted-foreground">
              Permanently remove {room.name}. This can&apos;t be undone and may
              affect existing bookings.
            </p>
          </div>
          <DeleteRoomButton
            roomId={room.id}
            roomName={room.name}
            redirectTo={`/dashboard/${slug}/overview`}
            withLabel
          />
        </div>
      </section>
      </HostPageShell>
    </div>
  );
}
