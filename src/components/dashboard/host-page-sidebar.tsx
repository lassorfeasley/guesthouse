'use client';

import { useState } from 'react';
import { format, parseISO, differenceInCalendarDays } from 'date-fns';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RoomAvailability } from '@/lib/guest-calendar';
import type { Room } from '@/types/database';
import { useBooking } from '@/components/guest/booking-context';
import { HouseCalendar } from '@/components/guest/house-calendar';
import { InviteGuestDialog } from '@/components/dashboard/invite-guest-dialog';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';

function formatBox(date: string | null): string {
  if (!date) return 'Add date';
  return format(parseISO(date), 'EEE, MMM d');
}

function DateBox({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'p-3 text-left transition-colors hover:bg-muted/50',
        active && 'rounded-[10px] ring-2 ring-inset ring-foreground'
      )}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm">{value}</p>
    </button>
  );
}

export function HostPageSidebar({
  propertyId,
  rooms,
  roomAvailability,
  preselectedRoomIds,
}: {
  propertyId: string;
  rooms: Room[];
  roomAvailability: Record<string, RoomAvailability>;
  preselectedRoomIds?: string[];
}) {
  const {
    checkIn,
    checkOut,
    guests,
    activeField,
    setGuests,
    setActiveField,
    clear,
    maxGuests,
  } = useBooking();

  const [calendarOpen, setCalendarOpen] = useState(false);

  const nights =
    checkIn && checkOut
      ? differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn))
      : 0;

  function openField(field: 'checkIn' | 'checkOut') {
    setActiveField(field);
    setCalendarOpen(true);
  }

  const disabled = rooms.length === 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-6 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
        <div className="flex items-baseline justify-between">
          <p className="text-xl font-semibold">
            {nights > 0
              ? `${nights} ${nights === 1 ? 'night' : 'nights'}`
              : 'Invite a guest'}
          </p>
          {nights > 0 && checkIn && checkOut && (
            <p className="text-sm text-muted-foreground">
              {format(parseISO(checkIn), 'MMM d')} –{' '}
              {format(parseISO(checkOut), 'MMM d')}
            </p>
          )}
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border">
          <Popover
            open={calendarOpen}
            onOpenChange={(open) => {
              setCalendarOpen(open);
              if (!open) setActiveField(null);
            }}
          >
            <PopoverAnchor asChild>
              <div>
                <div className="grid grid-cols-2 divide-x">
                  <DateBox
                    label="Check-in"
                    value={formatBox(checkIn)}
                    active={calendarOpen && activeField === 'checkIn'}
                    onClick={() => openField('checkIn')}
                  />
                  <DateBox
                    label="Checkout"
                    value={formatBox(checkOut)}
                    active={calendarOpen && activeField === 'checkOut'}
                    onClick={() => openField('checkOut')}
                  />
                </div>
                <div className="flex items-center justify-between border-t p-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Guests
                    </p>
                    <p className="mt-0.5 text-sm">
                      {guests} {guests === 1 ? 'guest' : 'guests'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label="Decrease guests"
                      disabled={guests <= 1}
                      onClick={() => setGuests(Math.max(1, guests - 1))}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-4 text-center text-sm tabular-nums">
                      {guests}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      aria-label="Increase guests"
                      disabled={guests >= maxGuests}
                      onClick={() => setGuests(Math.min(maxGuests, guests + 1))}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </PopoverAnchor>
            <PopoverContent align="end" sideOffset={8} className="w-[320px] p-3">
              <HouseCalendar monthsToShow={1} />
              <div className="mt-2 flex items-center justify-between border-t pt-3">
                <button
                  type="button"
                  onClick={clear}
                  className="text-sm font-medium underline underline-offset-2"
                >
                  Clear dates
                </button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCalendarOpen(false)}
                >
                  Close
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <InviteGuestDialog
          propertyId={propertyId}
          rooms={rooms}
          roomAvailability={roomAvailability}
          useParentBookingContext
          preselectedRoomIds={preselectedRoomIds}
          trigger={
            <Button className="mt-4 w-full" size="lg" disabled={disabled}>
              Book a guest
            </Button>
          }
        />

        {(checkIn || checkOut) && (
          <button
            type="button"
            onClick={clear}
            className="mx-auto mt-3 block text-sm font-medium underline underline-offset-2"
          >
            Clear dates
          </button>
        )}
      </div>
    </div>
  );
}
