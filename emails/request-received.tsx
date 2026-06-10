import { Text } from '@react-email/components';
import { EmailLayout } from './components/layout';

interface Props {
  guestName: string;
  propertyName: string;
  dates: string;
  rooms: string;
}

export default function RequestReceivedEmail({
  guestName,
  propertyName,
  dates,
  rooms,
}: Props) {
  return (
    <EmailLayout
      preview={`Your request for ${propertyName} is in`}
      heading="Your request is in"
    >
      <Text>Hi {guestName},</Text>
      <Text>
        We&apos;ve passed your stay request along to the hosts of{' '}
        <strong>{propertyName}</strong>. You&apos;ll get an email as soon as
        they respond.
      </Text>
      <Text>
        <strong>Dates:</strong> {dates}
        <br />
        <strong>Rooms:</strong> {rooms}
      </Text>
      <Text>No need to do anything in the meantime — sit tight!</Text>
    </EmailLayout>
  );
}
