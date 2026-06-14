'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/*
 * Landing-page hero showcase: an auto-rotating set of homes, each with its own
 * room-by-room calendar. Hardcoded fictional data — a lookalike of the real
 * dashboard calendar (pine = confirmed, brass = pending), never a live
 * component. Rotation stops the moment a visitor takes control by clicking a
 * tab, and pauses while they hover the panel.
 */

type StayStatus = 'confirmed' | 'pending';

interface DemoStay {
  guest: string;
  /** Day-of-month within the visible window (inclusive of both ends). */
  start: number;
  end: number;
  status: StayStatus;
}

interface DemoRoom {
  name: string;
  stays: DemoStay[];
}

interface DemoHome {
  id: string;
  tab: string;
  name: string;
  location: string;
  img: string;
  /** Per-icon scale so the house structures read at a similar visual size. */
  imgScale?: number;
  rooms: DemoRoom[];
}

/* A two-week window in June 2026. The 8th is a Monday. */
const WINDOW_START = 8;
const WINDOW_DAYS = Array.from({ length: 14 }, (_, i) => {
  const day = WINDOW_START + i;
  // June 8 = Monday; index 5,6 and 12,13 are Sat/Sun.
  const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i % 7];
  const weekend = i % 7 === 5 || i % 7 === 6;
  return { day, weekday, weekend };
});

const HOMES: DemoHome[] = [
  {
    id: 'beach',
    tab: 'Beach house',
    name: 'The Tides',
    location: 'Montauk, NY',
    img: '/houses/beach.png',
    rooms: [
      {
        name: 'Dune Suite',
        stays: [
          { guest: 'The Hales', start: 9, end: 12, status: 'confirmed' },
          { guest: 'Priya R.', start: 16, end: 20, status: 'confirmed' },
        ],
      },
      {
        name: 'Surf Room',
        stays: [{ guest: 'Maya & Tom', start: 10, end: 14, status: 'confirmed' }],
      },
      {
        name: 'Bunk Room',
        stays: [{ guest: 'The Okonkwos', start: 12, end: 16, status: 'pending' }],
      },
    ],
  },
  {
    id: 'mountain',
    tab: 'Mountain house',
    name: 'Pinecrest',
    location: 'Aspen, CO',
    img: '/houses/mountain.png',
    rooms: [
      {
        name: 'Summit Room',
        stays: [
          { guest: 'The Bergstroms', start: 8, end: 11, status: 'confirmed' },
          { guest: 'The Lees', start: 15, end: 19, status: 'pending' },
        ],
      },
      {
        name: 'Cabin Loft',
        stays: [{ guest: 'Will & Sam', start: 11, end: 15, status: 'confirmed' }],
      },
      {
        name: 'Creekside',
        stays: [
          { guest: 'The Floods', start: 9, end: 13, status: 'confirmed' },
          { guest: 'Noa & Ben', start: 16, end: 20, status: 'confirmed' },
        ],
      },
    ],
  },
  {
    id: 'country',
    tab: 'Country house',
    name: 'Foxglove',
    location: 'The Cotswolds',
    img: '/houses/country.png',
    imgScale: 1.35,
    rooms: [
      {
        name: 'Garden Room',
        stays: [
          { guest: 'Margaret & Theo', start: 9, end: 13, status: 'confirmed' },
          { guest: 'The Patels', start: 16, end: 21, status: 'pending' },
        ],
      },
      {
        name: 'The Barn',
        stays: [{ guest: 'The Munros', start: 11, end: 14, status: 'confirmed' }],
      },
      {
        name: 'Rose Room',
        stays: [{ guest: 'Aunt Jo', start: 15, end: 19, status: 'confirmed' }],
      },
    ],
  },
];

const ROTATE_MS = 4500;

const STAY_CLASS: Record<StayStatus, string> = {
  confirmed: 'bg-primary/10 text-primary',
  pending: 'border border-dashed border-brass/50 bg-brass/10 text-brass',
};

const DOT_CLASS: Record<StayStatus, string> = {
  confirmed: 'bg-primary',
  pending: 'bg-brass',
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

function StayBand({ stay }: { stay: DemoStay }) {
  return (
    <div
      style={{
        gridColumnStart: stay.start - WINDOW_START + 1,
        gridColumnEnd: stay.end - WINDOW_START + 2,
      }}
      className="flex min-w-0 items-center px-0.5"
    >
        <span
          className={cn(
            'flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium leading-none',
            STAY_CLASS[stay.status]
          )}
        >
        <span
          className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASS[stay.status])}
          aria-hidden
        />
        <span className="truncate">{stay.guest}</span>
      </span>
    </div>
  );
}

