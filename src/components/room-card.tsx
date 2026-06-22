'use client';

import Image from 'next/image';
import { Check } from 'lucide-react';
import { summarizeBeds } from '@/lib/validations';
import { cn } from '@/lib/utils';
import { PlaceholderImage } from '@/components/placeholder-image';

export type RoomCardRoom = {
  id?: string | null;
  name: string;
  image_url: string | null;
  beds: string[];
  max_occupancy: number;
  description?: string | null;
};

type RoomCardProps = {
  room: RoomCardRoom;
  className?: string;
  /** Slightly smaller type for dense layouts like dialogs. */
  compact?: boolean;
  showDescription?: boolean;
};

export function RoomCard({
  room,
  className,
  compact = false,
}: RoomCardProps) {
  const titleClass = compact ? 'text-base' : 'text-lg';
  const metaClass = compact ? 'text-sm' : 'text-base';
  // Mobile: a compact thumbnail with details beside it (like the person card).
  // sm and up: the full stacked card with an image on top.
  const imageWrapperClass =
    'relative aspect-4/3 w-28 shrink-0 overflow-hidden rounded-xl sm:w-full sm:rounded-2xl';

  return (
    <div
      className={cn('flex items-center gap-4 sm:block sm:items-stretch', className)}
    >
      {room.image_url ? (
        <div className={imageWrapperClass}>
          <Image
            src={room.image_url}
            alt={room.name}
            fill
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        </div>
      ) : (
        <PlaceholderImage
          type="room"
          name={room.name}
          seed={room.id}
          className={imageWrapperClass}
          iconClassName="h-9 w-9 transition duration-300 group-hover:scale-105"
        />
      )}
      <div className="min-w-0 flex-1 sm:mt-4">
        <p className={cn('font-medium', titleClass)}>{room.name}</p>
        <p className={cn('text-muted-foreground', metaClass)}>
          {summarizeBeds(room.beds)} · Up to {room.max_occupancy} guests
        </p>
      </div>
    </div>
  );
}

type SelectableRoomCardProps = {
  room: RoomCardRoom;
  selected: boolean;
  onToggle: () => void;
};

export function SelectableRoomCard({
  room,
  selected,
  onToggle,
}: SelectableRoomCardProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'group block w-full rounded-xl text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-xl ring-1 transition',
          selected ? 'ring-2 ring-foreground' : 'ring-border'
        )}
      >
        {room.image_url ? (
          <div className="relative aspect-4/3 w-full">
            <Image
              src={room.image_url}
              alt={room.name}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <PlaceholderImage
            type="room"
            name={room.name}
            seed={room.id}
            className="aspect-4/3 w-full"
            iconClassName="h-9 w-9 transition duration-300 group-hover:scale-105"
          />
        )}
        {selected && (
          <span className="absolute right-2.5 top-2.5 flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
            <Check className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      <p className="mt-2.5 text-sm font-medium">{room.name}</p>
      <p className="text-sm text-muted-foreground">
        {summarizeBeds(room.beds)} · Up to {room.max_occupancy} guests
      </p>
    </button>
  );
}
