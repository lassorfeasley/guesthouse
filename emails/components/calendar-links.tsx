import { Link, Text } from '@react-email/components';

interface EmailCalendarLinksProps {
  /** Pre-filled Google Calendar add-event URL. */
  googleUrl: string;
  /** Pre-filled Outlook.com add-event URL. */
  outlookUrl: string;
  /** Mention the attached .ics for Apple/desktop clients (confirmation only). */
  icsAttached?: boolean;
}

/**
 * Compact "add to calendar" row for guest emails. Google and Outlook are
 * plain links that work from any mail client without signing in to Gracious;
 * Apple Calendar (and desktop Outlook) use the attached .ics when present.
 */
export function EmailCalendarLinks({
  googleUrl,
  outlookUrl,
  icsAttached = false,
}: EmailCalendarLinksProps) {
  return (
    <Text style={row}>
      <strong>Add to your calendar:</strong>{' '}
      <Link href={googleUrl} style={link}>
        Google Calendar
      </Link>
      {' · '}
      <Link href={outlookUrl} style={link}>
        Outlook.com
      </Link>
      {icsAttached && (
        <>
          {' · '}
          <span style={muted}>Apple Calendar — open the attached .ics</span>
        </>
      )}
    </Text>
  );
}

const row = {
  fontSize: '14px',
  lineHeight: '22px',
};

const link = {
  color: '#1f3d33',
  textDecoration: 'underline',
};

const muted = {
  color: '#8a8273',
};
