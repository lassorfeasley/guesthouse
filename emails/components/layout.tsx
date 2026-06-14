import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

/*
 * Email clients need absolute asset URLs. Read the app origin directly from the
 * environment (not via the `@/` alias) so the react-email preview CLI — which
 * doesn't resolve TS path aliases — can still render these templates.
 */
const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://gracious.host';
const logoSrc = `${baseUrl}/brand/email-logo.png`;

interface EmailLayoutProps {
  preview: string;
  heading: string;
  children: React.ReactNode;
  /** Optional banner (e.g. <EmailHero />) shown above the heading. */
  hero?: React.ReactNode;
  /** When provided, an unsubscribe link is shown in the footer (opt-out emails). */
  unsubscribeUrl?: string;
}

export function EmailLayout({
  preview,
  heading,
  children,
  hero,
  unsubscribeUrl,
}: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={logoSrc}
            alt="Gracious"
            width={132}
            height={33}
            style={logo}
          />
          {hero}
          <Heading style={h1}>{heading}</Heading>
          <Section style={content}>{children}</Section>
          <Hr style={hr} />
          <Text style={footer}>
            Gracious — the art of having people to stay.
            {unsubscribeUrl && (
              <>
                <br />
                <Link href={unsubscribeUrl} style={footerLink}>
                  Unsubscribe from these emails
                </Link>
              </>
            )}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

/* Brand palette — paper, ink, pine, brass (see src/app/globals.css). */
const main = {
  backgroundColor: '#f7f4ed',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  // Breathing room so the card never touches pane edges on narrow clients.
  padding: '0 12px',
};

/*
 * Email-client geometry notes:
 * - width 100% + maxWidth + border-box keeps the card inside narrow preview
 *   panes and phones; without border-box the padding pushes the rendered
 *   table past maxWidth and clients clip it horizontally.
 * - tableLayout fixed stops long unbreakable content (token URLs) from
 *   stretching the table wider than the pane.
 */
const container = {
  backgroundColor: '#fdfcf8',
  margin: '40px auto',
  padding: '32px 28px',
  borderRadius: '8px',
  width: '100%',
  maxWidth: '520px',
  boxSizing: 'border-box' as const,
  tableLayout: 'fixed' as const,
};

const logo = {
  display: 'block',
  width: '132px',
  height: 'auto',
  margin: '0 0 24px',
};

const h1 = {
  fontSize: '24px',
  fontWeight: '600' as const,
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: '#221e19',
  margin: '0 0 16px',
  overflowWrap: 'anywhere' as const,
};

const content = {
  color: '#48433c',
  fontSize: '16px',
  lineHeight: '24px',
  // Long tokens/URLs wrap instead of widening the card. Unlike break-all,
  // this never breaks ordinary words.
  overflowWrap: 'anywhere' as const,
};

const hr = { borderColor: '#e4ddd0', margin: '24px 0' };

const footer = {
  color: '#8a8273',
  fontSize: '12px',
  margin: 0,
  lineHeight: '20px',
};

const footerLink = {
  color: '#8a8273',
  fontSize: '12px',
  textDecoration: 'underline',
};

/**
 * For raw URL fallbacks ("Or copy this link: …"). Token URLs are long
 * unbreakable strings; without break-all they widen the layout and get
 * clipped in most mail clients.
 */
export const fallbackLinkStyle = {
  color: '#1f3d33',
  textDecoration: 'underline',
  wordBreak: 'break-all' as const,
  overflowWrap: 'anywhere' as const,
};

export const buttonStyle = {
  backgroundColor: '#1f3d33',
  color: '#f7f4ed',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  display: 'inline-block',
  fontWeight: '600' as const,
  fontSize: '14px',
};
