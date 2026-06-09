'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateRange } from '@/lib/dates';
import type { RoomAvailability } from '@/lib/guest-calendar';
import type { Room } from '@/types/database';
import { BookingProvider, useBooking } from '@/components/guest/booking-context';
import { HouseCalendar } from '@/components/guest/house-calendar';
import { SurveyDialogLayout } from '@/components/dashboard/survey-dialog-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CalendarPlus } from 'lucide-react';
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog';
import { isLimitReachedResponse } from '@/lib/billing-client';

interface HostBookingDialogProps {
  propertyId: string;
  rooms: Room[];
  roomAvailability: Record<string, RoomAvailability>;
  /** When true, uses the surrounding BookingProvider (e.g. host page sidebar). */
  useParentBookingContext?: boolean;
  trigger?: ReactNode;
}

type StepKey = 'guest' | 'dates' | 'rooms' | 'details' | 'review';

const STEPS: StepKey[] = ['guest', 'dates', 'rooms', 'details', 'review'];

const STEP_TITLES: Record<StepKey, string> = {
  guest: 'Who is the guest?',
  dates: 'When is the stay?',
  rooms: 'Which rooms are included?',
  details: 'Any final details?',
  review: 'Review and confirm',
};

function ManualStaySurvey({
  propertyId,
  returnPath,
  onClose,
}: {
  propertyId: string;
  returnPath?: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [limitPayload, setLimitPayload] = useState<{
    used: number;
    limit: number;
  } | null>(null);
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyGuest, setNotifyGuest] = useState(false);

  const {
    checkIn,
    checkOut,
    guests,
    setGuests,
    maxGuests,
    rooms: bookableRooms,
    selectedRoomIds,
    toggleRoom,
    selectAllRooms,
    lockRoomSelection,
  } = useBooking();

  const current = Math.min(step, STEPS.length - 1);
  const stepKey = STEPS[current];
  const isLast = current === STEPS.length - 1;

  const guestName = [guestFirstName.trim(), guestLastName.trim()]
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!lockRoomSelection) {
      selectAllRooms();
    }
  }, [lockRoomSelection, selectAllRooms]);

  const selectedRooms = bookableRooms.filter((r) =>
    selectedRoomIds.includes(r.id)
  );
  const roomsLabel =
    selectedRoomIds.length === bookableRooms.length
      ? 'Entire place'
      : selectedRooms.map((r) => r.name).join(', ') || '—';

  function validateStep(key: StepKey): boolean {
    if (key === 'guest') {
      if (!guestFirstName.trim()) {
        toast.error('First name is required');
        return false;
      }
    }
    if (key === 'dates') {
      if (!checkIn || !checkOut) {
        toast.error('Select check-in and check-out dates');
        return false;
      }
    }
    if (key === 'rooms' && selectedRoomIds.length === 0) {
      toast.error('Select at least one room');
      return false;
    }
    if (key === 'details' && notifyGuest && !guestEmail.trim()) {
      toast.error('Email is required to notify the guest');
      return false;
    }
    return true;
  }

  async function handleNext() {
    if (!isLast) {
      if (!validateStep(stepKey)) return;
      setStep(current + 1);
      return;
    }
    if (!validateStep('guest') || !validateStep('dates') || !validateStep('rooms')) {
      return;
    }
    if (notifyGuest && !guestEmail.trim()) {
      toast.error('Email is required to notify the guest');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/bookings/host', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: propertyId,
        guest_first_name: guestFirstName.trim(),
        guest_last_name: guestLastName.trim() || undefined,
        guest_email: guestEmail.trim() || undefined,
        guest_phone: guestPhone.trim() || undefined,
        check_in: checkIn,
        check_out: checkOut,
        room_ids: selectedRoomIds,
        party_size: guests,
        notes: notes.trim() || undefined,
        notify_guest: notifyGuest,
      }),
    });
    setLoading(false);

    const data = await res.json();
    if (!res.ok) {
      if (isLimitReachedResponse(res.status, data)) {
        setLimitPayload({ used: data.used, limit: data.limit });
        setUpgradeOpen(true);
        return;
      }
      toast.error(
        typeof data.error === 'string' ? data.error : 'Failed to add stay'
      );
      return;
    }

    toast.success('Stay added to calendar');
    onClose();
    router.refresh();
  }

  return (
    <>
    <SurveyDialogLayout
      title="Add a manual stay"
      stepIndex={current}
      stepCount={STEPS.length}
      stepTitle={STEP_TITLES[stepKey]}
      onBack={current > 0 ? () => setStep(current - 1) : undefined}
      onNext={handleNext}
      nextLabel={isLast ? (loading ? 'Adding…' : 'Add to calendar') : 'Next'}
      loading={loading}
    >
      {stepKey === 'guest' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            For guests who won&apos;t use the app — family, neighbors, or
            anyone you&apos;re hosting offline.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="manual-guest-first-name">First name</Label>
              <Input
                id="manual-guest-first-name"
                autoFocus
                value={guestFirstName}
                onChange={(e) => setGuestFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-guest-last-name">Last name (optional)</Label>
              <Input
                id="manual-guest-last-name"
                value={guestLastName}
                onChange={(e) => setGuestLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-guest-email">Email (optional)</Label>
            <Input
              id="manual-guest-email"
              type="email"
              value={guestEmail}
              onChange={(e) => {
                setGuestEmail(e.target.value);
                if (!e.target.value.trim()) setNotifyGuest(false);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-guest-phone">Phone (optional)</Label>
            <Input
              id="manual-guest-phone"
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
            />
          </div>
        </div>
      )}

      {stepKey === 'dates' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select check-in and check-out. Crossed-out dates are already booked.
          </p>
          <HouseCalendar monthsToShow={1} />
          <div className="rounded-xl border p-4 text-sm">
            <span className="font-medium">
              {checkIn && checkOut
                ? formatDateRange(checkIn, checkOut)
                : 'No dates selected'}
            </span>
          </div>
        </div>
      )}

      {stepKey === 'rooms' && (
        <div className="space-y-4">
          <div className="flex min-h-10 flex-wrap gap-2">
            {selectedRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No rooms selected yet.
              </p>
            ) : (
              selectedRooms.map((room) => (
                <Badge
                  key={room.id}
                  variant="secondary"
                  className="gap-1 py-1.5 pl-3 pr-1.5 text-sm font-normal"
                >
                  {room.name}
                  <button
                    type="button"
                    onClick={() => toggleRoom(room.id)}
                    className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                    aria-label={`Remove ${room.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {bookableRooms
              .filter((r) => !selectedRoomIds.includes(r.id))
              .map((room) => (
                <button
                  key={room.id}
                  type="button"
                  onClick={() => toggleRoom(room.id)}
                  className="rounded-full border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                >
                  <Plus className="mr-1 inline h-3.5 w-3.5" />
                  {room.name}
                </button>
              ))}
          </div>
        </div>
      )}

      {stepKey === 'details' && (
        <div className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div>
              <p className="font-medium">Guests</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Up to {maxGuests} for the selected rooms.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setGuests(Math.max(1, guests - 1))}
                disabled={guests <= 1}
              >
                −
              </Button>
              <span className="w-6 text-center text-sm font-medium">{guests}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setGuests(Math.min(maxGuests, guests + 1))}
                disabled={guests >= maxGuests}
              >
                +
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="manual-notes">Notes (optional)</Label>
            <Textarea
              id="manual-notes"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-4">
            <div className="space-y-0.5">
              <Label>Send guest emails</Label>
              <p className="text-sm text-muted-foreground">
                Confirmation, house info, and check-in reminders
              </p>
            </div>
            <Switch
              checked={notifyGuest}
              onCheckedChange={setNotifyGuest}
              disabled={!guestEmail.trim()}
            />
          </div>
        </div>
      )}

      {stepKey === 'review' && (
        <dl className="space-y-4 text-sm">
          <div className="rounded-xl border p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Guest
            </dt>
            <dd className="mt-1 font-medium">{guestName}</dd>
            {guestEmail && (
              <dd className="text-muted-foreground">{guestEmail}</dd>
            )}
            {guestPhone && (
              <dd className="text-muted-foreground">{guestPhone}</dd>
            )}
          </div>
          <div className="rounded-xl border p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Dates
            </dt>
            <dd className="mt-1 font-medium">
              {checkIn && checkOut ? formatDateRange(checkIn, checkOut) : '—'}
            </dd>
          </div>
          <div className="rounded-xl border p-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rooms & guests
            </dt>
            <dd className="mt-1 font-medium">
              {roomsLabel} · {guests} {guests === 1 ? 'guest' : 'guests'}
            </dd>
          </div>
          {notes.trim() && (
            <div className="rounded-xl border p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Notes
              </dt>
              <dd className="mt-1 whitespace-pre-wrap">{notes}</dd>
            </div>
          )}
          {notifyGuest && guestEmail && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              The guest will receive confirmation and stay emails.
            </p>
          )}
        </dl>
      )}
    </SurveyDialogLayout>
    <UpgradeDialog
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
      used={limitPayload?.used}
      limit={limitPayload?.limit}
      returnPath={returnPath ?? pathname}
    />
    </>
  );
}

export function HostBookingDialog({
  propertyId,
  rooms,
  roomAvailability,
  useParentBookingContext = false,
  trigger,
  returnPath,
}: HostBookingDialogProps & { returnPath?: string }) {
  const [open, setOpen] = useState(false);

  const bookableRooms = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    max_occupancy: r.max_occupancy,
  }));

  const survey = (
    <ManualStaySurvey
      propertyId={propertyId}
      returnPath={returnPath}
      onClose={() => setOpen(false)}
    />
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" disabled={rooms.length === 0}>
            <CalendarPlus className="mr-1 h-4 w-4" />
            Add manual stay
          </Button>
        )}
      </DialogTrigger>
      {open &&
        (useParentBookingContext ? (
          survey
        ) : (
          <BookingProvider
            rooms={bookableRooms}
            roomAvailability={roomAvailability}
            defaultGuests={1}
            defaultSelectedRoomIds={bookableRooms.map((r) => r.id)}
          >
            {survey}
          </BookingProvider>
        ))}
    </Dialog>
  );
}
