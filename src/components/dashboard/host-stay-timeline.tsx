'use client';

import { useMemo } from 'react';
import { useBooking } from '@/components/guest/booking-context';
import {
  StayTimeline,
  type TimelineRow,
  type TimelineStay,
} from '@/components/stay-timeline';

/**
 * Host-dashboard view of the stay timeline. Reads the live booking context
 * (all property rooms + their bookings and owner blocks) and feeds it into the
 * shared {@link StayTimeline}. One row per room; confirmed/pending bookings and
 * owner blocks render as bands across a scrollable date window.
 */
export function HostStayTimeline({
  windowStart,
  windowDays,
  bookingHrefBase,
}: {
  windowStart: string;
  windowDays: number;
  /** If set, booking bands link to `${bookingHrefBase}/${bookingId}`. */
  bookingHrefBase?: string;
}) {
  const { rooms, roomAvailability } = useBooking();

  const rows = useMemo<TimelineRow[]>(
    () =>
      rooms.map((room) => {
        const avail = roomAvailability[room.id];
        const stays: TimelineStay[] = [
          ...(avail?.bookings ?? []).map((b) => ({
            id: `booking-${b.id}`,
            label: b.guestName,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            variant: (b.pending ? 'pending' : 'confirmed') as TimelineStay['variant'],
            href: bookingHrefBase ? `${bookingHrefBase}/${b.id}` : undefined,
          })),
          ...(avail?.blocks ?? []).map((bl) => ({
            id: `block-${bl.id}`,
            label: 'Blocked',
            checkIn: bl.start_date,
            checkOut: bl.end_date,
            variant: 'blocked' as TimelineStay['variant'],
          })),
        ];
        return { id: room.id, label: room.name, stays };
      }),
    [rooms, roomAvailability, bookingHrefBase]
  );

  return (
    <StayTimeline
      rows={rows}
      windowStart={windowStart}
      windowDays={windowDays}
      showMonths
      startAtToday
      showLegend
      emptyLabel="No rooms yet — add a room to start scheduling stays."
    />
  );
}
