'use client';

import Link from 'next/link';
import { Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StaySummaryList } from '@/components/stay-summary-list';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';
import type { GuestPreviewBookingStatus } from '@/lib/guest-preview';

const statusVariant: Record<
  GuestPreviewBookingStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  requested: 'secondary',
  approved: 'default',
};

interface GuestManageStayCardProps {
  propertyName: string;
  checkIn: string;
  checkOut: string;
  roomNames: string[];
  partySize: number;
  bookingStatus: GuestPreviewBookingStatus;
  /** Real booking id — enables the live add-to-calendar menu. */
  bookingId?: string;
  previewMode?: boolean;
}

export function GuestManageStayCard({
  propertyName,
  checkIn,
  checkOut,
  roomNames,
  partySize,
  bookingStatus,
  bookingId,
  previewMode = false,
}: GuestManageStayCardProps) {
  return (
    <div className="rounded-2xl border p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">Your stay</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{propertyName}</p>
        </div>
        <Badge variant={statusVariant[bookingStatus]}>{bookingStatus}</Badge>
      </div>

      <div className="mt-5">
        <StaySummaryList
          checkIn={checkIn}
          checkOut={checkOut}
          roomNames={roomNames}
          partySize={partySize}
          boxed
        />
      </div>

      {bookingStatus === 'requested' && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          Your host will review this request. You&apos;ll be notified when it&apos;s
          confirmed.
        </p>
      )}

      {bookingStatus === 'approved' && (
        <p className="mt-4 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          You&apos;re confirmed for this stay. See your trip details below for
          arrival and checkout notes.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-2">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/my-trips">View all trips</Link>
        </Button>
        {bookingStatus === 'approved' &&
          (bookingId ? (
            <AddToCalendarButton
              bookingId={bookingId}
              size="default"
              className="w-full"
            />
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                toast.info('Preview mode — calendar download disabled')
              }
            >
              <Calendar className="mr-2 h-4 w-4" />
              Add to calendar
            </Button>
          ))}
        {(bookingStatus === 'requested' || bookingStatus === 'approved') && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => {
              if (previewMode) {
                toast.info('Preview mode — cancel stay disabled');
              }
            }}
          >
            Cancel stay
          </Button>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        {previewMode
          ? 'Preview of post-booking management UI'
          : 'Manage your booking from My trips'}
      </p>
    </div>
  );
}
