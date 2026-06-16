'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  Archive,
  BedDouble,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  KeyRound,
  type LucideIcon,
  MapPin,
  Reply,
  Trash2,
  Wifi,
} from 'lucide-react';
import { Logomark } from '@/components/brand/wordmark';
import { cn } from '@/lib/utils';

/*
 * Guest-experience showcase: a chronological stack of the lifecycle emails a
 * guest receives — invitation → arrival → afterward. The top "sheet" slides off
 * to the right to reveal the next note beneath it, loose-leaf style. Auto-cycles
 * once in view; the breadcrumb below doubles as a chronology indicator and
 * manual control. Hardcoded fictional data — a lookalike, never live mail.
 */

type Fact = { icon: LucideIcon; label: string; value: string };

const ARRIVAL_DETAILS: Fact[] = [
  { icon: KeyRound, label: 'Door code', value: '4 7 2 9 ✱' },
  { icon: Wifi, label: 'Wi-Fi', value: 'LakeHouse · guest' },
];

const INVITE_DETAILS: Fact[] = [
  { icon: CalendarRange, label: 'Your dates', value: 'Jun 26 – 29 · 3 nights' },
  { icon: BedDouble, label: 'Your room', value: 'The Lake Room' },
];

const CHECKOUT_DETAILS: Fact[] = [
  { icon: Clock, label: 'Checkout time', value: '11:00 AM' },
  { icon: KeyRound, label: 'Before you go', value: 'Leave the key on the hook' },
];

