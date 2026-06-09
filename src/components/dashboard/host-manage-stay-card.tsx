'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseISO, format } from 'date-fns';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { EditBookingSurvey } from '@/components/dashboard/edit-booking-survey';
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog';
import { isLimitReachedResponse } from '@/lib/billing-client';
import type { BookingWithDetails } from '@/types/database';

function formatBox(date: string): string {
  return format(parseISO(date), 'EEE, MMM d');
}

export function HostManageStayCard({
  booking,
}: {
  booking: BookingWithDetails;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [limitPayload, setLimitPayload] = useState<{
    used: number;
    limit: number;
  } | null>(null);

  const { check_in: checkIn, check_out: checkOut } = booking.dates;
  const roomsLabel = booking.rooms.map((r) => r.name).join(', ') || '—';
  const canEdit = booking.status === 'requested' || booking.status === 'approved';

  async function patch(body: Record<string, unknown>, successMsg: string) {
    setLoading(true);
    const res = await fetch(`/api/bookings/${booking.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (
        body.action === 'approve' &&
        isLimitReachedResponse(res.status, data)
      ) {
        setLimitPayload({ used: data.used, limit: data.limit });
        setUpgradeOpen(true);
        return;
      }
      toast.error(
        typeof data.error === 'string' ? data.error : 'Something went wrong'
      );
      return;
    }
    toast.success(successMsg);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border p-6 shadow-sm">
      <div className="overflow-hidden rounded-xl border">
        <div className="border-b p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Rooms
          </p>
          <p className="mt-0.5 text-sm">{roomsLabel}</p>
        </div>
        <div className="grid grid-cols-2 divide-x border-b">
          <div className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Check-in
            </p>
            <p className="mt-0.5 text-sm">{formatBox(checkIn)}</p>
          </div>
          <div className="p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Checkout
            </p>
            <p className="mt-0.5 text-sm">{formatBox(checkOut)}</p>
          </div>
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Guests
          </p>
          <p className="mt-0.5 text-sm">
            {booking.party_size} {booking.party_size === 1 ? 'guest' : 'guests'}
          </p>
        </div>
      </div>

      {booking.status === 'requested' && (
        <Button
          size="lg"
          className="mt-6 w-full"
          disabled={loading}
          onClick={() => patch({ action: 'approve' }, 'Booking approved')}
        >
          Approve request
        </Button>
      )}

      {canEdit && (
        <Button
          variant={booking.status === 'requested' ? 'outline' : 'default'}
          size="lg"
          className={booking.status === 'requested' ? 'mt-2 w-full' : 'mt-6 w-full'}
          disabled={loading}
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit booking
        </Button>
      )}

      {booking.status === 'requested' && (
        <Button
          variant="ghost"
          className="mt-2 w-full"
          disabled={loading}
          onClick={() => {
            if (confirm('Decline this stay request?')) {
              patch({ action: 'decline' }, 'Request declined');
            }
          }}
        >
          Decline request
        </Button>
      )}

      {canEdit && (
        <EditBookingSurvey
          open={editOpen}
          onOpenChange={setEditOpen}
          booking={booking}
        />
      )}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        used={limitPayload?.used}
        limit={limitPayload?.limit}
        returnPath={`/dashboard/${booking.property.slug}/bookings/${booking.id}`}
      />
    </div>
  );
}
