import { createEvent } from 'ics';
import type { BookingWithDetails } from '@/types/database';
import { formatDateRange } from '@/lib/dates';

export function generateIcs(booking: BookingWithDetails): string {
  const checkIn = new Date(booking.dates.check_in + 'T15:00:00');
  const checkOut = new Date(booking.dates.check_out + 'T11:00:00');

  const roomNames = booking.rooms.map((r) => r.name).join(', ');

  const { error, value } = createEvent({
    start: [
      checkIn.getFullYear(),
      checkIn.getMonth() + 1,
      checkIn.getDate(),
      15,
      0,
    ],
    end: [
      checkOut.getFullYear(),
      checkOut.getMonth() + 1,
      checkOut.getDate(),
      11,
      0,
    ],
    title: `Stay at ${booking.property.name}`,
    description: [
      `Property: ${booking.property.name}`,
      booking.property.address ? `Address: ${booking.property.address}` : '',
      `Rooms: ${roomNames}`,
      `Dates: ${formatDateRange(booking.dates.check_in, booking.dates.check_out)}`,
      booking.property.wifi_name
        ? `WiFi: ${booking.property.wifi_name}${booking.property.wifi_password ? ` / ${booking.property.wifi_password}` : ''}`
        : '',
      booking.property.check_in_instructions
        ? `Check-in: ${booking.property.check_in_instructions}`
        : '',
    ]
      .filter(Boolean)
      .join('\n'),
    location: booking.property.address ?? booking.property.name,
    status: 'CONFIRMED',
    busyStatus: 'BUSY',
    organizer: {
      name: 'Gracious',
      email: 'hello@gracious.host',
    },
  });

  if (error || !value) {
    throw new Error('Failed to generate calendar file');
  }

  return value;
}
