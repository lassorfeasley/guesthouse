import { Button, Text } from '@react-email/components';
import { EmailLayout, buttonStyle } from './components/layout';

interface Props {
  guestName: string;
  propertyName: string;
  checkIn?: string;
  address?: string;
  directions?: string;
  wifiName?: string;
  wifiPassword?: string;
  profileUrl?: string;
  unsubscribeUrl?: string;
}

export default function ArrivalWelcomeEmail({
  guestName,
  propertyName,
  checkIn,
  address,
  directions,
  wifiName,
  wifiPassword,
  profileUrl,
  unsubscribeUrl,
}: Props) {
  return (
    <EmailLayout
      preview={`Today's the day — here's how to get into ${propertyName}`}
      heading="Welcome — here's how to get in"
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {guestName},</Text>
      <Text>
        Today&apos;s the day! Everything you need for arriving at{' '}
        <strong>{propertyName}</strong> is below.
      </Text>
      {checkIn && (
        <Text>
          <strong>Getting in:</strong>
          <br />
          {checkIn}
        </Text>
      )}
      {address && <Text><strong>Address:</strong> {address}</Text>}
      {directions && (
        <Text>
          <strong>Directions:</strong>
          <br />
          {directions}
        </Text>
      )}
      {wifiName && (
        <Text>
          <strong>WiFi:</strong> {wifiName}
          {wifiPassword ? ` / ${wifiPassword}` : ''}
        </Text>
      )}
      {profileUrl && (
        <Button style={buttonStyle} href={profileUrl}>
          View house details
        </Button>
      )}
      <Text>Safe travels — see you soon!</Text>
    </EmailLayout>
  );
}
