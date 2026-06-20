'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowRight, BellRing } from 'lucide-react';

interface RequestsAlertBannerProps {
  slug: string;
  requestCount: number;
}

export function RequestsAlertBanner({
  slug,
  requestCount,
}: RequestsAlertBannerProps) {
  const pathname = usePathname();
  const bookingsHref = `/dashboard/${slug}/bookings`;
  const requestsHref = `${bookingsHref}?status=requested`;

  // Nothing to act on, or already on the bookings hub — stay quiet.
  if (requestCount < 1 || pathname.startsWith(bookingsHref)) return null;

  const isPlural = requestCount > 1;
  const guestNoun = isPlural ? 'guests are' : 'guest is';

  return (
    <div className="border-b border-warning/40 bg-warning/10">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-warning/25 text-warning-foreground">
          <BellRing className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Action needed: {requestCount} visit{' '}
            {isPlural ? 'requests need' : 'request needs'} your approval
          </p>
          <p className="text-sm text-muted-foreground">
            {isPlural ? 'These' : 'This'} {guestNoun} waiting to hear back from
            you before {isPlural ? 'their trips' : 'their trip'} can be
            confirmed.
          </p>
        </div>
        <Link
          href={requestsHref}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm ring-1 ring-primary/20 transition-all duration-150 hover:bg-primary/90 active:scale-[0.98]"
        >
          Review {isPlural ? 'requests' : 'request'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
