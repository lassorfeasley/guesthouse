'use client';

import { Check, Minus, Plus, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/*
 * Static demo artifacts for the landing page scrollytelling section.
 * These are lookalikes of real product surfaces (setup, invitation email,
 * lifecycle correspondence, calendar) built with web design tokens and
 * hardcoded fictional data — never live components, never interactive.
 */

function ArtifactCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Beat 1 — Tell us about your home                                    */
/* ------------------------------------------------------------------ */

const DEMO_ROOMS = [
  {
    name: 'The Garden Room',
    detail: 'Queen bed · sleeps 2',
    image: '/houses/room-garden.png',
  },
  {
    name: 'The Loft',
    detail: 'Two twins · sleeps 2',
    image: '/houses/room-loft.png',
  },
];

const DEMO_AMENITIES = ['Lake access', 'Wi-Fi', 'Wood stove', 'Kayaks', 'Parking'];

export function HouseReadyArtifact() {
  return (
    <ArtifactCard>
      <div className="border-b border-border/60 px-5 py-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-brass">
          Your house
        </p>
        <p className="mt-1 font-display text-xl tracking-tight">
          The Lake House
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 px-5 py-4">
        {DEMO_ROOMS.map((room) => (
          <div key={room.name}>
            <div className="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-border/60">
              <Image
                src={room.image}
                alt={room.name}
                fill
                sizes="200px"
                className="object-cover"
              />
            </div>
            <p className="mt-2 text-sm font-medium">{room.name}</p>
            <p className="text-xs text-muted-foreground">{room.detail}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-border/60 bg-background/60 px-5 py-4">
        {DEMO_AMENITIES.map((amenity) => (
          <span
            key={amenity}
            className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
          >
            {amenity}
          </span>
        ))}
      </div>
    </ArtifactCard>
  );
}

/* ------------------------------------------------------------------ */
/* Beat 2 — Extend the invitation                                      */
/* ------------------------------------------------------------------ */

/* June 2026: the 1st falls on a Monday in a Sunday-first grid. */
const INVITE_DAYS_IN_MONTH = 30;
const INVITE_FIRST_WEEKDAY_OFFSET = 1;

type InviteHighlight = 'guests' | 'dates' | 'send' | null;

interface InviteFrame {
  guests: number;
  start: number | null;
  end: number | null;
  active: InviteHighlight;
  sent?: boolean;
  /** How long this frame stays on screen, in ms. */
  hold: number;
}

/*
 * A scripted "hypothetical guest" filling out an invitation: first nudging
 * the guest count up, then dragging out a date range, then sending. The loop
 * resets to an empty form so the whole gesture replays.
 */
const INVITE_FRAMES: InviteFrame[] = [
  { guests: 2, start: null, end: null, active: null, hold: 1000 },
  { guests: 2, start: null, end: null, active: 'guests', hold: 450 },
  { guests: 3, start: null, end: null, active: 'guests', hold: 420 },
  { guests: 4, start: null, end: null, active: 'guests', hold: 750 },
  { guests: 4, start: 12, end: 12, active: 'dates', hold: 420 },
  { guests: 4, start: 12, end: 13, active: 'dates', hold: 220 },
  { guests: 4, start: 12, end: 14, active: 'dates', hold: 220 },
  { guests: 4, start: 12, end: 15, active: 'dates', hold: 950 },
  { guests: 4, start: 12, end: 15, active: 'send', hold: 650 },
  { guests: 4, start: 12, end: 15, active: 'send', sent: true, hold: 1600 },
];

/* A settled, mid-gesture frame shown when motion is reduced. */
const INVITE_STATIC_FRAME = 7;

function useInviteAnimation(): InviteFrame {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setIndex(INVITE_STATIC_FRAME);
      return;
    }
    const id = setTimeout(() => {
      setIndex((i) => (i + 1) % INVITE_FRAMES.length);
    }, INVITE_FRAMES[index].hold);
    return () => clearTimeout(id);
  }, [index]);

  return INVITE_FRAMES[index];
}

function inviteDayClasses(
  day: number,
  start: number | null,
  end: number | null
): string {
  if (start == null) return 'text-muted-foreground';
  const lo = Math.min(start, end ?? start);
  const hi = Math.max(start, end ?? start);
  if (day < lo || day > hi) return 'text-muted-foreground';
  if (lo === hi)
    return 'rounded-md bg-primary font-medium text-primary-foreground';
  if (day === lo)
    return 'rounded-l-md bg-primary font-medium text-primary-foreground';
  if (day === hi)
    return 'rounded-r-md bg-primary font-medium text-primary-foreground';
  return 'bg-primary/15 text-primary';
}

export function InvitationArtifact() {
  const frame = useInviteAnimation();
  const hasRange = frame.start != null && frame.end != null;

  return (
    <ArtifactCard>
      {/* Guests selector */}
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">Guests</span>
        </div>
        <div className="flex items-center gap-3" aria-hidden>
          <span className="flex size-6 items-center justify-center rounded-full border border-border/60 text-muted-foreground">
            <Minus className="size-3" />
          </span>
          <span
            className={cn(
              'w-4 text-center text-sm font-semibold tabular-nums transition-all duration-300',
              frame.active === 'guests' && 'scale-125 text-primary'
            )}
          >
            {frame.guests}
          </span>
          <span
            className={cn(
              'flex size-6 items-center justify-center rounded-full border text-muted-foreground transition-all duration-300',
              frame.active === 'guests'
                ? 'scale-110 border-primary bg-primary/10 text-primary'
                : 'border-border/60'
            )}
          >
            <Plus className="size-3" />
          </span>
        </div>
      </div>

      {/* Calendar */}
      <div className="px-5 py-4">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-lg tracking-tight">June</p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            2026
          </p>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-xs">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="pb-1 text-[10px] font-medium uppercase text-muted-foreground/70"
            >
              {d}
            </span>
          ))}
          {Array.from({ length: INVITE_FIRST_WEEKDAY_OFFSET }, (_, i) => (
            <span key={`pad-${i}`} />
          ))}
          {Array.from({ length: INVITE_DAYS_IN_MONTH }, (_, i) => i + 1).map(
            (day) => (
              <span
                key={day}
                className={cn(
                  'py-1.5 transition-colors duration-300',
                  inviteDayClasses(day, frame.start, frame.end)
                )}
              >
                {day}
              </span>
            )
          )}
        </div>
      </div>

      {/* Selection summary + CTA */}
      <div className="border-t border-border/60 px-5 py-4">
        <p
          className={cn(
            'mb-3 text-center text-xs transition-opacity duration-300',
            hasRange ? 'text-muted-foreground opacity-100' : 'opacity-0'
          )}
        >
          June {frame.start}&ndash;{frame.end} &middot; {frame.guests} guests
        </p>
        <div
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all duration-300',
            frame.active === 'send' &&
              !frame.sent &&
              'ring-2 ring-brass ring-offset-2 ring-offset-card'
          )}
        >
          {frame.sent ? (
            <>
              Invitation sent
              <Check className="size-4" />
            </>
          ) : (
            <>
              Send invite
              <Send className="size-4" />
            </>
          )}
        </div>
      </div>
    </ArtifactCard>
  );
}

