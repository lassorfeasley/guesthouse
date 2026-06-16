'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addDays,
  differenceInDays,
  format,
  isAfter,
  isBefore,
  isSameDay,
  parseISO,
  startOfDay,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/*
 * Shared room-by-room stay timeline. A horizontal, Gantt-style schedule: one
 * row per room, with stays drawn as labeled bands across a scrollable date
 * window. Purely presentational and date-driven — both the landing-page
 * showcase (hardcoded demo data) and the host dashboard (live bookings) feed it
 * the same `rows` shape. Status colors mirror the rest of the calendar system:
 * pine = confirmed, brass = pending, muted = owner block.
 */

export type TimelineStayVariant = 'confirmed' | 'pending' | 'blocked';

export interface TimelineStay {
  id: string;
  /** Text shown inside the band (e.g. guest name, or "Blocked"). */
  label?: string;
  /** ISO date (yyyy-MM-dd) of the first occupied night. */
  checkIn: string;
  /** ISO date (yyyy-MM-dd), exclusive — the checkout morning is not occupied. */
  checkOut: string;
  variant: TimelineStayVariant;
  /** When set, the band becomes a link (e.g. to the booking detail page). */
  href?: string;
}

export interface TimelineRow {
  id: string;
  /** Row heading (e.g. room name). */
  label: string;
  /** Optional grouping (e.g. home name). Consecutive rows sharing a group get
   * a group header row above them, and their labels are indented. */
  group?: string;
  stays: TimelineStay[];
}

interface StayTimelineProps {
  rows: TimelineRow[];
  /** First day shown, ISO (yyyy-MM-dd). */
  windowStart: string;
  /** Number of day columns rendered across the (scrollable) window. */
  windowDays: number;
  /** Heading shown above the sticky row-label column. */
  rowHeading?: string;
  /** Width of each day column, in px. */
  dayWidth?: number;
  /** Width of the sticky row-label column, in px. */
  labelWidth?: number;
  /**
   * Background utility for the sticky label column — must match the surface the
   * timeline sits on so bands don't show through when scrolled. Defaults to the
   * page background; pass `bg-card` inside a card.
   */
  surfaceClassName?: string;
  /** Renders a legend of the stay variants present in `rows`. */
  showLegend?: boolean;
  /** Renders a month label band above the day columns. */
  showMonths?: boolean;
  /** Message shown when there are no rows. */
  emptyLabel?: string;
  className?: string;
}

const STAY_CLASS: Record<TimelineStayVariant, string> = {
  confirmed: 'bg-primary text-primary-foreground',
  pending: 'border border-dashed border-brass-foreground/60 bg-brass text-brass-foreground',
  blocked: 'bg-muted text-muted-foreground',
};

const STAY_HOVER_CLASS: Record<TimelineStayVariant, string> = {
  confirmed: 'hover:bg-primary/90',
  pending: 'hover:bg-brass/90',
  blocked: 'hover:bg-muted/80',
};

const DOT_CLASS: Record<TimelineStayVariant, string> = {
  confirmed: 'bg-primary',
  pending: 'bg-brass',
  blocked: 'bg-muted-foreground/50',
};

const LEGEND: { variant: TimelineStayVariant; label: string }[] = [
  { variant: 'confirmed', label: 'Confirmed stay' },
  { variant: 'pending', label: 'Pending request' },
  { variant: 'blocked', label: 'Blocked' },
];

function isWeekend(day: Date): boolean {
  const d = day.getDay();
  return d === 0 || d === 6;
}

/** Place a stay within the window, clamping (and flagging) any clipped ends. */
function placeStay(
  stay: TimelineStay,
  windowStartDay: Date,
  windowEndDay: Date
): { colStart: number; colEnd: number; clipLeft: boolean; clipRight: boolean } | null {
  let firstNight: Date;
  let lastNight: Date;
  try {
    firstNight = startOfDay(parseISO(stay.checkIn));
    // Exclusive checkout: the last occupied day is the night before checkout.
    lastNight = addDays(startOfDay(parseISO(stay.checkOut)), -1);
  } catch {
    return null;
  }
  if (isAfter(firstNight, lastNight)) return null;
  if (isAfter(firstNight, windowEndDay) || isBefore(lastNight, windowStartDay)) {
    return null;
  }

  const clipLeft = isBefore(firstNight, windowStartDay);
  const clipRight = isAfter(lastNight, windowEndDay);
  const occStart = clipLeft ? windowStartDay : firstNight;
  const occEnd = clipRight ? windowEndDay : lastNight;

  // Grid columns are 1-based; the end line is exclusive (last column + 1).
  const colStart = differenceInDays(occStart, windowStartDay) + 1;
  const colEnd = differenceInDays(occEnd, windowStartDay) + 2;
  return { colStart, colEnd, clipLeft, clipRight };
}

