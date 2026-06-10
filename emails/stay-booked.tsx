import { Button, Text } from '@react-email/components';
import { EmailLayout, buttonStyle } from './components/layout';

interface Props {
  guestName: string;
  propertyName: string;
  dates: string;
  rooms: string;
  partySize: number;
  notes?: string;
  bookingUrl: string;
  unsubscribeUrl?: string;
}

export default function StayBookedEmail({
  guestName,
  propertyName,
  dates,
  rooms,
  partySize,
  notes,
  bookingUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <EmailLayout
      preview={`${guestName} booked a stay at ${propertyName}`}
      heading="New stay booked"
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>
        <strong>{guestName}</strong> just booked a stay at{' '}
        <strong>{propertyName}</strong>. Their invitation didn&apos;t require
        approval, so the booking is confirmed and on your calendar.
      </Text>
      <Text>
        <strong>Dates:</strong> {dates}
        <br />
        <strong>Rooms:</strong> {rooms}
        <br />
        <strong>Party size:</strong> {partySize}
      </Text>
      {notes && <Text><strong>Note:</strong> {notes}</Text>}
      <Button style={buttonStyle} href={bookingUrl}>
        View booking
      </Button>
    </EmailLayout>
  );
}