/* ------------------------------------------------------------------ */
/* Beat 3 — We handle the correspondence                               */
/* ------------------------------------------------------------------ */

const DEMO_LETTERS = [
  {
    subject: 'Two weeks until The Lake House',
    snippet: 'A gentle reminder — your stay begins Friday, June 12.',
    className: '-rotate-2',
  },
  {
    subject: 'Welcome — everything for your arrival',
    snippet: 'Directions, the door code, and where to find the kettle.',
    className: 'rotate-1 translate-x-3',
  },
  {
    subject: 'Checkout this morning — safe travels',
    snippet: 'Leave the key on the hook. Margaret says come back soon.',
    className: '-rotate-1 -translate-x-2',
  },
];

export function CorrespondenceArtifact() {
  return (
    <div className="flex flex-col gap-4 py-4">
      {DEMO_LETTERS.map((letter) => (
        <ArtifactCard
          key={letter.subject}
          className={cn('px-5 py-4', letter.className)}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Gracious
            </p>
            <p className="text-[11px] text-muted-foreground">
              sent for you
            </p>
          </div>
          <p className="mt-1.5 text-sm font-medium">{letter.subject}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {letter.snippet}
          </p>
        </ArtifactCard>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Beat 4 — Always know who's arriving Friday                          */
/* ------------------------------------------------------------------ */

/* June 2026: the 1st falls on a Monday in a Sunday-first grid. */
const FIRST_WEEKDAY_OFFSET = 1;
const DAYS_IN_MONTH = 30;

const STAYS = [
  { start: 12, end: 15, label: 'Theo & June', dotClass: 'bg-primary' },
  { start: 19, end: 21, label: 'The Munros', dotClass: 'bg-brass' },
];

function dayClass(day: number): string {
  for (const stay of STAYS) {
    if (day >= stay.start && day <= stay.end) {
      const base =
        stay.dotClass === 'bg-primary'
          ? 'bg-primary/10 text-primary font-medium'
          : 'bg-brass/15 text-brass font-medium';
      return cn(
        base,
        day === stay.start && 'rounded-l-md',
        day === stay.end && 'rounded-r-md'
      );
    }
  }
  return 'text-muted-foreground';
}

export function CalendarArtifact() {
  return (
    <ArtifactCard className="p-5">
      <div className="flex items-baseline justify-between">
        <p className="font-display text-lg tracking-tight">June</p>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Two stays
        </p>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-y-1 text-center text-xs">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <span
            key={`${d}-${i}`}
            className="pb-1 text-[10px] font-medium uppercase text-muted-foreground/70"
          >
            {d}
          </span>
        ))}
        {Array.from({ length: FIRST_WEEKDAY_OFFSET }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: DAYS_IN_MONTH }, (_, i) => i + 1).map((day) => (
          <span key={day} className={cn('py-1.5', dayClass(day))}>
            {day}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 border-t border-border/60 pt-4">
        {STAYS.map((stay) => (
          <p
            key={stay.label}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <span className={cn('size-2 rounded-full', stay.dotClass)} />
            {stay.label} &middot; June {stay.start}&ndash;{stay.end}
          </p>
        ))}
      </div>
    </ArtifactCard>
  );
}
