'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BedDouble,
  Copy,
  Eye,
  Link2,
  Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { formatDate, nightsBetween } from '@/lib/dates';
import { format, parseISO } from 'date-fns';
import { getInviteUrl } from '@/lib/invite-url';
import { guestPreviewQuery } from '@/lib/guest-preview';
import { isLimitReachedResponse } from '@/lib/billing-client';
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog';
import type { BookingStatus, InvitationStatus } from '@/types/database';

export type VisitTab =
  | 'all'
  | 'requested'
  | 'upcoming'
  | 'past'
  | 'cancelled'
  | 'invited';

export interface VisitItem {
  id: string;
  guestName: string;
  email: string | null;
  status: BookingStatus;
  checkIn: string;
  checkOut: string;
  partySize: number;
  rooms: string[];
  isManual: boolean;
  token: string | null;
  notes: string | null;
}

export interface InviteItem {
  id: string;
  guestName: string;
  email: string;
  status: InvitationStatus;
  type: string;
  token: string;
  expiresAt: string | null;
}

interface BookingsHubProps {
  slug: string;
  today: string;
  initialTab: VisitTab;
  visits: VisitItem[];
  invites: InviteItem[];
}

const TAB_ORDER: VisitTab[] = [
  'all',
  'invited',
  'requested',
  'upcoming',
  'past',
  'cancelled',
];
const TAB_LABEL: Record<VisitTab, string> = {
  all: 'All',
  invited: 'Invite sent',
  requested: 'Dates requested',
  upcoming: 'Scheduled',
  past: 'Past visits',
  cancelled: 'Cancelled',
};

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  if (!query) return true;
  const q = query.trim().toLowerCase();
  return fields.some((f) => f?.toLowerCase().includes(q));
}

type StatusMeta = {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
};

function visitStatusMeta(visit: VisitItem, today: string): StatusMeta {
  switch (visit.status) {
    case 'requested':
      return { label: 'Requested', variant: 'outline' };
    case 'declined':
      return { label: 'Declined', variant: 'destructive' };
    case 'cancelled':
      return { label: 'Cancelled', variant: 'secondary' };
    case 'approved':
    default:
      if (visit.checkOut < today) return { label: 'Past', variant: 'secondary' };
      if (visit.checkIn <= today && visit.checkOut >= today)
        return { label: 'On property', variant: 'default' };
      return { label: 'Scheduled', variant: 'default' };
  }
}