function RoomRow({ room }: { room: DemoRoom }) {
  return (
    <div className="flex items-stretch">
      <div className="flex w-24 shrink-0 items-center pr-3 text-xs font-medium text-muted-foreground sm:w-28">
        <span className="truncate">{room.name}</span>
      </div>
      <div className="relative flex-1">
        {/* Background guides + weekend tint */}
        <div className="absolute inset-0 grid grid-cols-[repeat(14,minmax(0,1fr))]">
          {WINDOW_DAYS.map((d, i) => (
            <div
              key={d.day}
              className={cn(
                'border-l border-border/40',
                i === WINDOW_DAYS.length - 1 && 'border-r',
                d.weekend && 'bg-muted/40'
              )}
            />
          ))}
        </div>
        {/* Stay bands */}
        <div className="relative grid h-11 grid-cols-[repeat(14,minmax(0,1fr))] items-center">
          {room.stays.map((stay) => (
            <StayBand key={`${stay.guest}-${stay.start}`} stay={stay} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HomePanel({ home }: { home: DemoHome }) {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[440px]">
          {/* Date header */}
          <div className="flex items-end">
            <div className="flex w-24 shrink-0 items-end pb-2 sm:w-28">
              <span className="whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
                Guest rooms
              </span>
            </div>
            <div className="grid flex-1 grid-cols-[repeat(14,minmax(0,1fr))] text-center">
              {WINDOW_DAYS.map((d) => (
                <div key={d.day} className="pb-2">
                  <span
                    className={cn(
                      'block text-[10px] font-semibold uppercase tracking-wide sm:text-[11px]',
                      d.weekend ? 'text-muted-foreground/60' : 'text-muted-foreground'
                    )}
                  >
                    {d.weekday}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 border-t border-border/60 pt-1">
            {home.rooms.map((room) => (
              <RoomRow key={room.name} room={room} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function StayShowcase({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [userControlled, setUserControlled] = useState(false);
  const [hovered, setHovered] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const autoRotate = !userControlled && !hovered && !reducedMotion;

  useEffect(() => {
    if (!autoRotate) return;
    const timer = setInterval(() => {
      setActive((a) => (a + 1) % HOMES.length);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [autoRotate]);

  function selectHome(index: number) {
    setActive(index);
    setUserControlled(true);
  }

  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 1 : -1;
    const next = (index + delta + HOMES.length) % HOMES.length;
    selectHome(next);
    tabRefs.current[next]?.focus();
  }

  const home = HOMES[active];

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/60 bg-card p-4 shadow-xl sm:p-6',
        className
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        My guest homes
      </p>
      <div
        role="tablist"
        aria-label="Example homes"
        className="grid grid-cols-3 gap-2 sm:gap-3"
      >
        {HOMES.map((h, i) => {
          const selected = i === active;
          return (
            <button
              key={h.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`stay-tab-${h.id}`}
              aria-selected={selected}
              aria-controls={`stay-panel-${h.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectHome(i)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
              className={cn(
                'group relative flex flex-col items-center gap-1 overflow-hidden rounded-xl border px-2 py-3 transition-all sm:gap-1.5 sm:py-4',
                selected
                  ? 'border-primary/25 bg-secondary shadow-sm'
                  : 'border-transparent hover:bg-secondary/50'
              )}
            >
              <span className="relative h-16 w-16 sm:h-24 sm:w-24">
                <Image
                  src={h.img}
                  alt=""
                  fill
                  sizes="96px"
                  style={{
                    transform: `scale(${(h.imgScale ?? 1) * (selected ? 1.05 : 0.95)})`,
                  }}
                  className={cn(
                    'object-contain transition-all duration-300',
                    selected
                      ? 'drop-shadow-sm'
                      : 'opacity-50 group-hover:opacity-90'
                  )}
                />
              </span>
              <span
                className={cn(
                  'text-[11px] font-medium transition-colors sm:text-xs',
                  selected ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {h.tab}
              </span>
              {selected && autoRotate && (
                <span
                  key={active}
                  className="absolute bottom-0 left-0 h-0.5 bg-primary/50"
                  style={{ animation: `stay-progress ${ROTATE_MS}ms linear` }}
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`stay-panel-${home.id}`}
        aria-labelledby={`stay-tab-${home.id}`}
        className="mt-5"
      >
        <HomePanel key={home.id} home={home} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" />
          Confirmed stay
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-brass" />
          Pending request
        </span>
      </div>

      <style>{`
        @keyframes stay-progress {
          from { width: 0%; }
          to { width: 100%; }
        }
      `}</style>
    </div>
  );
}
