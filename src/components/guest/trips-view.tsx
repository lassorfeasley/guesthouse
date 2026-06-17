'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { format, startOfDay } from 'date-fns';
import { AvailabilityCalendar } from '@/components/dashboard/availability-calendar';
import { formatDateRange } from '@/lib/dates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CancelBookingButton } from '@/components/guest/cancel-booking-button';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';
import { PropertyNotesDisplay } from '@/components/property-notes-display';
import type { BookingStatus, PropertyNote } from '@/types/database';

const statusColors: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  requested: 'secondary',
  approved: 'default',
  declined: 'destructive',
  cancelled: 'outline',
};

export interface TripBooking {
  id: string;
  status: BookingStatus;
  property: {
    name: string;
    slug: string;
    property_notes?: PropertyNote[];
  } | null;
  dates:
    | { check_in: string; check_out: string }
    | { check_in: string; check_out: string }[]
    | null;
  booking_rooms?: { room: { name: string } | null }[];
  invitation?: { token: string } | null;
}

function getBookingDates(booking: TripBooking) {
  if (!booking.dates) return null;
  return Array.isArray(booking.dates) ? booking.dates[0] : booking.dates;
}

function isUpcomingActive(booking: TripBooking, today: string) {
  const dates = getBookingDates(booking);
  if (!dates) return false;
  if (booking.status !== 'requested' && booking.status !== 'approved') return false;
  return dates.check_out >= today;
}

export function TripsView({ bookings }: { bookings: TripBooking[] }) {
  const today = format(startOfDay(new Date()), 'yyyy-MM-dd');

  const upcomingBookings = useMemo(
    () => bookings.filter((b) => isUpcomingActive(b, today)),
    [bookings, today]
  );

  const calendarBookings = useMemo(
    () =>
      upcomingBookings
        .map((booking) => {
          const dates = getBookingDates(booking);
          if (!dates) return null;
          return {
            id: booking.id,
            guestName: booking.property?.name ?? 'Stay',
            checkIn: dates.check_in,
            checkOut: dates.check_out,
            pending: booking.status === 'requested',
          };
        })
        .filter((b): b is NonNullable<typeof b> => b !== null),
    [upcomingBookings]
  );

  if (!bookings.length) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">No trips yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Open an invitation link from your host to get started.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="list" className="mt-8">
      <TabsList>
        <TabsTrigger value="list">List</TabsTrigger>
        <TabsTrigger value="calendar">Calendar</TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="mt-6 space-y-4">
        {bookings.map((booking) => {
          const dates = getBookingDates(booking);
          const rooms =
            booking.booking_rooms
              ?.map((br) => br.room?.name)
              .filter((name): name is string => !!name) ?? [];

          return (
            <Card key={booking.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">
                    {booking.property?.name}
                  </CardTitle>
                  <Badge variant={statusColors[booking.status] ?? 'outline'}>
                    {booking.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {dates && (
                  <p className="text-sm">
                    {formatDateRange(dates.check_in, dates.check_out)}
                  </p>
                )}
                {rooms.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Rooms: {rooms.join(', ')}
                  </p>
                )}
                {booking.status === 'approved' &&
                  booking.property?.property_notes &&
                  booking.property.property_notes.length > 0 && (
                    <PropertyNotesDisplay
                      notes={booking.property.property_notes}
                      categories={['house', 'checkin', 'checkout']}
                      headingAs="h3"
                      className="border-t pt-4"
                    />
                  )}
                <div className="flex flex-wrap gap-2">
                  {booking.status === 'approved' && (
                    <AddToCalendarButton bookingId={booking.id} />
                  )}
                  {booking.invitation?.token && (
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/invite/${booking.invitation.token}`}>
                        View house
                      </Link>
                    </Button>
                  )}
                  {(booking.status === 'requested' ||
                    booking.status === 'approved') && (
                    <CancelBookingButton bookingId={booking.id} />
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </TabsContent>

      <TabsContent value="calendar" className="mt-6">
        {calendarBookings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No upcoming trips.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Approved and pending stays will appear on your calendar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-2xl border p-6">
            <AvailabilityCalendar
              bookings={calendarBookings}
              monthsToShow={2}
              selectable={false}
            />
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