const INVITE_STATUS_META: Record<InvitationStatus, StatusMeta> = {
  pending: { label: 'Invited', variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  expired: { label: 'Expired', variant: 'secondary' },
  revoked: { label: 'Revoked', variant: 'destructive' },
};

const INVITE_TYPE_LABEL: Record<string, string> = {
  standing: 'Open invitation',
  date_offer: 'Date offer',
  prix_fixe: 'Fixed dates',
};

function formatStayDate(date: string): string {
  return format(parseISO(date), 'EEE, MMM d');
}

export function BookingsHub({
  slug,
  today,
  initialTab,
  visits,
  invites,
}: BookingsHubProps) {
  const router = useRouter();
  const [tab, setTab] = useState<VisitTab>(initialTab);
  const [query, setQuery] = useState('');

  // Approve / decline state is held here so request cards work in any tab
  // (e.g. "All" as well as "Requested").
  const [loading, setLoading] = useState<string | null>(null);
  const [declineId, setDeclineId] = useState<string | null>(null);
  const [declineMessage, setDeclineMessage] = useState('');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [limitPayload, setLimitPayload] = useState<{
    used: number;
    limit: number;
  } | null>(null);

  const counts: Record<VisitTab, number> = useMemo(() => {
    const approved = visits.filter((v) => v.status === 'approved');
    return {
      all: visits.length,
      requested: visits.filter((v) => v.status === 'requested').length,
      upcoming: approved.filter((v) => v.checkOut >= today).length,
      past: approved.filter((v) => v.checkOut < today).length,
      cancelled: visits.filter(
        (v) => v.status === 'cancelled' || v.status === 'declined'
      ).length,
      invited: invites.length,
    };
  }, [visits, invites, today]);

  const visibleVisits = useMemo(() => {
    const approved = (v: VisitItem) => v.status === 'approved';
    let list: VisitItem[];
    switch (tab) {
      case 'requested':
        list = visits.filter((v) => v.status === 'requested');
        break;
      case 'upcoming':
        list = visits.filter((v) => approved(v) && v.checkOut >= today);
        break;
      case 'past':
        list = visits.filter((v) => approved(v) && v.checkOut < today);
        break;
      case 'cancelled':
        list = visits.filter(
          (v) => v.status === 'cancelled' || v.status === 'declined'
        );
        break;
      case 'all':
        list = visits;
        break;
      default:
        list = [];
    }
    return list.filter((v) => matchesQuery(query, v.guestName, v.email));
  }, [tab, visits, today, query]);

  const visibleInvites = useMemo(
    () =>
      invites.filter((i) => matchesQuery(query, i.guestName, i.email)),
    [invites, query]
  );

  function selectTab(next: VisitTab) {
    setTab(next);
    setQuery('');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('status', next);
      window.history.replaceState(null, '', url.toString());
    }
  }

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

    toast.success(action === 'approve' ? 'Visit approved' : 'Visit declined');
    router.refresh();
  }

  async function revokeInvite(invitationId: string) {
    const res = await fetch('/api/invitations', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitation_id: invitationId, action: 'revoke' }),
    });
    if (!res.ok) {
      toast.error('Failed to revoke');
      return;
    }
    toast.success('Invitation revoked');
    router.refresh();
  }

  const isEmpty =
    tab === 'invited' ? visibleInvites.length === 0 : visibleVisits.length === 0;
  const tabHasAny = counts[tab] > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div
            role="tablist"
            aria-label="Filter visits"
            className="inline-flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1"
          >
            {TAB_ORDER.map((t) => {
              const active = tab === t;
              return (
                <button
                  key={t}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => selectTab(t)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {TAB_LABEL[t]}
                  {counts[t] > 0 && (
                    <span
                      className={cn(
                        'rounded-full px-1.5 text-xs tabular-nums',
                        active
                          ? t === 'requested'
                            ? 'bg-warning/20 text-warning-foreground'
                            : 'bg-muted text-foreground'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {counts[t]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="relative sm:ml-auto sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${TAB_LABEL[tab].toLowerCase()}…`}
              className="pl-9"
              aria-label="Search visits"
            />
          </div>
        </div>

        {isEmpty ? (
          <EmptyState
            tabHasAny={tabHasAny}
            label={TAB_LABEL[tab].toLowerCase()}
          />
        ) : tab === 'invited' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleInvites.map((inv) => (
              <InviteCard
                key={inv.id}
                invite={inv}
                onRevoke={revokeInvite}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleVisits.map((visit) => (
              <VisitCard
                key={visit.id}
                slug={slug}
                visit={visit}
                today={today}
                loading={loading === visit.id}
                onApprove={() => handleAction(visit.id, 'approve')}
                onDecline={() => setDeclineId(visit.id)}
              />
            ))}
          </div>
        )}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        used={limitPayload?.used}
        limit={limitPayload?.limit}
        returnPath={`/dashboard/${slug}/bookings`}
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

function EmptyState({
  tabHasAny,
  label,
}: {
  tabHasAny: boolean;
  label: string;
}) {
  return (
    <div className="rounded-2xl border bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
      {tabHasAny
        ? `No ${label} match your search.`
        : `Nothing here yet.`}
    </div>
  );
}

function CopyLinkButton({ token }: { token: string }) {
  function copy() {
    navigator.clipboard.writeText(getInviteUrl(token));
    toast.success('Guest link copied');
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Copy public guest link"
      title="Copy public guest link"
    >
      <Link2 className="h-3.5 w-3.5" />
      Copy link
    </button>
  );
}

/** Shared card chrome so every category looks identical. */
function CardShell({
  badge,
  token,
  name,
  email,
  href,
  children,
  footer,
}: {
  badge: StatusMeta;
  token: string | null;
  name: string;
  email: string | null;
  href?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
        <Badge variant={badge.variant} className="text-[11px]">
          {badge.label}
        </Badge>
        {token ? (
          <CopyLinkButton token={token} />
        ) : (
          <span className="text-[11px] text-muted-foreground">No link</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
            {initials(name)}
          </div>
          <div className="min-w-0">
            {href ? (
              <Link
                href={href}
                className="truncate font-semibold tracking-tight hover:underline"
              >
                {name}
              </Link>
            ) : (
              <p className="truncate font-semibold tracking-tight">{name}</p>
            )}
            <p className="truncate text-sm text-muted-foreground">
              {email ?? 'No email on file'}
            </p>
          </div>
        </div>

        {children}
      </div>

      {footer && (
        <div className="flex flex-wrap gap-2 border-t bg-muted/10 px-4 py-3">
          {footer}
        </div>
      )}
    </article>
  );
}

function DateBox({
  checkIn,
  checkOut,
  partySize,
}: {
  checkIn: string;
  checkOut: string;
  partySize: number;
}) {
  const nights = nightsBetween(checkIn, checkOut);
  return (
    <div className="mt-4 overflow-hidden rounded-xl border">
      <div className="grid grid-cols-2 divide-x">
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Check-in
          </p>
          <p className="mt-0.5 text-sm font-medium">{formatStayDate(checkIn)}</p>
        </div>
        <div className="p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Checkout
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {formatStayDate(checkOut)}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 border-t bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">
          {nights} {nights === 1 ? 'night' : 'nights'}
        </span>
        <span className="truncate">
          {partySize} {partySize === 1 ? 'guest' : 'guests'}
        </span>
      </div>
    </div>
  );
}

function VisitCard({
  slug,
  visit,
  today,
  loading,
  onApprove,
  onDecline,
}: {
  slug: string;
  visit: VisitItem;
  today: string;
  loading: boolean;
  onApprove: () => void;
  onDecline: () => void;
}) {
  const badge = visitStatusMeta(visit, today);
  const href = `/dashboard/${slug}/bookings/${visit.id}`;

  return (
    <CardShell
      badge={badge}
      token={visit.token}
      name={visit.guestName}
      email={visit.email}
      href={href}
      footer={
        visit.status === 'requested' ? (
          <>
            <Button size="sm" onClick={onApprove} disabled={loading}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onDecline}
              disabled={loading}
            >
              Decline
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link href={href}>Manage</Link>
            </Button>
          </>
        ) : undefined
      }
    >
      <DateBox
        checkIn={visit.checkIn}
        checkOut={visit.checkOut}
        partySize={visit.partySize}
      />
      {visit.rooms.length > 0 && (
        <div className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
          <BedDouble className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="line-clamp-2">{visit.rooms.join(', ')}</span>
        </div>
      )}
      {visit.notes && (
        <p className="mt-3 line-clamp-2 text-sm italic text-muted-foreground">
          &ldquo;{visit.notes}&rdquo;
        </p>
      )}
    </CardShell>
  );
}

function InviteCard({
  invite,
  onRevoke,
}: {
  invite: InviteItem;
  onRevoke: (id: string) => void;
}) {
  const badge = INVITE_STATUS_META[invite.status];
  const isDev = process.env.NODE_ENV !== 'production';

  function previewBooking() {
    window.open(
      `${getInviteUrl(invite.token)}?${guestPreviewQuery('booking')}`,
      '_blank'
    );
  }

  return (
    <CardShell
      badge={badge}
      token={invite.token}
      name={invite.guestName}
      email={invite.email}
      footer={
        <>
          {isDev && (
            <Button variant="ghost" size="sm" onClick={previewBooking}>
              <Eye className="mr-1 h-3 w-3" />
              Preview
            </Button>
          )}
          {invite.status !== 'revoked' && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => onRevoke(invite.id)}
            >
              Revoke
            </Button>
          )}
        </>
      }
    >
      <div className="mt-4 space-y-1.5 rounded-xl border bg-muted/10 p-3 text-sm">
        <div className="flex items-center gap-2 font-medium">
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          {INVITE_TYPE_LABEL[invite.type] ?? invite.type.replace('_', ' ')}
        </div>
        <p className="text-xs text-muted-foreground">
          {invite.expiresAt
            ? `Expires ${formatDate(invite.expiresAt)}`
            : 'No expiry'}
        </p>
      </div>
    </CardShell>
  );
}
