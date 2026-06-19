import { Home, BedDouble } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * On-brand fallback used when a home or room has no photo yet.
 *
 * Renders a deterministic, brand-colored tile (warm/forest palette — never the
 * old slate gradient) with a type glyph, so an empty state reads as intentional
 * brand rather than a broken image. The color is derived from `seed` (e.g. the
 * entity id) so the same listing always gets the same tile, while the glyph
 * distinguishes a home from a room.
 */

/** Curated dark tiles drawn from the brand palette (cream glyph reads on all). */
const TILES: ReadonlyArray<readonly [string, string]> = [
  ['#234438', '#15302a'], // forest
  ['#1d4540', '#123532'], // pine / teal
  ['#45492c', '#2f331c'], // olive
  ['#5e4636', '#43312a'], // clay
  ['#3f3a4a', '#2a2733'], // aubergine
  ['#2f4632', '#203121'], // deep moss
];

function pickTile(seed: string): readonly [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return TILES[hash % TILES.length];
}

export function PlaceholderImage({
  type,
  name,
  seed,
  className,
  iconClassName,
}: {
  type: 'home' | 'room';
  /** Used as a fallback seed and for accessible labelling. */
  name?: string | null;
  /** Stable identifier (e.g. entity id) so the tile color never changes. */
  seed?: string | null;
  className?: string;
  /** Override the centered glyph size (defaults to h-10 w-10). */
  iconClassName?: string;
}) {
  const [from, to] = pickTile(seed || name || type);
  const Icon = type === 'home' ? Home : BedDouble;

  return (
    <div
      role="img"
      aria-label={name ? `${name} — no photo yet` : 'No photo yet'}
      className={cn(
        'relative flex items-center justify-center overflow-hidden',
        className
      )}
      style={{
        backgroundColor: to,
        backgroundImage: [
          'radial-gradient(120% 120% at 12% 0%, rgba(255,255,255,0.12), transparent 55%)',
          'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0px, rgba(255,255,255,0.035) 1px, transparent 1px, transparent 16px)',
          `linear-gradient(135deg, ${from}, ${to})`,
        ].join(', '),
      }}
    >
      <Icon
        className={cn('relative text-[#faf8f4]/90', iconClassName ?? 'h-10 w-10')}
        strokeWidth={1.5}
        aria-hidden
      />
    </div>
  );
}