function StayBand({
  stay,
  windowStartDay,
  windowEndDay,
}: {
  stay: TimelineStay;
  windowStartDay: Date;
  windowEndDay: Date;
}) {
  const placed = placeStay(stay, windowStartDay, windowEndDay);
  if (!placed) return null;

  const inner = (
    <>
      <span
        className="size-1.5 shrink-0 rounded-full bg-current opacity-80"
        aria-hidden
      />
      {stay.label ? <span className="truncate">{stay.label}</span> : null}
    </>
  );

  const bandClass = cn(
    'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium leading-none',
    STAY_CLASS[stay.variant],
    placed.clipLeft && 'rounded-l-none',
    placed.clipRight && 'rounded-r-none',
    stay.href && cn('transition-colors', STAY_HOVER_CLASS[stay.variant])
  );

  return (
    <div
      style={{ gridColumnStart: placed.colStart, gridColumnEnd: placed.colEnd }}
      className="flex min-w-0 items-center px-0.5"
    >
      {stay.href ? (
        <Link href={stay.href} className={bandClass} title={stay.label}>
          {inner}
        </Link>
      ) : (
        <span className={bandClass} title={stay.label}>
          {inner}
        </span>
      )}
    </div>
  );
}

export function StayTimeline({
  rows,
  windowStart,
  windowDays,
  rowHeading = 'Guest rooms',
  dayWidth = 40,
  labelWidth = 112,
  surfaceClassName = 'bg-background',
  showLegend = false,
  showMonths = false,
  emptyLabel = 'Nothing scheduled yet.',
  className,
}: StayTimelineProps) {
  const startDay = startOfDay(parseISO(windowStart));
  const days = Array.from({ length: windowDays }, (_, i) => addDays(startDay, i));
  const windowEndDay = days[days.length - 1] ?? startDay;
  const today = startOfDay(new Date());
  const trackWidth = windowDays * dayWidth;
  const gridCols = `repeat(${windowDays}, minmax(0, 1fr))`;

  // Contiguous runs of days that share a calendar month, for the month band.
  const monthSegments: { label: string; startCol: number; endCol: number }[] = [];
  for (let i = 0; i < days.length; ) {
    let j = i;
    while (
      j < days.length &&
      days[j].getMonth() === days[i].getMonth() &&
      days[j].getFullYear() === days[i].getFullYear()
    ) {
      j++;
    }
    monthSegments.push({
      label: format(days[i], 'MMMM yyyy'),
      startCol: i + 1,
      endCol: j + 1,
    });
    i = j;
  }

  const presentVariants = new Set<TimelineStayVariant>();
  for (const row of rows) {
    for (const stay of row.stays) presentVariants.add(stay.variant);
  }

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 1);
    setCanScrollRight(Math.ceil(scrollLeft) < scrollWidth - clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, windowDays, rows.length]);

  const scrollByPage = useCallback(
    (direction: -1 | 1) => {
      const el = scrollRef.current;
      if (!el) return;
      // Page by the visible track width (keeping one column of overlap for
      // context), snapped to whole day columns.
      const visible = Math.max(el.clientWidth - labelWidth, dayWidth);
      const cols = Math.max(1, Math.floor(visible / dayWidth) - 1);
      el.scrollBy({ left: direction * cols * dayWidth, behavior: 'smooth' });
    },
    [dayWidth, labelWidth]
  );

  const showControls = canScrollLeft || canScrollRight;

  return (
    <div className={cn('min-w-0', className)}>
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div style={{ minWidth: labelWidth + trackWidth }}>
          {/* Month band */}
          {showMonths && (
            <div className="flex items-end">
              <div
                className={cn(
                  'sticky left-0 z-20 shrink-0 self-stretch border-r border-border/60',
                  surfaceClassName
                )}
                style={{ width: labelWidth }}
              />
              <div
                className="grid min-w-0 flex-1"
                style={{ gridTemplateColumns: gridCols }}
              >
                {monthSegments.map((seg) => (
                  <div
                    key={seg.label}
                    style={{ gridColumnStart: seg.startCol, gridColumnEnd: seg.endCol }}
                    className="sticky left-0 truncate pb-1.5 pl-1 text-left text-xs font-semibold uppercase tracking-wide text-foreground/70"
                  >
                    {seg.label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Date header */}
          <div className="flex items-end">
            <div
              className={cn(
                'sticky left-0 z-20 flex shrink-0 items-end self-stretch border-r border-border/60 pb-2',
                surfaceClassName
              )}
              style={{ width: labelWidth }}
            >
              <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
                {rowHeading}
              </span>
            </div>
            <div
              className="grid min-w-0 flex-1 text-center"
              style={{ gridTemplateColumns: gridCols }}
            >
              {days.map((day) => {
                const weekend = isWeekend(day);
                const isToday = isSameDay(day, today);
                return (
                  <div key={day.toISOString()} className="flex flex-col items-center pb-2">
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase',
                        weekend ? 'text-muted-foreground/60' : 'text-muted-foreground'
                      )}
                    >
                      {format(day, 'EEE')}
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 flex size-5 items-center justify-center text-[11px] tabular-nums',
                        isToday
                          ? 'rounded-full bg-primary font-semibold text-primary-foreground'
                          : weekend
                            ? 'text-muted-foreground/60'
                            : 'text-foreground'
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          {rows.length === 0 ? (
            <div className="border-t border-border/60 py-8 text-center text-sm text-muted-foreground">
              {emptyLabel}
            </div>
          ) : (
            <div className="border-t border-border/60">
              {rows.map((row, rowIndex) => {
                const showGroupHeader =
                  !!row.group && row.group !== rows[rowIndex - 1]?.group;
                return (
                <div key={row.id}>
                  {showGroupHeader && (
                    <div className="flex items-stretch border-t border-border/60 first:border-t-0">
                      <div
                        className={cn(
                          'sticky left-0 z-10 flex shrink-0 items-center border-r border-border/60 py-2 pr-3',
                          surfaceClassName
                        )}
                        style={{ width: labelWidth }}
                      >
                        <span className="truncate text-xs font-semibold uppercase tracking-wide text-foreground">
                          {row.group}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1" />
                    </div>
                  )}
                <div className="flex items-stretch">
                  <div
                    className={cn(
                      'sticky left-0 z-10 flex shrink-0 items-center border-r border-border/60 pr-3',
                      row.group ? 'pl-3' : '',
                      surfaceClassName
                    )}
                    style={{ width: labelWidth }}
                  >
                    <span className="truncate text-xs font-medium text-muted-foreground">
                      {row.label}
                    </span>
                  </div>
                  <div className="relative min-w-0 flex-1">
                    {/* Background guides: column borders, weekend + today tint */}
                    <div
                      className="absolute inset-0 grid"
                      style={{ gridTemplateColumns: gridCols }}
                      aria-hidden
                    >
                      {days.map((day, i) => (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            'border-l border-border/40',
                            i === days.length - 1 && 'border-r',
                            isSameDay(day, today)
                              ? 'bg-primary/5'
                              : isWeekend(day) && 'bg-muted/40'
                          )}
                        />
                      ))}
                    </div>
                    {/* Stay bands */}
                    <div
                      className="relative grid h-11 items-center"
                      style={{ gridTemplateColumns: gridCols }}
                    >
                      {row.stays.map((stay) => (
                        <StayBand
                          key={stay.id}
                          stay={stay}
                          windowStartDay={startDay}
                          windowEndDay={windowEndDay}
                        />
                      ))}
                    </div>
                  </div>
                </div>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showControls && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            disabled={!canScrollLeft}
            onClick={() => scrollByPage(-1)}
            aria-label="Scroll back"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-8 rounded-full"
            disabled={!canScrollRight}
            onClick={() => scrollByPage(1)}
            aria-label="Scroll forward"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {showLegend && presentVariants.size > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          {LEGEND.filter((l) => presentVariants.has(l.variant)).map((l) => (
            <span key={l.variant} className="flex items-center gap-1.5">
              <span className={cn('size-2 rounded-full', DOT_CLASS[l.variant])} />
              {l.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
