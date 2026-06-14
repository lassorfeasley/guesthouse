'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { StayTimeline, type TimelineRow } from '@/components/stay-timeline';

/*
 * Landing-page hero showcase: an auto-rotating set of homes, each with its own
 * room-by-room timeline. Hardcoded fictional data — a lookalike of the real
 * dashboard schedule (pine = confirmed, brass = pending), never a live
 * component. The timeline rendering itself is the shared `StayTimeline`
 * design-system component (also used by the host dashboard); this wrapper only
 * supplies demo data and the home-tab rotation. Rotation stops the moment a
 * visitor takes control by clicking a tab, and pauses while they hover the
 * panel.
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
const WINDOW_START_DAY = 8;
const WINDOW_DAYS_COUNT = 14;
const WINDOW_START_ISO = demoISO(WINDOW_START_DAY);

/** Day-of-month within the demo window → ISO date string (always June 2026). */
function demoISO(dayOfMonth: number): string {
  return `2026-06-${String(dayOfMonth).padStart(2, '0')}`;
}

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

/** Map the demo home's day-of-month stays onto the shared timeline shape. */
function homeToRows(home: DemoHome): TimelineRow[] {
  return home.rooms.map((room, roomIndex) => ({
    id: `${home.id}-${roomIndex}`,
    label: room.name,
    stays: room.stays.map((stay, stayIndex) => ({
      id: `${home.id}-${roomIndex}-${stayIndex}`,
      label: stay.guest,
      checkIn: demoISO(stay.start),
      // Demo `end` is the last occupied day; the timeline wants an exclusive
      // checkout (the morning after).
      checkOut: demoISO(stay.end + 1),
      variant: stay.status,
    })),
  }));
}

function HomePanel({ home }: { home: DemoHome }) {
  return (
    <div className="animate-in fade-in duration-500">
      <StayTimeline
        rows={homeToRows(home)}
        windowStart={WINDOW_START_ISO}
        windowDays={WINDOW_DAYS_COUNT}
        surfaceClassName="bg-card"
      />
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
