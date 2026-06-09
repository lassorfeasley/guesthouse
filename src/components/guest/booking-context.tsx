'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import {
  rangeConflictsWithAvailability,
  type CalendarBlock,
  type CalendarBooking,
  type RoomAvailability,
} from '@/lib/guest-calendar';

interface BookingSelection {
  checkIn: string | null;
  checkOut: string | null;
}

type DateField = 'checkIn' | 'checkOut';

export interface BookableRoom {
  id: string;
  name: string;
  max_occupancy: number;
}

interface BookingContextValue extends BookingSelection {
  guests: number;
  activeField: DateField | null;
  setRange: (value: BookingSelection) => void;
  setGuests: (n: number) => void;
  setActiveField: (field: DateField | null) => void;
  clear: () => void;
  /** House-level booking only */
  rooms: BookableRoom[];
  selectedRoomIds: string[];
  toggleRoom: (roomId: string) => void;
  selectAllRooms: () => void;
  lockRoomSelection: boolean;
  combinedBookings: CalendarBooking[];
  combinedBlocks: CalendarBlock[];
  /** Per-room availability for the full in-scope room set (house-level views). */
  roomAvailability: Record<string, RoomAvailability>;
  maxGuests: number;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({
  children,
  defaultRange,
  defaultGuests = 1,
  rooms = [],
  roomAvailability = {},
  defaultSelectedRoomIds,
  lockRoomSelection = false,
  /** Per-room pages: cap guests without room list in context. */
  maxGuestsCap,
}: {
  children: ReactNode;
  defaultRange?: BookingSelection;
  defaultGuests?: number;
  rooms?: BookableRoom[];
  roomAvailability?: Record<string, RoomAvailability>;
  defaultSelectedRoomIds?: string[];
  lockRoomSelection?: boolean;
  maxGuestsCap?: number;
}) {
  const allRoomIds = useMemo(() => rooms.map((r) => r.id), [rooms]);

  const [range, setRange] = useState<BookingSelection>(
    defaultRange ?? { checkIn: null, checkOut: null }
  );
  const [guests, setGuestsState] = useState(defaultGuests);
  const [activeField, setActiveField] = useState<DateField | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>(
    () => defaultSelectedRoomIds ?? allRoomIds
  );

  const combinedBookings = useMemo(() => {
    const out: CalendarBooking[] = [];
    for (const id of selectedRoomIds) {
      const avail = roomAvailability[id];
      if (avail) out.push(...avail.bookings);
    }
    return out;
  }, [selectedRoomIds, roomAvailability]);

  const combinedBlocks = useMemo(() => {
    const out: CalendarBlock[] = [];
    for (const id of selectedRoomIds) {
      const avail = roomAvailability[id];
      if (avail) out.push(...avail.blocks);
    }
    return out;
  }, [selectedRoomIds, roomAvailability]);

  const maxGuests = useMemo(() => {
    if (rooms.length > 0) {
      return (
        rooms
          .filter((r) => selectedRoomIds.includes(r.id))
          .reduce((sum, r) => sum + r.max_occupancy, 0) || 1
      );
    }
    return maxGuestsCap ?? 99;
  }, [rooms, selectedRoomIds, maxGuestsCap]);

  useEffect(() => {
    setGuestsState((g) => Math.min(g, maxGuests));
  }, [maxGuests]);

  const setGuests = useCallback(
    (n: number) => setGuestsState(Math.min(Math.max(1, n), maxGuests)),
    [maxGuests]
  );

  const invalidateRangeIfNeeded = useCallback(
    (bookings: CalendarBooking[], blocks: CalendarBlock[]) => {
      setRange((current) => {
        if (
          current.checkIn &&
          current.checkOut &&
          rangeConflictsWithAvailability(
            current.checkIn,
            current.checkOut,
            bookings,
            blocks
          )
        ) {
          if (rooms.length > 0) {
            toast.info(
              'Dates cleared — selected rooms are not all available for those dates.'
            );
          }
          return { checkIn: null, checkOut: null };
        }
        return current;
      });
    },
    [rooms.length]
  );

  const toggleRoom = useCallback(
    (roomId: string) => {
      if (lockRoomSelection) return;

      setSelectedRoomIds((prev) => {
        if (prev.includes(roomId) && prev.length === 1) return prev;

        const next = prev.includes(roomId)
          ? prev.filter((id) => id !== roomId)
          : [...prev, roomId];

        const nextBookings: CalendarBooking[] = [];
        const nextBlocks: CalendarBlock[] = [];
        for (const id of next) {
          const avail = roomAvailability[id];
          if (avail) {
            nextBookings.push(...avail.bookings);
            nextBlocks.push(...avail.blocks);
          }
        }
        invalidateRangeIfNeeded(nextBookings, nextBlocks);
        return next;
      });
    },
    [lockRoomSelection, roomAvailability, invalidateRangeIfNeeded]
  );

  const selectAllRooms = useCallback(() => {
    if (lockRoomSelection) return;
    setSelectedRoomIds(allRoomIds);
    const nextBookings: CalendarBooking[] = [];
    const nextBlocks: CalendarBlock[] = [];
    for (const id of allRoomIds) {
      const avail = roomAvailability[id];
      if (avail) {
        nextBookings.push(...avail.bookings);
        nextBlocks.push(...avail.blocks);
      }
    }
    invalidateRangeIfNeeded(nextBookings, nextBlocks);
  }, [allRoomIds, lockRoomSelection, roomAvailability, invalidateRangeIfNeeded]);

  const value = useMemo<BookingContextValue>(
    () => ({
      checkIn: range.checkIn,
      checkOut: range.checkOut,
      guests,
      activeField,
      setRange,
      setGuests,
      setActiveField,
      clear: () => {
        setRange({ checkIn: null, checkOut: null });
        setActiveField('checkIn');
      },
      rooms,
      selectedRoomIds,
      toggleRoom,
      selectAllRooms,
      lockRoomSelection,
      combinedBookings,
      combinedBlocks,
      roomAvailability,
      maxGuests,
    }),
    [
      range,
      guests,
      activeField,
      setGuests,
      rooms,
      selectedRoomIds,
      toggleRoom,
      selectAllRooms,
      lockRoomSelection,
      combinedBookings,
      combinedBlocks,
      roomAvailability,
      maxGuests,
    ]
  );

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return ctx;
}

/** Like {@link useBooking} but returns null outside a provider instead of throwing. */
export function useOptionalBooking(): BookingContextValue | null {
  return useContext(BookingContext);
}
