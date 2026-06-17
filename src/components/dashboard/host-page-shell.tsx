import { getInvitationRoomAvailability } from '@/lib/guest-availability';
import { HostPageLayout } from '@/components/dashboard/host-page-layout';
import { AddRoomSidebar } from '@/components/dashboard/add-room-sidebar';
import { BookingProvider } from '@/components/guest/booking-context';
import { cn } from '@/lib/utils';
import type { Room } from '@/types/database';

/** Two-column layout: scrollable page content + sticky booking sidebar. */
export async function HostPageShell({
  propertyId,
  rooms,
  defaultSelectedRoomIds,
  lockRoomSelection = false,
  preselectedRoomIds,
  className,
  leading,
  children,
}: {
  propertyId: string;
  rooms: Room[];
  defaultSelectedRoomIds?: string[];
  lockRoomSelection?: boolean;
  preselectedRoomIds?: string[];
  className?: string;
  /** Optional content rendered atop the left column, above the divided sections. */
  leading?: React.ReactNode;
  children: React.ReactNode;
}) {
  // No rooms yet (e.g. a freshly created home): the booking sidebar can't be
  // used, so show an "add your first room" call to action in its place. Still
  // provide the booking context so calendar children don't crash.
  if (rooms.length === 0) {
    return (
      <BookingProvider>
        <div
          className={cn(
            'grid gap-x-12 gap-y-12 lg:grid-cols-[1fr_360px]',
            className
          )}
        >
          <div className="min-w-0">
            {leading}
            <div className={cn('divide-y', leading && 'mt-2')}>{children}</div>
          </div>
          <aside className="lg:sticky lg:top-28 lg:self-start">
            <AddRoomSidebar propertyId={propertyId} />
          </aside>
        </div>
      </BookingProvider>
    );
  }

  const roomAvailability = await getInvitationRoomAvailability(
    rooms.map((r) => r.id),
    { includeGuestNames: true }
  );

  return (
    <HostPageLayout
      propertyId={propertyId}
      rooms={rooms}
      roomAvailability={roomAvailability}
      defaultSelectedRoomIds={defaultSelectedRoomIds}
      lockRoomSelection={lockRoomSelection}
      preselectedRoomIds={preselectedRoomIds}
      className={className}
      leading={leading}
    >
      {children}
    </HostPageLayout>
  );
}
