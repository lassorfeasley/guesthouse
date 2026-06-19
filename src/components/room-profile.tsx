import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, BedDouble, Check, ChevronRight } from 'lucide-react';
import { summarizeBeds, BED_SIZE_LABELS } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { PlaceholderImage } from '@/components/placeholder-image';
import type { Amenity } from '@/types/database';

/**
 * Shared presentational pieces for a room profile, used by both the guest
 * invitation room page and the host dashboard room page so the two views stay
 * visually consistent. Each page keeps its own chrome (footer vs dashboard
 * shell), navigation, and primary actions; only the room content is shared.
 *
 * Sections accept an optional `action` slot (the host passes an edit control,
 * the guest passes nothing) and hide themselves when empty unless `showEmpty`
 * is set (the host shows "add one" prompts instead).
 */

export type RoomProfileData = {
  id?: string | null;
  name: string;
  description?: string | null;
  max_occupancy: number;
  beds: string[];
  amenities?: Amenity[] | null;
  image_url: string | null;
};

export function bedLabel(bed: string): string {
  return BED_SIZE_LABELS[bed as keyof typeof BED_SIZE_LABELS] ?? bed;
}

/**
 * "House › Room" breadcrumb. Establishes hierarchy and gives a one-tap path
 * back to the house, so guests/hosts can tell a room view from a house view.
 */
export function RoomBreadcrumb({
  houseHref,
  houseName,
  roomName,
  className,
}: {
  houseHref: string;
  houseName: string;
  roomName: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex min-w-0 items-center gap-1.5 text-sm', className)}
    >
      <Link
        href={houseHref}
        className="inline-flex min-w-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        <span className="truncate">{houseName}</span>
      </Link>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      <span className="truncate font-medium text-foreground">{roomName}</span>
    </nav>
  );
}

/**
 * Persistent card that reinforces "you're inside a house" and offers an
 * obvious return path with the house thumbnail for recognition.
 */
export function ReturnToHouseCard({
  href,
  houseName,
  houseId,
  houseImageUrl,
  label = 'Back to house',
  className,
}: {
  href: string;
  houseName: string;
  houseId?: string | null;
  houseImageUrl?: string | null;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border p-3 transition-colors hover:bg-muted/50',
        className
      )}
    >
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        {houseImageUrl ? (
          <Image
            src={houseImageUrl}
            alt={houseName}
            fill
            className="object-cover"
          />
        ) : (
          <PlaceholderImage
            type="home"
            name={houseName}
            seed={houseId}
            className="h-full w-full"
            iconClassName="h-6 w-6"
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">You&apos;re viewing a room at</p>
        <p className="truncate font-medium">{houseName}</p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-foreground">
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <span className="hidden sm:inline">{label}</span>
      </span>
    </Link>
  );
}

const HEADING_CLASS = 'text-2xl font-semibold tracking-tight';

function RoomSection({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={cn('scroll-mt-24 py-10 first:pt-0', className)}>
      {children}
    </section>
  );
}

function RoomSectionHeading({
  children,
  action,
  headingClassName,
}: {
  children: ReactNode;
  action?: ReactNode;
  headingClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className={cn(HEADING_CLASS, headingClassName)}>{children}</h2>
      {action}
    </div>
  );
}

export function RoomHero({
  room,
  className,
}: {
  room: RoomProfileData;
  className?: string;
}) {
  return (
    <div className={className}>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {room.name}
      </h1>
      <p className="mt-2 text-base text-muted-foreground">
        Up to {room.max_occupancy} guests · {summarizeBeds(room.beds)}
      </p>
    </div>
  );
}

export function RoomAboutSection({
  room,
  id = 'about',
  heading = 'About this room',
  action,
  showEmpty = false,
  className,
  headingClassName,
}: {
  room: RoomProfileData;
  id?: string;
  heading?: string;
  action?: ReactNode;
  showEmpty?: boolean;
  className?: string;
  headingClassName?: string;
}) {
  if (!room.description && !showEmpty) return null;
  return (
    <RoomSection id={id} className={className}>
      <RoomSectionHeading action={action} headingClassName={headingClassName}>
        {heading}
      </RoomSectionHeading>
      {room.description ? (
        <p className="mt-6 whitespace-pre-wrap text-lg leading-relaxed text-foreground/90">
          {room.description}
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          No description yet. Add one to tell guests about this room.
        </p>
      )}
    </RoomSection>
  );
}

export function RoomBedsSection({
  room,
  id = 'sleeping',
  heading = "Where you'll sleep",
  action,
  showEmpty = false,
  className,
  headingClassName,
}: {
  room: RoomProfileData;
  id?: string;
  heading?: string;
  action?: ReactNode;
  showEmpty?: boolean;
  className?: string;
  headingClassName?: string;
}) {
  if (room.beds.length === 0 && !showEmpty) return null;
  return (
    <RoomSection id={id} className={className}>
      <RoomSectionHeading action={action} headingClassName={headingClassName}>
        {heading}
      </RoomSectionHeading>
      {room.beds.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
          {room.beds.map((bed, i) => (
            <div key={i} className="rounded-xl border p-4">
              <BedDouble className="h-7 w-7" strokeWidth={1.5} />
              <p className="mt-3 font-medium">{bedLabel(bed)} bed</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted-foreground">
          No beds added yet.
        </p>
      )}
    </RoomSection>
  );
}

export function RoomAmenitiesSection({
  room,
  id = 'amenities',
  heading = 'What this room offers',
  action,
  showEmpty = false,
  className,
  headingClassName,
}: {
  room: RoomProfileData;
  id?: string;
  heading?: string;
  action?: ReactNode;
  showEmpty?: boolean;
  className?: string;
  headingClassName?: string;
}) {
  const amenities = room.amenities ?? [];
  if (amenities.length === 0 && !showEmpty) return null;
  return (
    <RoomSection id={id} className={className}>
      <RoomSectionHeading action={action} headingClassName={headingClassName}>
        {heading}
      </RoomSectionHeading>
      {amenities.length > 0 ? (
        <ul className="mt-8 grid gap-x-12 gap-y-5 sm:grid-cols-2">
          {amenities.map((a) => (
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
          No amenities listed for this room yet.
        </p>
      )}
    </RoomSection>
  );
}
