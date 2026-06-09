'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import { ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { formatDate, nightsBetween } from '@/lib/dates';
import { cn } from '@/lib/utils';

export interface ScheduleStay {
  bookingId: string;
  guestKey: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: string;
  partySize: number;
  roomNames: string[];
  isManual: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function stayTouchesDay(dateStr: string, checkIn: string, checkOut: string) {
  return (
    (dateStr >= checkIn && dateStr < checkOut) || dateStr === checkOut
  );
}

function staysOnDay(stays: ScheduleStay[], dateStr: string) {
  return stays.filter((s) => stayTouchesDay(dateStr, s.checkIn, s.checkOut));
}

function buildTimelineDays(stays: ScheduleStay[]): string[] {
  const daySet = new Set<string>();
  for (const stay of stays) {
    let day = parseISO(stay.checkIn);
    const end = parseISO(stay.checkOut);
    while (day <= end) {
      daySet.add(format(day, 'yyyy-MM-dd'));
      day = addDays(day, 1);
    }
  }
  return Array.from(daySet).sort();
}

function AgendaMonthGrid({
  month,
  stays,
  selectedDate,
  onSelectDate,
}: {
  month: Date;
  stays: ScheduleStay[];
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
}) {
  const today = startOfDay(new Date());
  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });
  const startPad = startOfMonth(month).getDay();

  return (
    <div>
      <p className="mb-4 text-center text-sm font-semibold">
        {format(month, 'MMMM yyyy')}
      </p>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="pb-2">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} className="aspect-square" />
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const count = staysOnDay(stays, dateStr).length;
          const isSelected = selectedDate === dateStr;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={cn(
                'flex aspect-square flex-col items-center justify-center rounded-md text-sm transition-colors',
                isSelected
                  ? 'bg-foreground font-medium text-background'
                  : count > 0
                    ? 'bg-muted/70 font-medium hover:bg-muted'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                isToday && !isSelected && 'ring-1 ring-inset ring-foreground/40'
              )}
            >
              <span>{format(day, 'd')}</span>
              {count > 0 && (
                <span
                  className={cn(
                    'mt-0.5 text-[10px] leading-none',
                    isSelected ? 'text-background/80' : 'text-muted-foreground'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function GuestsScheduleView({
  slug,
  stays,
}: {
  slug: string;
  stays: ScheduleStay[];
}) {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const [base, setBase] = useState(() => startOfMonth(parseISO(today)));
  const calendarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineBottomPad, setTimelineBottomPad] = useState(0);

  const timelineDays = useMemo(() => buildTimelineDays(stays), [stays]);

  const scrollToDay = useCallback(
    (dateStr: string) => {
      const container = timelineRef.current;
      if (!container || timelineDays.length === 0) return;

      let target = dateStr;
      if (!timelineDays.includes(dateStr)) {
        const next = timelineDays.find((d) => d >= dateStr);
        const prev = [...timelineDays].reverse().find((d) => d <= dateStr);
        target = next ?? prev ?? timelineDays[0];
      }

      const el = container.querySelector(`[data-day="${target}"]`);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [timelineDays]
  );

  const handleSelectDate = useCallback((dateStr: string) => {
    setSelectedDate(dateStr);
  }, []);

  const didMount = useRef(false);
  useEffect(() => {
    if (timelineDays.length === 0) return;
    if (!didMount.current) {
      didMount.current = true;
      return;
    }
    const id = requestAnimationFrame(() => scrollToDay(selectedDate));
    return () => cancelAnimationFrame(id);
  }, [selectedDate, scrollToDay, timelineDays.length]);

  useEffect(() => {
    const calendar = calendarRef.current;
    if (!calendar) return;

    function measure() {
      const el = calendarRef.current;
      if (!el) return;
      if (!window.matchMedia('(min-width: 1024px)').matches) {
        setTimelineBottomPad(0);
        return;
      }
      const stickyTop = 64; // lg:top-16
      const pad = Math.max(0, window.innerHeight - stickyTop - el.offsetHeight);
      setTimelineBottomPad(pad);
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(calendar);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [base]);

  if (stays.length === 0) {
    return (
      <div className="rounded-2xl border bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          No stays on the calendar yet.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a manual stay or invite a guest to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,380px)]">
      <div ref={calendarRef} className="lg:sticky lg:top-16">
        <div className="relative">
          <button
            type="button"
            onClick={() => setBase((m) => addMonths(m, -1))}
            aria-label="Previous month"
            className="absolute left-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setBase((m) => addMonths(m, 1))}
            aria-label="Next month"
            className="absolute right-0 top-0 z-10 flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="px-10">
            <AgendaMonthGrid
              month={base}
              stays={stays}
              selectedDate={selectedDate}
              onSelectDate={handleSelectDate}
            />
          </div>
        </div>
      </div>

      <div
        ref={timelineRef}
        className="space-y-4 py-4"
        style={
          timelineBottomPad > 0
            ? { paddingBottom: timelineBottomPad }
            : undefined
        }
      >
          {timelineDays.map((dateStr) => {
            const dayStays = staysOnDay(stays, dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === today;

            return (
              <div
                key={dateStr}
                role="button"
                tabIndex={0}
                data-day={dateStr}
                aria-pressed={isSelected}
                onClick={() => handleSelectDate(dateStr)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectDate(dateStr);
                  }
                }}
                className={cn(
                  'scroll-mt-32 w-full cursor-pointer rounded-2xl p-6 text-left transition-shadow',
                  isSelected
                    ? 'bg-background shadow-[0_6px_16px_rgba(0,0,0,0.12)]'
                    : 'bg-transparent shadow-none hover:bg-background hover:shadow-[0_6px_16px_rgba(0,0,0,0.12)]'
                )}
              >
                <p className="text-sm font-semibold">
                  {formatDate(dateStr, 'EEE, MMM d, yyyy')}
                  {isToday && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Today
                    </span>
                  )}
                </p>

                <ul className="mt-4 divide-y">
                  {dayStays.map((stay) => {
                    const nights = nightsBetween(stay.checkIn, stay.checkOut);

                    return (
                      <li key={`${dateStr}-${stay.bookingId}`}>
                        <Link
                          href={`/dashboard/${slug}/bookings/${stay.bookingId}`}
                          onClick={(e) => {
                            if (!isSelected) {
                              e.preventDefault();
                              handleSelectDate(dateStr);
                              return;
                            }
                            e.stopPropagation();
                          }}
                          className="group -mx-2 block rounded-md px-2 py-3 transition-colors first:pt-0 hover:bg-muted/30"
                          aria-disabled={!isSelected}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium group-hover:underline">
                              {stay.guestName}
                            </p>
                            <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                          <p className="mt-1.5 text-xs text-muted-foreground">
                            {nights} {nights === 1 ? 'night' : 'nights'}
                            {stay.roomNames.length > 0 &&
                              ` · ${stay.roomNames.join(', ')}`}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
      </div>
    </div>
  );
}
