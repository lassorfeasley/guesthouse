'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { Room } from '@/types/database';
import type { RoomAvailability } from '@/lib/guest-calendar';
import { BookingProvider, useBooking } from '@/components/guest/booking-context';
import { HouseCalendar } from '@/components/guest/house-calendar';
import {
  HostStaySidebar,
  type HostActionType,
  type HostInviteType,
} from '@/components/dashboard/host-stay-sidebar';
import { InviteGuestDialog } from '@/components/dashboard/invite-guest-dialog';
import { Button } from '@/components/ui/button';
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog';
import { isLimitReachedResponse } from '@/lib/billing-client';

type ComposeVariant = 'page' | 'embedded' | 'split';

type HostComposeParts = {
  sidebar: ReactNode;
  calendarBlock: ReactNode;
};

const HostComposePartsContext = createContext<HostComposeParts | null>(null);

function useHostComposeParts(): HostComposeParts {
  const parts = useContext(HostComposePartsContext);
  if (!parts) {
    throw new Error('Host compose parts must be used within HostComposeForm');
  }
  return parts;
}

function HostComposeForm({
  propertyId,
  slug,
  rooms,
  variant,
  initialMode,
  readModeFromUrl,
  children,
}: {
  propertyId: string;
  slug: string;
  rooms: Room[];
  variant: ComposeVariant;
  initialMode: HostActionType;
  readModeFromUrl: boolean;
  children?: ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlMode: HostActionType =
    searchParams.get('mode') === 'manual' ? 'manual' : 'invite';
  const [actionType, setActionType] = useState<HostActionType>(initialMode);

  useEffect(() => {
    if (readModeFromUrl) {
      setActionType(urlMode);
    }
  }, [readModeFromUrl, urlMode]);

  const { checkIn, checkOut, setRange, setActiveField, selectedRoomIds, guests } =
    useBooking();

  const [inviteType, setInviteType] = useState<HostInviteType>('date_offer');
  const [windows, setWindows] = useState<
    { start_date: string; end_date: string }[]
  >([]);
  const [guestEmail, setGuestEmail] = useState('');
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [message, setMessage] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [notes, setNotes] = useState('');
  const [notifyGuest, setNotifyGuest] = useState(false);
  const [loading, setLoading] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [limitPayload, setLimitPayload] = useState<{
    used: number;
    limit: number;
  } | null>(null);

  const datesEditable = true;

  function handleInviteTypeChange(type: HostInviteType) {
    setInviteType(type);
    setWindows([]);
    setRange({ checkIn: null, checkOut: null });
    setActiveField('checkIn');
  }

  useEffect(() => {
    if (
      actionType === 'invite' &&
      inviteType === 'prix_fixe' &&
      checkIn &&
      checkOut
    ) {
      setWindows([{ start_date: checkIn, end_date: checkOut }]);
    }
  }, [actionType, inviteType, checkIn, checkOut]);

  function addWindowFromSelection() {
    if (!checkIn || !checkOut) {
      toast.error('Select a date range on the calendar first');
      return;
    }
    if (checkOut <= checkIn) {
      toast.error('Check-out must be after check-in');
      return;
    }
    if (inviteType === 'prix_fixe') {
      setWindows([{ start_date: checkIn, end_date: checkOut }]);
      return;
    }
    const duplicate = windows.some(
      (w) => w.start_date === checkIn && w.end_date === checkOut
    );
    if (duplicate) {
      toast.error('That window is already added');
      return;
    }
    setWindows((prev) => [
      ...prev,
      { start_date: checkIn, end_date: checkOut },
    ]);
    setRange({ checkIn: null, checkOut: null });
    setActiveField('checkIn');
  }

  async function submitInvite() {
    if (!guestEmail.trim()) {
      toast.error('Guest email is required');
      return;
    }
    if (selectedRoomIds.length === 0) {
      toast.error('Select at least one room');
      return;
    }
    if (windows.length === 0) {
      toast.error('Add at least one date window');
      return;
    }

    setLoading(true);
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property_id: propertyId,
        guest_email: guestEmail.trim(),
        guest_first_name: guestFirstName.trim() || undefined,
        guest_last_name: guestLastName.trim() || undefined,
        type: inviteType,
        requires_approval: requiresApproval,
        message: message.trim() || undefined,
        room_ids: selectedRoomIds,
        windows: windows.filter((w) => w.start_date && w.end_date),
      }),
    });
    setLoading(false);

    const data = await res.json();
    if (!res.ok) {
      toast.error(
        typeof data.error === 'string' ? data.error : 'Failed to send invitation'
      );
      return;
    }

    if (data.emailSent === false) {
      toast.warning(
        'Invitation created, but email could not be sent. Copy the link from Guests.'
      );
    } else {
      toast.success('Invitation sent!');
    }
    router.push(`/dashboard/${slug}/guests`);
    router.refresh();
  }

  async function submitManual() {
    if (!guestFirstName.trim()) {
      toast.error('First name is required');
      return;
    }
    if (!checkIn || !checkOut) {
      toast.error('Select check-in and check-out');
      return;
    }
    if (selectedRoomIds.length === 0) {
      toast.error('Select at least one room');
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
    router.push(`/dashboard/${slug}/overview`);
    router.refresh();
  }

  const calendarHint =
    actionType === 'manual'
      ? 'Crossed-out dates are already booked. Select check-in and check-out.'
      : inviteType === 'prix_fixe'
        ? 'Select the exact stay dates you are offering.'
        : 'Select a range, then add it as an offered window below.';

  const sidebar = (
    <>
      <HostStaySidebar
        propertyId={propertyId}
        actionType={actionType}
        onActionTypeChange={setActionType}
        inviteType={inviteType}
        onInviteTypeChange={handleInviteTypeChange}
        rooms={rooms}
        windows={windows}
        onRemoveWindow={(i) =>
          setWindows((prev) => prev.filter((_, idx) => idx !== i))
        }
        guestEmail={guestEmail}
        onGuestEmailChange={setGuestEmail}
        guestFirstName={guestFirstName}
        onGuestFirstNameChange={setGuestFirstName}
        guestLastName={guestLastName}
        onGuestLastNameChange={setGuestLastName}
        guestPhone={guestPhone}
        onGuestPhoneChange={setGuestPhone}
        message={message}
        onMessageChange={setMessage}
        notes={notes}
        onNotesChange={setNotes}
        requiresApproval={requiresApproval}
        onRequiresApprovalChange={setRequiresApproval}
        notifyGuest={notifyGuest}
        onNotifyGuestChange={setNotifyGuest}
        datesEditable={datesEditable}
        calendarDisabled={false}
        loading={loading}
        onSubmitInvite={submitInvite}
        onSubmitManual={submitManual}
      />
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Need a standing invitation?{' '}
        <InviteGuestDialog
          propertyId={propertyId}
          rooms={rooms}
          trigger={
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2"
            >
              Use quick invite form
            </button>
          }
        />
      </p>
    </>
  );

  const calendarBlock = (
    <>
      <p
        className={cn(
          'text-muted-foreground',
          variant === 'page' ? 'mt-2 text-base' : 'mt-2 text-sm'
        )}
      >
        {calendarHint}
      </p>
      <div className="mt-6">
        <HouseCalendar
          monthsToShow={2}
          disabled={false}
          bookingHrefBase={`/dashboard/${slug}/bookings`}
        />
      </div>
      {actionType === 'invite' && inviteType === 'date_offer' && (
        <Button
          type="button"
          variant="outline"
          className="mt-4"
          onClick={addWindowFromSelection}
          disabled={!checkIn || !checkOut}
        >
          Add selected range as offer window
        </Button>
      )}
    </>
  );

  const calendarColumn = (
    <div className="min-w-0">
      {variant === 'embedded' && (
        <section>
          <h3 className="text-lg font-semibold tracking-tight">Calendar</h3>
          {calendarBlock}
        </section>
      )}
      {variant === 'page' && (
        <section>
          <h2 className="text-2xl font-semibold tracking-tight">
            Availability
          </h2>
          {calendarBlock}
        </section>
      )}
    </div>
  );

  const upgradeDialog = (
    <UpgradeDialog
      open={upgradeOpen}
      onOpenChange={setUpgradeOpen}
      used={limitPayload?.used}
      limit={limitPayload?.limit}
      returnPath={`/dashboard/${slug}/compose`}
    />
  );

  if (variant === 'split') {
    return (
      <>
        <HostComposePartsContext.Provider
          value={{ sidebar, calendarBlock }}
        >
          {children}
        </HostComposePartsContext.Provider>
        {upgradeDialog}
      </>
    );
  }

  if (variant === 'embedded') {
    return (
      <>
        <div className="grid gap-x-12 gap-y-8 lg:grid-cols-[1fr_360px]">
          <div className="order-2 min-w-0 lg:order-1">{calendarColumn}</div>
          <aside className="order-1 lg:sticky lg:top-8 lg:order-2 lg:self-start">
            {sidebar}
          </aside>
        </div>
        {upgradeDialog}
      </>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Book a guest stay
          </h1>
          <p className="mt-1 text-muted-foreground">
            Pick dates on the calendar, then finish the details in the survey.
          </p>
        </div>

        <div className="mt-8 grid gap-x-12 gap-y-12 lg:grid-cols-[1fr_360px]">
          {calendarColumn}
          <aside className="lg:sticky lg:top-8 lg:self-start">{sidebar}</aside>
        </div>
      </div>
      {upgradeDialog}
    </>
  );
}

export function HostComposePanel({
  propertyId,
  slug,
  rooms,
  roomAvailability,
  variant = 'page',
  initialMode = 'invite',
  defaultSelectedRoomIds,
  lockRoomSelection = false,
  readModeFromUrl = false,
  children,
}: {
  propertyId: string;
  slug: string;
  rooms: Room[];
  roomAvailability: Record<string, RoomAvailability>;
  variant?: ComposeVariant;
  initialMode?: HostActionType;
  defaultSelectedRoomIds?: string[];
  lockRoomSelection?: boolean;
  readModeFromUrl?: boolean;
  children?: ReactNode;
}) {
  const bookableRooms = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    max_occupancy: r.max_occupancy,
  }));

  const allRoomIds = bookableRooms.map((r) => r.id);
  const selectedIds =
    defaultSelectedRoomIds?.filter((id) => allRoomIds.includes(id)) ??
    allRoomIds;

  if (rooms.length === 0) {
    if (variant === 'embedded') return null;
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-semibold">Add a room first</h1>
        <p className="mt-2 text-muted-foreground">
          You need at least one room before inviting guests or adding stays.
        </p>
        <Button className="mt-6" asChild>
          <Link href={`/dashboard/${slug}/overview#rooms`}>Go to rooms</Link>
        </Button>
      </div>
    );
  }

  return (
    <BookingProvider
      rooms={bookableRooms}
      roomAvailability={roomAvailability}
      defaultGuests={1}
      defaultSelectedRoomIds={selectedIds}
      lockRoomSelection={lockRoomSelection}
    >
      <HostComposeForm
        propertyId={propertyId}
        slug={slug}
        rooms={rooms}
        variant={variant}
        initialMode={initialMode}
        readModeFromUrl={readModeFromUrl}
      >
        {children}
      </HostComposeForm>
    </BookingProvider>
  );
}

