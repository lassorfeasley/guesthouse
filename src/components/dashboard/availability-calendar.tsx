'use client';

import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { datesOverlap } from '@/lib/dates';

interface CalendarBooking {
  id: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  /** Pending approval — shown differently from confirmed stays. */
  pending?: boolean;
}

interface CalendarBlock {
  id: string;
  start_date: string;
  end_date: string;
}

interface RoomAvailability {
  bookings: CalendarBooking[];
  blocks: CalendarBlock[];
}

interface CalendarRoom {
  id: string;
  name: string;
}

/** One room that is taken on a given day (booking or owner block). */
interface TakenRoom {
  roomName: string;
  guestName?: string;
  pending?: boolean;
  blocked?: boolean;
  bookingId?: string;
}

interface DateRange {
  start: string;
  end: string;
}

export interface CalendarSelection {
  checkIn: string | null;
  checkOut: string | null;
}

export type DateField = 'checkIn' | 'checkOut';

interface AvailabilityCalendarProps {
  bookings: CalendarBooking[];
  blocks?: CalendarBlock[];
  monthsToShow?: number;
  /** Enables date-range selection. */
  selectable?: boolean;
  value?: CalendarSelection;
  onChange?: (value: CalendarSelection) => void;
  /** If provided, only days within these ranges can be selected. */
  allowedRanges?: DateRange[];
  /** Which field the next calendar click should fill. */
  activeField?: DateField | null;
  onActiveFieldChange?: (field: DateField | null) => void;
  /** If set, booked days link to `${bookingHrefBase}/${bookingId}`. */
  bookingHrefBase?: string;
  /**
   * Full in-scope room set. When provided alongside `roomAvailability`, the
   * calendar treats availability per-room: a day is only fully blocked when
   * every room is taken; days with some rooms free stay selectable.
   */
  rooms?: CalendarRoom[];
  roomAvailability?: Record<string, RoomAvailability>;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const INNER =
  'flex h-full w-full items-center justify-center rounded-full text-sm transition-colors';

function DayTooltip({
  label,
  children,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (!label) return <>{children}</>;
  return (
    <span className="group/day relative flex h-full w-full items-center justify-center">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-1.5 max-w-[14rem] -translate-x-1/2 scale-95 whitespace-nowrap rounded-md bg-foreground px-2.5 py-1.5 text-center text-xs font-medium leading-tight text-background opacity-0 shadow-md transition-all duration-150 group-hover/day:scale-100 group-hover/day:opacity-100"
      >
        {label}
        <span className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
      </span>
    </span>
  );
}

function coversDay(day: Date, start: string, end: string): boolean {
  try {
    return isWithinInterval(day, {
      start: parseISO(start),
      end: addDays(parseISO(end), -1),
    });
  } catch {
    return false;
  }
}

/** Which rooms are taken on a given day, across the full room set. */
function takenRoomsForDay(
  day: Date,
  rooms: CalendarRoom[],
  roomAvailability: Record<string, RoomAvailability>
): TakenRoom[] {
  const taken: TakenRoom[] = [];
  for (const room of rooms) {
    const avail = roomAvailability[room.id];
    if (!avail) continue;
    const booking = avail.bookings.find((b) =>
      coversDay(day, b.checkIn, b.checkOut)
    );
    if (booking) {
      taken.push({
        roomName: room.name,
        guestName: booking.guestName,
        pending: booking.pending,
        bookingId: booking.id,
      });
      continue;
    }
    const block = avail.blocks.find((bl) =>
      coversDay(day, bl.start_date, bl.end_date)
    );
    if (block) {
      taken.push({ roomName: room.name, blocked: true });
    }
  }
  return taken;
}

/** Tooltip line for a taken room: prefer "Guest · Room", else "Room". */
function takenRoomLabel(t: TakenRoom): string {
  const base =
    t.blocked || !t.guestName || t.guestName === 'Booked'
      ? t.roomName
      : `${t.guestName} · ${t.roomName}`;
  if (t.blocked) return `${base} · Blocked`;
  return t.pending ? `${base} (pending)` : base;
}

function TakenRoomsTooltip({ taken }: { taken: TakenRoom[] }) {
  return (
    <span className="flex flex-col gap-0.5">
      {taken.map((t, i) => (
        <span key={i}>{takenRoomLabel(t)}</span>
      ))}
    </span>
  );
}

function MonthGrid({
  month,
  bookings,
  blocks,
  rooms,
  roomAvailability,
  roomMode,
  selectable,
  value,
  isSelectable,
  onSelect,
  bookingHrefBase,
}: {
  month: Date;
  bookings: CalendarBooking[];
  blocks: CalendarBlock[];
  rooms?: CalendarRoom[];
  roomAvailability?: Record<string, RoomAvailability>;
  roomMode: boolean;
  selectable: boolean;
  value?: CalendarSelection;
  isSelectable: (dateStr: string) => boolean;
  onSelect: (dateStr: string) => void;
  bookingHrefBase?: string;
}) {
  const today = startOfDay(new Date());
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(month),
        end: endOfMonth(month),
      }),
    [month]
  );
  const startPad = startOfMonth(month).getDay();

  return (
    <div>
      <p className="mb-5 text-center text-base font-semibold">
        {format(month, 'MMMM yyyy')}
      </p>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="pb-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          // Per-room availability when the full room set is supplied; otherwise
          // fall back to the flat booking/block lists.
          const taken: TakenRoom[] =
            roomMode && rooms && roomAvailability
              ? takenRoomsForDay(day, rooms, roomAvailability)
              : [];
          const booked = bookings.filter((b) =>
            coversDay(day, b.checkIn, b.checkOut)
          );
          const isBlocked = blocks.some((bl) =>
            coversDay(day, bl.start_date, bl.end_date)
          );
          const isPast = isBefore(day, today);
          const isToday = isSameDay(day, today);

          const totalRooms = rooms?.length ?? 0;
          const fullyBooked = roomMode
            ? taken.length >= totalRooms && totalRooms > 0
            : booked.length > 0 || isBlocked;
          const partial = roomMode && taken.length > 0 && !fullyBooked;

          const hasPending = roomMode
            ? taken.some((t) => t.pending)
            : booked.some((b) => b.pending);
          const hasConfirmed = booked.some((b) => !b.pending);
          const unavailable = fullyBooked;

          const representativeBookingId = roomMode
            ? taken.find((t) => t.bookingId)?.bookingId
            : booked[0]?.id;
          const bookingHref =
            bookingHrefBase && representativeBookingId
              ? `${bookingHrefBase}/${representativeBookingId}`
              : undefined;

          // Tooltip: list of taken rooms (room mode) or guest names (legacy).
          const tooltip: React.ReactNode = roomMode
            ? taken.length > 0
              ? <TakenRoomsTooltip taken={taken} />
              : undefined
            : booked.length > 0
              ? booked
                  .map((b) =>
                    b.pending ? `${b.guestName} (pending)` : b.guestName
                  )
                  .join(', ')
              : isBlocked
                ? 'Blocked'
                : undefined;
          const title = tooltip;

          if (selectable) {
            const dateStr = format(day, 'yyyy-MM-dd');
            const selDay = isSelectable(dateStr);
            const isStart = value?.checkIn === dateStr;
            const isEnd = value?.checkOut === dateStr;
            const endpoint = isStart || isEnd;
            const inRange =
              !!value?.checkIn &&
              !!value?.checkOut &&
              dateStr > value.checkIn &&
              dateStr < value.checkOut;

            const anyTaken = roomMode
              ? taken.length > 0
              : booked.length > 0 || isBlocked;

            const partialDot = partial ? (
              <span
                className="pointer-events-none absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-red-500"
                aria-hidden
              />
            ) : null;

            return (
              <div
                key={day.toISOString()}
                className="flex aspect-square items-center justify-center p-1.5"
              >
                {isPast ? (
                  // Past days aren't actionable — render like an empty day, but
                  // keep a faded dot (and hover) to show a stay was there.
                  <DayTooltip label={anyTaken ? title : undefined}>
                    <span className={cn(INNER, 'relative text-muted-foreground/40')}>
                      {format(day, 'd')}
                      {anyTaken && (
                        <span
                          className="pointer-events-none absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-red-500/40"
                          aria-hidden
                        />
                      )}
                    </span>
                  </DayTooltip>
                ) : selDay ? (
                  <DayTooltip label={partial ? title : undefined}>
                    <button
                      type="button"
                      onClick={() => onSelect(dateStr)}
                      className={cn(
                        INNER,
                        'relative',
                        endpoint &&
                          'bg-blue-600 font-semibold text-white shadow-sm dark:bg-blue-500',
                        !endpoint && inRange && 'bg-blue-500/15 text-foreground',
                        !endpoint &&
                          !inRange &&
                          'text-foreground hover:bg-blue-500/10',
                        !endpoint &&
                          isToday &&
                          'ring-1 ring-inset ring-foreground'
                      )}
                    >
                      {format(day, 'd')}
                      {partialDot}
                    </button>
                  </DayTooltip>
                ) : bookingHref ? (
                  <DayTooltip label={title}>
                    <Link
                      href={bookingHref}
                      className={cn(
                        INNER,
                        'bg-red-500/10 font-medium text-red-600 line-through decoration-red-400/60 ring-1 ring-inset ring-red-500/30 transition hover:ring-2 hover:ring-red-500/50 dark:text-red-400'
                      )}
                    >
                      {format(day, 'd')}
                    </Link>
                  </DayTooltip>
                ) : (
                  <DayTooltip label={title}>
                    <span
                      className={cn(
                        INNER,
                        unavailable
                          ? 'bg-red-500/10 font-medium text-red-600 line-through decoration-red-400/60 ring-1 ring-inset ring-red-500/30 dark:text-red-400'
                          : 'text-muted-foreground/40'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </DayTooltip>
                )}
              </div>
            );
          }

          const blockedOnly = isBlocked && booked.length === 0;
          const dayClass = cn(
            INNER,
            isToday &&
              !unavailable &&
              'font-semibold ring-1 ring-inset ring-foreground',
            isPast && !unavailable && 'text-muted-foreground/50',
            !unavailable && !isPast && 'text-foreground hover:bg-muted',
            hasConfirmed && 'bg-foreground font-medium text-background',
            hasPending &&
              !hasConfirmed &&
              'bg-amber-100 font-medium text-amber-900 ring-1 ring-inset ring-amber-300',
            hasPending &&
              hasConfirmed &&
              'bg-foreground font-medium text-background ring-2 ring-inset ring-amber-300',
            blockedOnly &&
              'bg-muted font-medium text-muted-foreground ring-1 ring-inset ring-border'
          );

          return (
            <div
              key={day.toISOString()}
              className="flex aspect-square items-center justify-center p-1.5"
            >
              <DayTooltip label={title}>
                {bookingHref ? (
                  <Link
                    href={bookingHref}
                    className={cn(
                      dayClass,
                      'transition hover:ring-2 hover:ring-foreground/40'
                    )}
                  >
                    {format(day, 'd')}
                  </Link>
                ) : (
                  <span className={dayClass}>{format(day, 'd')}</span>
                )}
              </DayTooltip>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AvailabilityCalendar({
  bookings,
  blocks = [],
  monthsToShow = 2,
  selectable = false,
  value,
  onChange,
  allowedRanges = [],
  activeField = null,
  onActiveFieldChange,
  bookingHrefBase,
  rooms,
  roomAvailability,
}: AvailabilityCalendarProps) {
  const [base, setBase] = useState(() => startOfMonth(new Date()));
  const today = startOfDay(new Date());

  // Per-room mode: availability is computed across the full room set, so a day
  // is only un-selectable when *every* room is taken. Falls back to the flat
  // bookings/blocks lists for display-only calendars.
  const roomMode = !!(rooms && rooms.length > 0 && roomAvailability);

  const months = Array.from({ length: monthsToShow }, (_, i) =>
    addMonths(base, i)
  );

  /** A single room is free for the whole stay [start, end) (nights only). */
  function roomFreeForRange(roomId: string, start: string, end: string): boolean {
    const avail = roomAvailability?.[roomId];
    if (!avail) return true;
    const blockedByBooking = avail.bookings.some((b) =>
      datesOverlap(start, end, b.checkIn, b.checkOut)
    );
    if (blockedByBooking) return false;
    return !avail.blocks.some((bl) =>
      datesOverlap(start, end, bl.start_date, bl.end_date)
    );
  }

  /** At least one room is free for the entire range. */
  function rangeHasFreeRoom(start: string, end: string): boolean {
    if (!roomMode) return true;
    return rooms!.some((r) => roomFreeForRange(r.id, start, end));
  }

  function dayFullyBooked(day: Date): boolean {
    if (roomMode) {
      return takenRoomsForDay(day, rooms!, roomAvailability!).length >= rooms!.length;
    }
    const booked = bookings.some((b) => coversDay(day, b.checkIn, b.checkOut));
    const blocked = blocks.some((bl) =>
      coversDay(day, bl.start_date, bl.end_date)
    );
    return booked || blocked;
  }

  function isSelectable(dateStr: string): boolean {
    if (!selectable) return false;
    const day = parseISO(dateStr);
    if (isBefore(day, today)) return false;
    if (dayFullyBooked(day)) return false;
    if (
      allowedRanges.length > 0 &&
      !allowedRanges.some((r) => dateStr >= r.start && dateStr <= r.end)
    ) {
      return false;
    }
    return true;
  }

  /** True when no room can span the whole range, or interior days are blocked. */
  function rangeBlocked(start: string, end: string): boolean {
    // Endpoints + interior must fall inside any allowed window / not be past.
    const span = eachDayOfInterval({
      start: parseISO(start),
      end: addDays(parseISO(end), -1),
    });
    const day = startOfDay(new Date());
    for (const d of span) {
      const ds = format(d, 'yyyy-MM-dd');
      if (isBefore(d, day)) return true;
      if (
        allowedRanges.length > 0 &&
        !allowedRanges.some((r) => ds >= r.start && ds <= r.end)
      ) {
        return true;
      }
    }
    if (roomMode) return !rangeHasFreeRoom(start, end);
    // Legacy: every interior night must individually be free.
    return span.slice(1).some((d) => dayFullyBooked(d));
  }

  function handleSelect(dateStr: string) {
    if (!onChange) return;
    const checkIn = value?.checkIn ?? null;
    const checkOut = value?.checkOut ?? null;

    // Determine which field this click fills: respect an explicit focus,
    // otherwise infer (check-in first, then check-out).
    const field: DateField =
      activeField ?? (!checkIn || (checkIn && checkOut) ? 'checkIn' : 'checkOut');

    if (field === 'checkOut') {
      // A valid checkout must be after check-in with a room free across the span.
      if (checkIn && dateStr > checkIn && !rangeBlocked(checkIn, dateStr)) {
        onChange({ checkIn, checkOut: dateStr });
        onActiveFieldChange?.(null);
        return;
      }
      // Otherwise treat the click as a new check-in.
      onChange({ checkIn: dateStr, checkOut: null });
      onActiveFieldChange?.('checkOut');
      return;
    }

    // field === 'checkIn' — keep an existing checkout only if still valid.
    if (checkOut && dateStr < checkOut && !rangeBlocked(dateStr, checkOut)) {
      onChange({ checkIn: dateStr, checkOut });
      onActiveFieldChange?.(null);
      return;
    }
    onChange({ checkIn: dateStr, checkOut: null });
    onActiveFieldChange?.('checkOut');
  }

  return (
    <div>
      <div className="relative">
        <button
          type="button"
          onClick={() => setBase((m) => addMonths(m, -1))}
          aria-label="Previous month"
          className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => setBase((m) => addMonths(m, 1))}
          aria-label="Next month"
          className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div
          className={cn(
            'grid gap-y-10',
            monthsToShow > 1 ? 'gap-x-16 px-10 sm:grid-cols-2' : 'px-2'
          )}
        >
          {months.map((m) => (
            <MonthGrid
              key={m.toISOString()}
              month={m}
              bookings={bookings}
              blocks={blocks}
              rooms={rooms}
              roomAvailability={roomAvailability}
              roomMode={roomMode}
              selectable={selectable}
              value={value}
              isSelectable={isSelectable}
              onSelect={handleSelect}
              bookingHrefBase={bookingHrefBase}
            />
          ))}
        </div>
      </div>
      {!selectable && (bookings.length > 0 || blocks.length > 0) && (
        <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {bookings.some((b) => !b.pending) && (
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                1
              </span>
              Confirmed stay
            </span>
          )}
          {bookings.some((b) => b.pending) && (
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-medium text-amber-900 ring-1 ring-inset ring-amber-300">
                1
              </span>
              Pending request
            </span>
          )}
          {blocks.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                1
              </span>
              Blocked
            </span>
          )}
          <span className="w-full sm:w-auto">
            Hover a date to see who&apos;s staying.
          </span>
        </div>
      )}
    </div>
  );
}
