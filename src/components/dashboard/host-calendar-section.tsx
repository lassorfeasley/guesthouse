'use client';

import type { ReactNode } from 'react';
import { startOfMonth } from 'date-fns';
import { HouseCalendar } from '@/components/guest/house-calendar';
import { HostStayTimeline } from '@/components/dashboard/host-stay-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toISODate } from '@/lib/dates';

/* Timeline window: from the start of the current month, spanning ~two months
 * to mirror the calendar's default two-month view (the rest scrolls). */
const TIMELINE_DAYS = 62;

export function HostCalendarSection({
  slug,
  sectionId,
  title,
  footer,
  className,
}: {
  slug: string;
  sectionId?: string;
  title?: string;
  footer?: ReactNode;
  className?: string;
}) {
  const bookingHrefBase = `/dashboard/${slug}/bookings`;
  const timelineStart = toISODate(startOfMonth(new Date()));

  return (
    <section
      id={sectionId}
      className={className ?? 'scroll-mt-28 py-10 first:pt-0'}
    >
      {title && (
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      )}
      <Tabs defaultValue="calendar" className={title ? 'mt-6' : 'mt-4'}>
        <TabsList>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-6">
          <HouseCalendar monthsToShow={2} bookingHrefBase={bookingHrefBase} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-6">
          <HostStayTimeline
            windowStart={timelineStart}
            windowDays={TIMELINE_DAYS}
            bookingHrefBase={bookingHrefBase}
          />
        </TabsContent>
      </Tabs>
      {footer}
    </section>
  );
}
