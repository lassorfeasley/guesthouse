import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  WORDMARK_ASPECT,
  WORDMARK_PATHS,
  WORDMARK_VIEWBOX,
} from '@/components/brand/wordmark';

/**
 * Shared building blocks for Open Graph images (next/og ImageResponse).
 * Static Hanken Grotesk weights live alongside this file because satori cannot
 * consume the woff2 the app itself uses (it reads ttf/otf/woff).
 */

export const OG_SIZE = { width: 1200, height: 630 };

const GREEN = '#1f3d33'; // --primary
const CREAM = '#faf8f4'; // --background

/**
 * Render the actual brand wordmark (outlined Fraunces) rather than re-typesetting
 * the name in a different face — keeps OG cards on-brand. Satori reliably draws
 * SVG via an <img> data URI, sized by height (width derived from the aspect).
 */
function wordmarkSrc(color: string): string {
  const paths = WORDMARK_PATHS.map((d) => `<path d="${d}" fill="${color}"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORDMARK_VIEWBOX}">${paths}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function Wordmark({
  height,
  color,
  style,
}: {
  height: number;
  color: string;
  style?: React.CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={wordmarkSrc(color)}
      alt="Gracious"
      width={Math.round(height * WORDMARK_ASPECT)}
      height={height}
      style={style}
    />
  );
}

export async function loadOgFonts() {
  const dir = join(process.cwd(), 'src', 'lib', 'og');
  const [bold, medium] = await Promise.all([
    readFile(join(dir, 'hanken-grotesk-700.woff')),
    readFile(join(dir, 'hanken-grotesk-500.woff')),
  ]);
  return [
    { name: 'Hanken Grotesk', data: bold, weight: 700 as const, style: 'normal' as const },
    { name: 'Hanken Grotesk', data: medium, weight: 500 as const, style: 'normal' as const },
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
      <Wordmark height={112} color={CREAM} />
      {tagline && (
        <div
          style={{
            fontFamily: 'Hanken Grotesk',
            fontWeight: 500,
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
          display: 'flex',
        }}
      >
        <Wordmark height={36} color={CREAM} style={{ opacity: 0.92 }} />
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
              fontFamily: 'Hanken Grotesk',
              fontWeight: 500,
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
            fontFamily: 'Hanken Grotesk',
            fontWeight: 700,
            fontSize: 78,
            lineHeight: 1.08,
            letterSpacing: '-0.02em',
            marginTop: eyebrow ? 18 : 0,
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontFamily: 'Hanken Grotesk',
              fontWeight: 500,
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
