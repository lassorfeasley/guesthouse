'use client';

import { startOfMonth } from 'date-fns';
import { AvailabilityCalendar } from '@/components/dashboard/availability-calendar';
import { StayTimeline, type TimelineRow } from '@/components/stay-timeline';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toISODate } from '@/lib/dates';
import type {
  PortfolioCalendarBooking,
  PortfolioCalendarBlock,
} from '@/lib/portfolio';

// ~3 months of day columns, mirroring the 3-month calendar view.
const TIMELINE_DAYS = 92;

export function PortfolioSchedule({
  timelineRows,
  calendarBookings,
  calendarBlocks,
}: {
  timelineRows: TimelineRow[];
  calendarBookings: PortfolioCalendarBooking[];
  calendarBlocks: PortfolioCalendarBlock[];
}) {
  const timelineStart = toISODate(startOfMonth(new Date()));

  return (
    <Tabs defaultValue="calendar">
      <TabsList>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
        <TabsTrigger value="timeline">Timeline</TabsTrigger>
      </TabsList>
      <TabsContent value="calendar" className="mt-6">
        <AvailabilityCalendar
          bookings={calendarBookings}
          blocks={calendarBlocks}
          monthsToShow={3}
        />
      </TabsContent>
      <TabsContent value="timeline" className="mt-6">
        <StayTimeline
          rows={timelineRows}
          windowStart={timelineStart}
          windowDays={TIMELINE_DAYS}
          rowHeading="Homes & rooms"
          showMonths
          startAtToday
          showLegend
          emptyLabel="No stays scheduled yet."
        />
      </TabsContent>
    </Tabs>
  );
}
