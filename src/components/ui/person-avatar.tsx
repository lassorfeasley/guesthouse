import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

/**
 * A curated set of pleasant gradient pairs. We pick deterministically from a
 * seed so the same person always gets the same placeholder.
 */
const GRADIENTS: [string, string][] = [
  ['#FDA4AF', '#FB7185'],
  ['#FCD34D', '#F59E0B'],
  ['#86EFAC', '#22C55E'],
  ['#7DD3FC', '#0EA5E9'],
  ['#C4B5FD', '#8B5CF6'],
  ['#F9A8D4', '#EC4899'],
  ['#5EEAD4', '#14B8A6'],
  ['#FDBA74', '#F97316'],
  ['#A5B4FC', '#6366F1'],
  ['#D9F99D', '#84CC16'],
];

const SIZES = {
  sm: 'h-9 w-9 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-16 w-16 text-lg',
  xl: 'h-20 w-20 text-xl',
} as const;

export type PersonAvatarSize = keyof typeof SIZES;

function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function initialsFromName(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PersonAvatarProps {
  /** Display name used for initials and (as a fallback) the gradient seed. */
  name: string;
  /** Uploaded image URL. When absent, a generated placeholder is shown. */
  imageUrl?: string | null;
  /** Stable seed for the placeholder gradient (e.g. email). Defaults to name. */
  seed?: string | null;
  size?: PersonAvatarSize;
  className?: string;
}

/**
 * Avatar that renders an uploaded photo when available, otherwise a
 * deterministic gradient + initials placeholder. The gradient is seeded so a
 * given person always looks the same across the app.
 */
export function PersonAvatar({
  name,
  imageUrl,
  seed,
  size = 'md',
  className,
}: PersonAvatarProps) {
  const resolvedSeed = (seed || name || '?').toLowerCase();
  const [from, to] = GRADIENTS[hashSeed(resolvedSeed) % GRADIENTS.length];

  return (
    <Avatar className={cn(SIZES[size], className)}>
      {imageUrl ? <AvatarImage src={imageUrl} alt={name} /> : null}
      <AvatarFallback
        className="font-semibold text-white"
        style={{ backgroundImage: `linear-gradient(135deg, ${from}, ${to})` }}
        delayMs={imageUrl ? 300 : 0}
      >
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
}
