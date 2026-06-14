import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Shared building blocks for Open Graph images (next/og ImageResponse).
 * Static TTF instances of the brand fonts live alongside this file because
 * satori cannot consume the variable/woff2 fonts the app itself uses.
 */

export const OG_SIZE = { width: 1200, height: 630 };

const GREEN = '#1f3d33'; // --primary
const CREAM = '#faf8f4'; // --background

export async function loadOgFonts() {
  const dir = join(process.cwd(), 'src', 'lib', 'og');
  const [fraunces, inter] = await Promise.all([
    readFile(join(dir, 'fraunces-semibold.ttf')),
    readFile(join(dir, 'inter-medium.ttf')),
  ]);
  return [
    { name: 'Fraunces', data: fraunces, weight: 600 as const, style: 'normal' as const },
    { name: 'Inter', data: inter, weight: 500 as const, style: 'normal' as const },
  ];
}

/** Centered brand card — the sitewide default OG image. */
export function BrandCard({ tagline }: { tagline?: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: GREEN,
        color: CREAM,
      }}
    >
      <div
        style={{
          fontFamily: 'Fraunces',
          fontSize: 132,
          letterSpacing: '-0.02em',
        }}
      >
        Gracious
      </div>
      {tagline && (
        <div
          style={{
            fontFamily: 'Inter',
            fontSize: 32,
            marginTop: 28,
            color: 'rgba(250, 248, 244, 0.78)',
          }}
        >
          {tagline}
        </div>
      )}
    </div>
  );
}

/**
 * Photo card for property/room pages. Falls back to a solid brand
 * background when no photo is available.
 */
export function PhotoCard({
  imageUrl,
  eyebrow,
  title,
  subtitle,
}: {
  imageUrl?: string | null;
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        backgroundColor: GREEN,
        color: CREAM,
      }}
    >
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          width={OG_SIZE.width}
          height={OG_SIZE.height}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: imageUrl
            ? 'linear-gradient(to top, rgba(10, 18, 15, 0.86) 0%, rgba(10, 18, 15, 0.35) 45%, rgba(10, 18, 15, 0.12) 100%)'
            : 'linear-gradient(to top, rgba(10, 18, 15, 0.45) 0%, rgba(10, 18, 15, 0) 60%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 48,
          right: 64,
          fontFamily: 'Fraunces',
          fontSize: 34,
          color: 'rgba(250, 248, 244, 0.92)',
        }}
      >
        Gracious
      </div>
      <div
        style={{
          position: 'absolute',
          left: 64,
          right: 64,
          bottom: 56,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {eyebrow && (
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 26,
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              color: 'rgba(250, 248, 244, 0.8)',
            }}
          >
            {eyebrow}
          </div>
        )}
        <div
          style={{
            fontFamily: 'Fraunces',
            fontSize: 78,
            lineHeight: 1.08,
            letterSpacing: '-0.01em',
            marginTop: eyebrow ? 18 : 0,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 30,
              marginTop: 16,
              color: 'rgba(250, 248, 244, 0.82)',
            }}
          >
            {subtitle}
          </div>
        )}
      </div>
    </div>
  );
}
