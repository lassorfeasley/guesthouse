import { parseISO, differenceInCalendarDays } from 'date-fns';
import { formatDateRange } from '@/lib/dates';

const LABEL = 'text-[11px] font-semibold uppercase tracking-wide text-muted-foreground';

/**
 * Shared stay summary (dates · nights, rooms, guests) used by both the guest
 * manage-stay card and the host manage-booking sidebar.
 *
 * `boxed` renders the fields inside a bordered, divided container to match the
 * booking sidebar's boxed data on other pages; the default is a plain list.
 */
export function StaySummaryList({
  checkIn,
  checkOut,
  roomNames,
  partySize,
  boxed = false,
}: {
  checkIn: string;
  checkOut: string;
  roomNames: string[];
  partySize: number;
  boxed?: boolean;
}) {
  const nights = differenceInCalendarDays(parseISO(checkOut), parseISO(checkIn));
  const hasRooms = roomNames.length > 0;

  if (boxed) {
    return (
      <div className="overflow-hidden rounded-xl border text-sm">
        <div className="p-3">
          <p className={LABEL}>Dates</p>
          <p className="mt-0.5 font-medium">
            {formatDateRange(checkIn, checkOut)}
            <span className="ml-1 font-normal text-muted-foreground">
              · {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
          </p>
        </div>
        {hasRooms && (
          <div className="border-t p-3">
            <p className={LABEL}>Rooms</p>
            <p className="mt-0.5">{roomNames.join(', ')}</p>
          </div>
        )}
        <div className="border-t p-3">
          <p className={LABEL}>Guests</p>
          <p className="mt-0.5">
            {partySize} {partySize === 1 ? 'guest' : 'guests'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <dl className="space-y-3 text-sm">
      <div>
        <dt className={LABEL}>Dates</dt>
        <dd className="mt-0.5 font-medium">
          {formatDateRange(checkIn, checkOut)}
          <span className="ml-1 font-normal text-muted-foreground">
            · {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
        </dd>
      </div>
      {hasRooms && (
        <div>
          <dt className={LABEL}>Rooms</dt>
          <dd className="mt-0.5">{roomNames.join(', ')}</dd>
        </div>
      )}
      <div>
        <dt className={LABEL}>Guests</dt>
        <dd className="mt-0.5">
          {partySize} {partySize === 1 ? 'guest' : 'guests'}
        </dd>
      </div>
    </dl>
  );
}
