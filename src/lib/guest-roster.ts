import { guestKeyFromEmail, guestKeyFromManualVisit } from '@/lib/guest-keys';
import type { Invitation, InvitationStatus, InvitationType } from '@/types/database';

export interface GuestStay {
  visitId: string;
  checkIn: string;
  checkOut: string;
  status: string;
  partySize: number;
  roomNames: string[];
  isManual: boolean;
  notes: string | null;
}

export interface GuestInvitationSummary {
  id: string;
  token: string;
  status: InvitationStatus;
  type: InvitationType;
  requiresApproval: boolean;
  expiresAt: string | null;
  message: string | null;
  createdAt: string;
}

export interface GuestRosterEntry {
  key: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** Host's label for who this guest is to them, if set. */
  relationship: string | null;
  invitation: GuestInvitationSummary | null;
  stays: GuestStay[];
  upcomingStay: GuestStay | null;
  pastStaysCount: number;
}

type BookingRow = {
  id: string;
  status: string;
  invitation_id: string | null;
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  relationship: string | null;
  party_size: number;
  notes: string | null;
  guest: { name: string | null; email: string } | { name: string | null; email: string }[] | null;
  dates:
    | { check_in: string; check_out: string }
    | { check_in: string; check_out: string }[]
    | null;
  visit_rooms: { room: { name: string } | { name: string }[] }[];
  invitation: Invitation | Invitation[] | null;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e && e.includes('@') ? e : null;
}

function guestNameFromBooking(b: BookingRow): string {
  const user = Array.isArray(b.guest) ? b.guest[0] : b.guest;
  return (
    user?.name ??
    b.guest_name ??
    user?.email?.split('@')[0] ??
    b.guest_email?.split('@')[0] ??
    'Guest'
  );
}

function guestEmailFromBooking(b: BookingRow): string | null {
  const user = Array.isArray(b.guest) ? b.guest[0] : b.guest;
  return normalizeEmail(user?.email ?? b.guest_email);
}

function toStay(b: BookingRow): GuestStay | null {
  const dates = Array.isArray(b.dates) ? b.dates[0] : b.dates;
  if (!dates?.check_in || !dates?.check_out) return null;
  const roomNames =
    b.visit_rooms?.map((br) => {
      const room = Array.isArray(br.room) ? br.room[0] : br.room;
      return room?.name ?? 'Room';
    }) ?? [];
  return {
    visitId: b.id,
    checkIn: dates.check_in,
    checkOut: dates.check_out,
    status: b.status,
    partySize: b.party_size,
    roomNames,
    isManual: !b.invitation_id,
    notes: b.notes,
  };
}

function invitationSummary(inv: Invitation): GuestInvitationSummary {
  return {
    id: inv.id,
    token: inv.token,
    status: inv.status,
    type: inv.type,
    requiresApproval: inv.requires_approval,
    expiresAt: inv.expires_at,
    message: inv.message,
    createdAt: inv.created_at,
  };
}

function pickUpcoming(stays: GuestStay[], today: string): GuestStay | null {
  const upcoming = stays
    .filter((s) => s.status === 'approved' && s.checkOut >= today)
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  return upcoming[0] ?? null;
}

export function buildGuestRoster(
  invitations: Invitation[],
  visits: BookingRow[],
  today = new Date().toISOString().split('T')[0]
): GuestRosterEntry[] {
  const map = new Map<string, GuestRosterEntry>();

  function ensure(
    key: string,
    seed: { name: string; email: string | null; phone?: string | null }
  ): GuestRosterEntry {
    let entry = map.get(key);
    if (!entry) {
      entry = {
        key,
        name: seed.name,
        email: seed.email,
        phone: seed.phone ?? null,
        relationship: null,
        invitation: null,
        stays: [],
        upcomingStay: null,
        pastStaysCount: 0,
      };
      map.set(key, entry);
    } else {
      if (seed.name && seed.name !== 'Guest') entry.name = seed.name;
      if (seed.email) entry.email = seed.email;
      if (seed.phone) entry.phone = seed.phone;
    }
    return entry;
  }

  for (const inv of invitations) {
    const email = normalizeEmail(inv.guest_email);
    const key = email
      ? guestKeyFromEmail(email)
      : `i-${inv.id}`;
    const entry = ensure(key, {
      name: inv.guest_name ?? inv.guest_email.split('@')[0],
      email,
    });
    if (
      !entry.invitation ||
      new Date(inv.created_at) >= new Date(entry.invitation.createdAt)
    ) {
      entry.invitation = invitationSummary(inv);
    }
    if (inv.relationship && !entry.relationship) {
      entry.relationship = inv.relationship;
    }
  }

  for (const b of visits) {
    const email = guestEmailFromBooking(b);
    const key = email
      ? guestKeyFromEmail(email)
      : guestKeyFromManualVisit(b.id);
    const entry = ensure(key, {
      name: guestNameFromBooking(b),
      email,
      phone: b.guest_phone,
    });

    const invRaw = b.invitation
      ? Array.isArray(b.invitation)
        ? b.invitation[0]
        : b.invitation
      : null;
    if (invRaw && !entry.invitation) {
      entry.invitation = invitationSummary(invRaw as Invitation);
    }

    if (b.relationship && !entry.relationship) {
      entry.relationship = b.relationship;
    }

    const stay = toStay(b);
    if (stay && !entry.stays.some((s) => s.visitId === stay.visitId)) {
      entry.stays.push(stay);
    }
  }

  for (const entry of map.values()) {
    entry.stays.sort((a, b) => b.checkIn.localeCompare(a.checkIn));
    entry.upcomingStay = pickUpcoming(entry.stays, today);
    entry.pastStaysCount = entry.stays.filter(
      (s) => s.status === 'approved' && s.checkOut < today
    ).length;
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.upcomingStay && !b.upcomingStay) return -1;
    if (!a.upcomingStay && b.upcomingStay) return 1;
    if (a.upcomingStay && b.upcomingStay) {
      return a.upcomingStay.checkIn.localeCompare(b.upcomingStay.checkIn);
    }
    return a.name.localeCompare(b.name);
  });
}

export function findRosterEntry(
  roster: GuestRosterEntry[],
  guestKey: string
): GuestRosterEntry | undefined {
  return roster.find((g) => g.key === guestKey);
}
