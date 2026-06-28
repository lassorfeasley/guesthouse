'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useBareCard } from '@/components/card-chrome';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VisitSummaryList } from '@/components/visit-summary-list';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';

type GuestVisitStatus = 'requested' | 'approved';

const statusVariant: Record<
  GuestVisitStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  requested: 'secondary',
  approved: 'default',
};

interface GuestManageVisitCardProps {
  propertyName: string;
  checkIn: string;
  checkOut: string;
  roomNames: string[];
  partySize: number;
  visitStatus: GuestVisitStatus;
  /** Real visit id — enables the live add-to-calendar menu. */
  visitId?: string;
}

export function GuestManageVisitCard({
  propertyName,
  checkIn,
  checkOut,
  roomNames,
  partySize,
  visitStatus,
  visitId,
}: GuestManageVisitCardProps) {
  const bare = useBareCard();
  return (
    <div className={cn('p-6', !bare && 'rounded-2xl border shadow-sm')}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Your visit</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{propertyName}</p>
        </div>
        <Badge variant={statusVariant[visitStatus]}>{visitStatus}</Badge>
      </div>

      <div className="mt-5">
        <VisitSummaryList
          checkIn={checkIn}
          checkOut={checkOut}
          roomNames={roomNames}
          partySize={partySize}
          boxed
        />
      </div>

      {visitStatus === 'requested' && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Your host will review this request. You&apos;ll be notified when it&apos;s
          confirmed.
        </p>
      )}

      {visitStatus === 'approved' && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          You&apos;re confirmed for this visit. See your visit details below for
          arrival and checkout notes.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/my-visits">View all visits</Link>
        </Button>
        {visitStatus === 'approved' && visitId && (
          <AddToCalendarButton
            visitId={visitId}
            size="default"
            className="w-full"
          />
        )}
        {(visitStatus === 'requested' || visitStatus === 'approved') && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:text-destructive"
            asChild
          >
            <Link href="/my-visits">Cancel visit</Link>
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Manage your visit from My visits
      </p>
    </div>
  );
}
