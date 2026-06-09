'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatDateRange } from '@/lib/dates';
import { Badge } from '@/components/ui/badge';
import { AddToCalendarButton } from '@/components/add-to-calendar-button';
import { CancelHostStayButton } from '@/components/dashboard/cancel-host-stay-button';
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog';
import { isLimitReachedResponse } from '@/lib/billing-client';

interface RequestBooking {
  id: string;
  status: string;
  party_size: number;
  notes: string | null;
  invitation_id?: string | null;
  guest_name?: string | null;
  guest_email?: string | null;
  created_by?: string | null;
  guest:
    | { name: string | null; email: string }
    | { name: string | null; email: string }[]
    | null;
  dates: { check_in: string; check_out: string } | { check_in: string; check_out: string }[];
  booking_rooms: { room: { name: string } | { name: string }[] }[];
}

function guestDisplayName(booking: RequestBooking): string {
  const guest = Array.isArray(booking.guest)
    ? booking.guest[0]
    : booking.guest;
  if (guest) {
    return guest.name ?? guest.email;
  }
  return booking.guest_name ?? booking.guest_email ?? 'Guest';
}

export function BookingRequests({
  bookings,
  slug,
}: {
  bookings: RequestBooking[];
  slug: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineMessage, setDeclineMessage] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [limitPayload, setLimitPayload] = useState<{
    used: number;
    limit: number;
  } | null>(null);

  async function handleAction(
    bookingId: string,
    action: 'approve' | 'decline',
    message?: string
  ) {
    setLoading(bookingId);
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, decline_message: message }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    setDeclineId(null);

    if (!res.ok) {
      if (action === 'approve' && isLimitReachedResponse(res.status, data)) {
        setLimitPayload({ used: data.used, limit: data.limit });
        setUpgradeOpen(true);
        return;
      }
      toast.error('Action failed');
      return;
    }

    toast.success(action === 'approve' ? 'Booking approved' : 'Booking declined');
    router.refresh();
  }

  const pending = bookings.filter((b) => b.status === 'requested');
  const recent = bookings.filter((b) => b.status !== 'requested');

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          Pending requests
          {pending.length > 0 && (
            <span className="ml-2 text-base font-normal text-muted-foreground">
              ({pending.length})
            </span>
          )}
        </h2>
        <div className="space-y-3">
          {pending.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No pending requests — you&apos;re all caught up.
              </CardContent>
            </Card>
          ) : (
            pending.map((booking) => {
              const dates = Array.isArray(booking.dates)
                ? booking.dates[0]
                : booking.dates;
              const rooms =
                booking.booking_rooms
                  ?.map((br) => {
                    const room = Array.isArray(br.room) ? br.room[0] : br.room;
                    return room?.name ?? 'Room';
                  })
                  .join(', ') ?? '';

              return (
                <Card key={booking.id}>
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">
                          {guestDisplayName(booking)}
                        </p>
                        {dates && (
                          <p className="text-sm text-muted-foreground">
                            {formatDateRange(dates.check_in, dates.check_out)}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {rooms} · {booking.party_size} guests
                        </p>
                        {booking.notes && (
                          <p className="mt-2 text-sm italic">
                            &ldquo;{booking.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAction(booking.id, 'approve')}
                        disabled={loading === booking.id}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setDeclineId(booking.id)}
                        disabled={loading === booking.id}
                      >
                        Decline
                      </Button>
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/${slug}/bookings/${booking.id}`}>
                          Manage
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Recent activity</h2>
          <div className="space-y-3">
            {recent.slice(0, 10).map((booking) => {
              const dates = Array.isArray(booking.dates)
                ? booking.dates[0]
                : booking.dates;
              return (
                <Card key={booking.id}>
                  <CardContent className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">
                          {guestDisplayName(booking)}
                        </p>
                        {!booking.invitation_id && (
                          <Badge variant="secondary" className="text-xs">
                            Manual stay
                          </Badge>
                        )}
                      </div>
                      {dates && (
                        <p className="text-sm text-muted-foreground">
                          {formatDateRange(dates.check_in, dates.check_out)}
                        </p>
                      )}
                      <p className="text-xs capitalize text-muted-foreground">
                        {booking.status}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {booking.status === 'approved' &&
                        booking.invitation_id && (
                          <AddToCalendarButton bookingId={booking.id} />
                        )}
                      {booking.status === 'approved' &&
                        !booking.invitation_id && (
                          <CancelHostStayButton bookingId={booking.id} />
                        )}
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/${slug}/bookings/${booking.id}`}>
                          Manage
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        used={limitPayload?.used}
        limit={limitPayload?.limit}
        returnPath={`/dashboard/${slug}/requests`}
      />

      <Dialog open={!!declineId} onOpenChange={() => setDeclineId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline request</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Optional message to guest..."
            value={declineMessage}
            onChange={(e) => setDeclineMessage(e.target.value)}
          />
          <Button
            variant="destructive"
            onClick={() =>
              declineId &&
              handleAction(declineId, 'decline', declineMessage || undefined)
            }
            disabled={loading === declineId}
          >
            Decline request
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
