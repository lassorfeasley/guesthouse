import { Img, Section, Text } from '@react-email/components';
import * as React from 'react';

interface EmailHeroProps {
  /** House name, used as the image alt text and the branded fallback label. */
  propertyName: string;
  /** Featured property image. When absent, a branded fallback banner is shown. */
  imageUrl?: string;
}

/**
 * Banner at the top of guest-facing emails. Shows the property's featured photo
 * when one exists; otherwise falls back to an elegant pine/brass block so the
 * email never looks unfinished — and so image-blocking clients still get a
 * branded header rather than a broken tile.
 */
// Banner geometry: locked to the golden ratio (φ ≈ 1.618) at the card's
// content width so a tall photo is cropped to a consistent height instead of
// pushing the rest of the email down. Width matches the EmailLayout content
// box (container 520 − 28px padding on each side).
const HERO_WIDTH = 464;
const HERO_HEIGHT = Math.round(HERO_WIDTH / 1.618); // 287

export function EmailHero({ propertyName, imageUrl }: EmailHeroProps) {
  if (imageUrl) {
    return (
      <Img
        src={imageUrl}
        alt={propertyName}
        width={HERO_WIDTH}
        height={HERO_HEIGHT}
        style={heroImage}
      />
    );
  }

  return (
    <Section style={heroFallback}>
      <div style={heroAccent} />
      <Text style={heroFallbackName}>{propertyName}</Text>
    </Section>
  );
}

const heroImage = {
  width: '100%',
  maxWidth: `${HERO_WIDTH}px`,
  height: `${HERO_HEIGHT}px`,
  // Crop to fill the locked box rather than letterboxing or stretching.
  // Supported by Apple Mail, iOS, and modern Gmail; older Outlook falls back
  // to a center-anchored scale, which still respects the fixed height.
  objectFit: 'cover' as const,
  objectPosition: 'center' as const,
  borderRadius: '8px',
  margin: '0 0 24px',
  display: 'block',
};

const heroFallback = {
  backgroundColor: '#1f3d33',
  borderRadius: '8px',
  height: `${HERO_HEIGHT}px`,
  padding: '0 28px',
  margin: '0 0 24px',
  textAlign: 'center' as const,
  verticalAlign: 'middle' as const,
  boxSizing: 'border-box' as const,
};

const heroAccent = {
  width: '32px',
  height: '2px',
  backgroundColor: '#a2773e',
  margin: '0 auto 16px',
};

const heroFallbackName = {
  fontSize: '22px',
  fontFamily: 'Georgia, "Times New Roman", serif',
  color: '#f7f4ed',
  margin: 0,
  overflowWrap: 'anywhere' as const,
};