export function HostComposeSplitGrid({
  children,
  className,
  stickyTop = 'lg:top-28',
}: {
  children: ReactNode;
  className?: string;
  stickyTop?: string;
}) {
  const { sidebar } = useHostComposeParts();

  return (
    <div
      className={cn(
        'grid gap-x-12 gap-y-12 lg:grid-cols-[1fr_360px]',
        className
      )}
    >
      <div className="min-w-0 divide-y">{children}</div>
      <aside className={cn('lg:sticky lg:self-start', stickyTop)}>
        {sidebar}
      </aside>
    </div>
  );
}

export function HostComposeCalendarSection({
  sectionId,
  title,
  footer,
}: {
  sectionId: string;
  title?: string;
  footer?: ReactNode;
}) {
  const { calendarBlock } = useHostComposeParts();

  return (
    <section id={sectionId} className="scroll-mt-28 py-10 first:pt-0">
      {title && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        </div>
      )}
      <div className={title ? 'mt-6' : undefined}>{calendarBlock}</div>
      {footer}
    </section>
  );
}

/** @deprecated Use HostComposePanel — kept for compose page */
export function StayCompose({
  propertyId,
  slug,
  rooms,
  roomAvailability,
}: {
  propertyId: string;
  slug: string;
  rooms: Room[];
  roomAvailability: Record<string, RoomAvailability>;
}) {
  return (
    <HostComposePanel
      propertyId={propertyId}
      slug={slug}
      rooms={rooms}
      roomAvailability={roomAvailability}
      variant="page"
      readModeFromUrl
    />
  );
}