/* Shared facts card so each email's details read consistently. */
function FactsCard({ facts }: { facts: Fact[] }) {
  return (
    <div className="divide-y divide-border/60 rounded-xl bg-background/70">
      {facts.map((fact) => (
        <div key={fact.label} className="flex items-center gap-3 px-4 py-3">
          <fact.icon className="size-4 shrink-0 text-brass" />
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {fact.label}
            </p>
            <p className="truncate text-sm font-medium">{fact.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* A filled, button-like call to action inside an email body. */
function EmailCta({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground">
      {Icon && <Icon className="size-4" />}
      {children}
    </div>
  );
}

interface Email {
  id: string;
  crumb: string;
  time: string;
  subject: string;
  body?: string;
  /** Optional property/room photo shown as an inset card, like the real email. */
  image?: string;
  /** Aspect/height utility for the image card (tuned per photo so it isn't crushed). */
  imageClass?: string;
  /** object-position override so the subject stays in frame. */
  imagePosition?: string;
  block: React.ReactNode;
}

const EMAILS: Email[] = [
  {
    id: 'invite',
    crumb: 'Invitation',
    time: '3 weeks before',
    subject: 'Margaret has invited you to The Lake House',
    image: '/houses/email-exterior.png',
    imageClass: 'aspect-[16/9]',
    block: (
      <div className="space-y-3">
        <FactsCard facts={INVITE_DETAILS} />
        <EmailCta>View house &amp; request stay</EmailCta>
      </div>
    ),
  },
  {
    id: 'arrival',
    crumb: 'Get ready',
    time: 'The morning of',
    subject: 'Get ready for your visit — see you Friday',
    image: '/houses/email-bedroom.png',
    imageClass: 'aspect-[16/9]',
    imagePosition: 'object-[center_60%]',
    block: (
      <div className="space-y-3">
        <EmailCta icon={MapPin}>Get directions</EmailCta>
        <FactsCard facts={ARRIVAL_DETAILS} />
      </div>
    ),
  },
  {
    id: 'after',
    crumb: 'Afterward',
    time: 'Checkout morning',
    subject: 'Time to head out',
    image: '/houses/email-departure.png',
    imageClass: 'aspect-[16/9]',
    imagePosition: 'object-[center_55%]',
    body: 'We hope you had a wonderful stay. A few things to take care of before you go.',
    block: <FactsCard facts={CHECKOUT_DETAILS} />,
  },
];

const N = EMAILS.length;
const SLIDE_MS = 560;
const HOLD_MS = 3600;

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

/* Dummy mail-client chrome so each card reads as a little window. */
function WindowChrome() {
  return (
    <div
      className="flex items-center justify-between border-b border-border/60 px-5 py-3.5"
      aria-hidden
    >
      <div className="flex items-center gap-2">
        <span className="size-3 rounded-full bg-muted-foreground/30" />
        <span className="size-3 rounded-full bg-muted-foreground/30" />
        <span className="size-3 rounded-full bg-muted-foreground/30" />
      </div>
      <div className="flex items-center gap-3.5 text-muted-foreground/50">
        <Archive className="size-4" />
        <Trash2 className="size-4" />
        <Reply className="size-4" />
      </div>
    </div>
  );
}

function EmailCard({ email }: { email: Email }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-xl">
      <WindowChrome />
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex items-start gap-3">
          <Logomark className="size-9 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-lg font-bold tracking-tight">
              Gracious
            </p>
            <p className="mt-1 font-display text-lg leading-snug tracking-tight">
              {email.subject}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-col px-5 py-4">
        {email.image && (
          <div
            className={cn(
              'relative mb-4 w-full shrink-0 overflow-hidden rounded-xl border border-border/60',
              email.imageClass ?? 'aspect-[16/9]'
            )}
          >
            <Image
              src={email.image}
              alt=""
              fill
              sizes="440px"
              className={cn('object-cover', email.imagePosition)}
            />
          </div>
        )}
        {email.body && (
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {email.body}
          </p>
        )}
        <div>{email.block}</div>
      </div>
    </div>
  );
}

export function GuestExperience({ className }: { className?: string }) {
  const [order, setOrder] = useState(() => EMAILS.map((_, i) => i));
  const [exiting, setExiting] = useState(false);
  const [instantId, setInstantId] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [userControlled, setUserControlled] = useState(false);
  const [inView, setInView] = useState(false);
  const reduced = usePrefersReducedMotion();

  const orderRef = useRef(order);
  const animatingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const front = order[0];
  const auto = inView && !paused && !userControlled && !reduced;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Slide the current top sheet off to the right, then re-stack with `target`
  // on top. The departing card is repositioned to the back without a transition
  // (so it doesn't visibly slide back in) and fades into place.
  function advanceTo(target: number) {
    if (animatingRef.current) return;
    const curr = orderRef.current;
    if (target === curr[0]) return;
    animatingRef.current = true;
    setExiting(true);
    window.setTimeout(() => {
      const departing = curr[0];
      const next = Array.from({ length: N }, (_, k) => (target + k) % N);
      setInstantId(departing);
      setOrder(next);
      setExiting(false);
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          setInstantId(null);
          animatingRef.current = false;
        })
      );
    }, SLIDE_MS);
  }

  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      const curr = orderRef.current;
      advanceTo((curr[0] + 1) % N);
    }, HOLD_MS);
    return () => window.clearInterval(timer);
  }, [auto]);

  function handleCrumb(index: number) {
    setUserControlled(true);
    advanceTo(index);
  }

  return (
    <div className={cn('mx-auto max-w-5xl', className)}>
      <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-20">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">
            For your guests
          </p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Every guest arrives knowing exactly what to do.
          </h2>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            From the first invitation to the final goodbye, we send the right
            note at the right moment — so no one ever has to ask.
          </p>
        </div>

        <div className="mt-12 lg:mt-0">
          <div
            ref={rootRef}
            className="relative mx-auto h-[min(600px,80vw)] w-full max-w-[30rem] overflow-x-clip [overflow-clip-margin:5rem] sm:h-[600px]"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            {EMAILS.map((email, i) => {
              const depth = order.indexOf(i);
              const isFront = depth === 0;
              const isExitingCard = isFront && exiting;
              const isInstant = instantId === i;

              let transform: string;
              let opacity = 1;
              let zIndex = N - depth;

              if (isExitingCard) {
                transform = 'translateX(160%) rotate(7deg)';
                opacity = 0;
                zIndex = N + 1;
              } else {
                const tx = depth * 9;
                const ty = depth * 16;
                const scale = 1 - depth * 0.045;
                const rot = depth === 0 ? 0 : depth === 1 ? -2.5 : 2.5;
                transform = `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rot}deg)`;
                if (isInstant) opacity = 0;
              }

              const transition =
                isInstant || reduced
                  ? 'none'
                  : `transform ${SLIDE_MS}ms cubic-bezier(.4,0,.2,1), opacity 340ms ease`;

              return (
                <div
                  key={email.id}
                  aria-hidden={!isFront}
                  className="absolute inset-x-0 top-0 h-full will-change-transform"
                  style={{ transform, opacity, zIndex, transition }}
                >
                  <EmailCard email={email} />
                </div>
              );
            })}
          </div>

          {/* Chronology control: chevrons + segmented toggle pill */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => handleCrumb((front - 1 + N) % N)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Previous email"
            >
              <ChevronLeft className="size-4" />
            </button>

            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-card p-1 shadow-sm">
              {EMAILS.map((email, i) => {
                const active = i === front;
                return (
                  <button
                    key={email.id}
                    type="button"
                    onClick={() => handleCrumb(i)}
                    className={cn(
                      'rounded-full px-2.5 py-1.5 text-[11px] font-medium transition-colors sm:px-3.5 sm:text-xs',
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                    aria-current={active ? 'step' : undefined}
                  >
                    {email.crumb}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => handleCrumb((front + 1) % N)}
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 bg-card text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Next email"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
