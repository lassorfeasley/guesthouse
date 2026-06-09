'use client';

import { useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Home,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HostStep {
  title: string;
  description: string;
  icon: LucideIcon;
}

const HOST_STEPS: HostStep[] = [
  {
    title: 'Set up your home',
    description:
      'Add your property, rooms, and photos. Block dates you need and write the house rules guests will see before they arrive.',
    icon: Home,
  },
  {
    title: 'Invite guests privately',
    description:
      'Send personal invitations to friends and family — never a public listing. Choose dates, rooms, and whether stays need your approval.',
    icon: UserPlus,
  },
  {
    title: 'Manage every stay',
    description:
      'See who is arriving, staying, or departing on your calendar. Approve requests, track bookings, and keep everyone on the same page.',
    icon: CalendarDays,
  },
];

export function HowItWorksCarousel({ className }: { className?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  function goTo(index: number) {
    const next = (index + HOST_STEPS.length) % HOST_STEPS.length;
    setActiveIndex(next);
  }

  return (
    <div className={cn('mx-auto max-w-3xl', className)}>
      <div className="relative overflow-hidden rounded-3xl border bg-card p-8 shadow-sm sm:p-10">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeIndex * 100}%)` }}
        >
          {HOST_STEPS.map((item, index) => {
            const StepIcon = item.icon;
            return (
              <article
                key={item.title}
                className="w-full shrink-0 px-1"
                aria-hidden={index !== activeIndex}
              >
                <div className="flex flex-col items-center text-center">
                  <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <StepIcon className="size-7" strokeWidth={1.75} />
                  </div>
                  <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Step {index + 1} of {HOST_STEPS.length}
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-md text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous step"
            onClick={() => goTo(activeIndex - 1)}
          >
            <ChevronLeft className="size-4" />
          </Button>

          <div className="flex items-center gap-2">
            {HOST_STEPS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Go to step ${index + 1}: ${item.title}`}
                aria-current={index === activeIndex ? 'step' : undefined}
                onClick={() => setActiveIndex(index)}
                className={cn(
                  'h-2 rounded-full transition-all',
                  index === activeIndex
                    ? 'w-6 bg-primary'
                    : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                )}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next step"
            onClick={() => goTo(activeIndex + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="mt-6 hidden justify-center gap-3 sm:flex">
        {HOST_STEPS.map((item, index) => {
          const StepIcon = item.icon;
          return (
            <button
              key={item.title}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={cn(
                'flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
                index === activeIndex
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground'
              )}
            >
              <StepIcon className="size-4 shrink-0" />
              <span>{item.title}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
