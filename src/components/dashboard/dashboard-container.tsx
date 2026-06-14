import { cn } from '@/lib/utils';

/*
 * Centered page container for dashboard pages. Defines the canonical content
 * widths in one place so profile/detail pages stay consistent, with narrower
 * variants for list and form pages.
 *
 *  - wide     profile & detail pages (home, room, bookings, guests). Sized to
 *             Airbnb's actual reading content column (~1120-1280px). Airbnb's
 *             1920px frame is only full-bleed chrome (nav, section backgrounds);
 *             its real content never stretches that wide, and stretching ours
 *             that far blew out proportions (square calendar cells, letterbox
 *             hero, dead whitespace).
 *  - standard list pages that read better a touch narrower (requests)
 *  - form     single-column forms (settings)
 */
type ContainerWidth = 'wide' | 'standard' | 'form';

const WIDTH_CLASS: Record<ContainerWidth, string> = {
  wide: 'max-w-7xl',
  standard: 'max-w-5xl',
  form: 'max-w-2xl',
};

export function DashboardContainer({
  width = 'wide',
  className,
  children,
}: {
  width?: ContainerWidth;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full', WIDTH_CLASS[width], className)}>
      {children}
    </div>
  );
}
