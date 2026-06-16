'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  CorrespondenceArtifact,
  HouseReadyArtifact,
  InvitationArtifact,
} from './artifacts';

interface Beat {
  title: string;
  body: string;
  artifact: React.ReactNode;
}

const BEATS: Beat[] = [
  {
    title: 'Tell us about your home',
    body: 'Add your rooms, your photographs, and the notes guests should read before they arrive.',
    artifact: <HouseReadyArtifact />,
  },
  {
    title: 'Extend the invitation',
    body: 'Guests see the house, pick their dates, and confirm their stay.',
    artifact: <InvitationArtifact />,
  },
  {
    title: 'We handle the correspondence',
    body: 'The right note at the right moment — a warm welcome, directions and door codes before arrival, a gentle word at checkout.',
    artifact: <CorrespondenceArtifact />,
  },
];

export function HowItWorks({ className }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const beatRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveIndex(Number(entry.target.getAttribute('data-beat')));
          }
        }
      },
      // A narrow band around the viewport's vertical center decides which
      // beat is "active", so the sticky artifact swaps as a beat crosses it.
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );
    for (const el of beatRefs.current) {
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn('mx-auto max-w-5xl', className)}>
      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">
          How it works
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Graciously build a calendar that makes planning visits effortless for
          you and your guests
        </h2>
      </div>

      <div className="mt-8 lg:mt-6 lg:grid lg:grid-cols-2 lg:gap-20">
        <div>
          {BEATS.map((beat, index) => (
            <div
              key={beat.title}
              ref={(el) => {
                beatRefs.current[index] = el;
              }}
              data-beat={index}
              className={cn(
                'py-12 transition-opacity duration-500 lg:flex lg:min-h-[60vh] lg:flex-col lg:justify-center lg:py-0',
                index !== activeIndex && 'lg:opacity-30'
              )}
            >
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-brass">
                Step {index + 1}
              </p>
              <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                {beat.title}
              </h3>
              <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">
                {beat.body}
              </p>
              {/* Inline artifact on small screens, where the sticky panel is hidden */}
              <div className="mt-8 lg:hidden">{beat.artifact}</div>
            </div>
          ))}
        </div>

        <div className="hidden lg:block">
          {/* Sticky geometry mirrors the beats' min-h-[60vh] (20vh offset on
              either side) so the artifact's center lines up with the active
              beat's center at the start, middle, and end of the travel. */}
          <div className="sticky top-[20vh] flex h-[60vh] items-center">
            <div className="grid w-full max-w-md items-center">
              {BEATS.map((beat, index) => (
                <div
                  key={beat.title}
                  aria-hidden={index !== activeIndex}
                  className={cn(
                    'transition-opacity duration-500 [grid-area:1/1]',
                    index === activeIndex
                      ? 'opacity-100'
                      : 'pointer-events-none opacity-0'
                  )}
                >
                  {beat.artifact}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto mt-24 max-w-xl text-center lg:mt-12">
        <h3 className="mt-4 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          Gracious handles scheduling and logistics so you can focus on creating
          a memorable experience with your guests.
        </h3>
      </div>
    </div>
  );
}
