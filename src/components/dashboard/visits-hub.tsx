'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Check,
  Link2,
  Mail,
  MessageSquareText,
  Search,
  Share2,
  SlidersHorizontal,
  X,
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { format, parseISO } from 'date-fns';
import { getInviteUrl } from '@/lib/invite-url';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { isLimitReachedResponse } from '@/lib/billing-client';
import { UpgradeDialog } from '@/components/dashboard/upgrade-dialog';
import type { VisitStatus, InvitationStatus } from '@/types/database';

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
  avatarUrl: string | null;
  relationship: string | null;
  status: VisitStatus;
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
  avatarUrl: string | null;
  relationship: string | null;
  status: InvitationStatus;
  type: string;
  token: string;
  expiresAt: string | null;
  /** Offered/fixed date ranges, sorted by start. Empty for open invitations. */
  windows: { start: string; end: string }[];
}

interface VisitsHubProps {
  slug: string;
  today: string;
  initialTab: VisitTab;
  visits: VisitItem[];
  invites: InviteItem[];
  propertyName?: string | null;
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
  invited: 'Awaiting reply',
  requested: 'Dates requested',
  upcoming: 'Scheduled',
  past: 'Past visits',
  cancelled: 'Inactive',
};

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

/** The state word + accent color used in the "[Name]'s [state] visit" title. */
function visitStateMeta(
  visit: VisitItem,
  today: string
): { word: string; className: string } {
  switch (visit.status) {
    case 'requested':
      return { word: 'requested', className: 'text-amber-600 dark:text-amber-500' };
    case 'declined':
      return { word: 'declined', className: 'text-destructive' };
    case 'cancelled':
      return { word: 'cancelled', className: 'text-destructive' };
    case 'approved':
    default:
      if (visit.checkOut < today)
        return { word: 'past', className: 'text-muted-foreground' };
      if (visit.checkIn <= today && visit.checkOut >= today)
        return { word: 'current', className: 'text-emerald-600 dark:text-emerald-500' };
      return { word: 'scheduled', className: 'text-emerald-600 dark:text-emerald-500' };
  }
}

/** State word + accent color for the "[Name]'s [state] invitation" title. */
function inviteStateMeta(status: InvitationStatus): {
  word: string;
  className: string;
} {
  switch (status) {
    case 'pending':
      return { word: 'pending', className: 'text-amber-600 dark:text-amber-500' };
    case 'accepted':
      return {
        word: 'accepted',
        className: 'text-emerald-600 dark:text-emerald-500',
      };
    case 'expired':
      return { word: 'expired', className: 'text-muted-foreground' };
    case 'revoked':
    default:
      return { word: 'cancelled', className: 'text-destructive' };
  }
}

const INVITE_STATUS_META: Record<InvitationStatus, StatusMeta> = {
  pending: { label: 'Invited', variant: 'outline' },
  accepted: { label: 'Accepted', variant: 'default' },
  expired: { label: 'Expired', variant: 'secondary' },
  revoked: { label: 'Revoked', variant: 'destructive' },
};

function formatVisitDate(date: string): string {
  return format(parseISO(date), 'EEE, MMM d');
}

export function VisitsHub({
  slug,
  today,
  initialTab,
  visits,
  invites,
  propertyName,
}: VisitsHubProps) {
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
      // "Inactive" collects everything terminal: cancelled/declined visits plus
      // expired/revoked invitations (invites that never became a visit).
      cancelled:
        visits.filter(
          (v) => v.status === 'cancelled' || v.status === 'declined'
        ).length +
        invites.filter(
          (i) => i.status === 'expired' || i.status === 'revoked'
        ).length,
      // Only invitations the guest hasn't acted on yet. Accepted invites become
      // visits (shown in the other tabs).
      invited: invites.filter((i) => i.status === 'pending').length,
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

  const visibleInvites = useMemo(() => {
    const forTab = (i: InviteItem) => {
      if (tab === 'invited') return i.status === 'pending';
      if (tab === 'cancelled')
        return i.status === 'expired' || i.status === 'revoked';
      return false;
    };
    return invites.filter(
      (i) => forTab(i) && matchesQuery(query, i.guestName, i.email)
    );
  }, [tab, invites, query]);

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
    visitId: string,
    action: 'approve' | 'decline' | 'cancel',
    message?: string
  ) {
    setLoading(visitId);
    const res = await fetch(`/api/visits/${visitId}`, {
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

    toast.success(
      action === 'approve'
        ? 'Visit approved'
        : action === 'cancel'
          ? 'Visit cancelled'
          : 'Visit declined'
    );
    router.refresh();
  }

  const isEmpty = visibleVisits.length === 0 && visibleInvites.length === 0;
  const tabHasAny = counts[tab] > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
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

          <div className="relative w-full sm:max-w-xs">
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
                onCancel={() => handleAction(visit.id, 'cancel')}
              />
            ))}
            {visibleInvites.map((inv) => (
              <InviteCard
                key={inv.id}
                invite={inv}
                propertyName={propertyName}
              />
            ))}
          </div>
        )}

      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        used={limitPayload?.used}
        limit={limitPayload?.limit}
        returnPath={`/dashboard/${slug}/visits`}
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

/**
 * Primary CTA that opens the OS share sheet (macOS/iOS/Android share, Windows
 * share dialog) via the Web Share API, falling back to copy-to-clipboard on
 * browsers that don't support it (e.g. desktop Firefox).
 */
function ShareLinkButton({
  token,
  guestName,
  propertyName,
  className,
}: {
  token: string;
  guestName?: string | null;
  propertyName?: string | null;
  className?: string;
}) {
  async function share() {
    const url = getInviteUrl(token);
    const greeting = guestName ? `Hi ${guestName.split(/\s+/)[0]}, ` : '';
    const text = propertyName
      ? `${greeting}you're invited to stay at ${propertyName}. Tap to plan your visit.`
      : `${greeting}you're invited. Tap to plan your visit.`;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'Your invitation', text, url });
        return;
      } catch (err) {
        // Swallow user-cancelled shares; fall back to copy on real failures.
        if ((err as Error)?.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not share or copy the link');
    }
  }
  return (
    <Button
      onClick={share}
      size="sm"
      className={cn('h-9 w-full shadow-sm', className)}
    >
      <Share2 />
      Share via link
    </Button>
  );
}

/** Shared card chrome so every category looks identical. */
function CardShell({
  badge,
  token,
  name,
  email,
  avatarUrl,
  href,
  headerActions,
  cardLabel,
  bare = false,
  children,
  actionBar,
  actionBarTransparent = false,
  bottomBleed,
  footer,
}: {
  badge: StatusMeta;
  token: string | null;
  name: string;
  email: string | null;
  avatarUrl?: string | null;
  /** When set, the entire card becomes a link to this destination. */
  href?: string;
  /** Top-right action cluster; replaces the copy-link slot when provided. */
  headerActions?: React.ReactNode;
  /** Accessible label for the whole-card link (e.g. "View Jordan's visit"). */
  cardLabel?: string;
  /**
   * Skip the built-in status-strip header and avatar/name/email block so the
   * card can compose its own top content via `children`.
   */
  bare?: boolean;
  children: React.ReactNode;
  /** Full-width action band (divider above the bottom strip). */
  actionBar?: React.ReactNode;
  /**
   * Let clicks in the action band's empty space (padding/gaps) fall through to
   * the whole-card link. Interactive controls inside must opt back in with
   * `pointer-events-auto`.
   */
  actionBarTransparent?: boolean;
  /** Edge-to-edge section pinned to the bottom of the card (no inner padding). */
  bottomBleed?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-150',
        href && 'hover:border-foreground/20 hover:shadow-md'
      )}
    >
      {/* Stretched link: makes the whole card clickable while leaving the
          z-10 controls (actions, copy link) independently interactive. */}
      {href && (
        <Link
          href={href}
          className="absolute inset-0 z-0 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        >
          <span className="sr-only">{cardLabel ?? `View ${name}`}</span>
        </Link>
      )}

      {!bare && (
        <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2.5">
          <Badge variant={badge.variant} className="text-[11px]">
            {badge.label}
          </Badge>
          {headerActions ? (
            <div className="relative z-10 flex items-center gap-1.5">
              {headerActions}
            </div>
          ) : href ? null : token ? (
            <div className="relative z-10">
              <CopyLinkButton token={token} />
            </div>
          ) : (
            <span className="text-[11px] text-muted-foreground">No link</span>
          )}
        </div>
      )}

      <div className="flex flex-1 flex-col p-4">
        {!bare && (
          <div className="flex items-center gap-3">
            <PersonAvatar
              name={name}
              imageUrl={avatarUrl}
              seed={email}
              size="md"
            />
            <div className="min-w-0">
              <p
                className={cn(
                  'truncate font-semibold tracking-tight',
                  href && 'group-hover:underline'
                )}
              >
                {name}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {email ?? 'No email on file'}
              </p>
            </div>
          </div>
        )}

        {children}
      </div>

      {actionBar && (
        <div
          className={cn(
            'relative z-10 flex flex-wrap items-center gap-2 border-t px-4 py-3',
            actionBarTransparent && 'pointer-events-none'
          )}
        >
          {actionBar}
        </div>
      )}

      {bottomBleed}

      {footer && (
        <div className="relative z-10 flex flex-wrap gap-2 border-t bg-muted/10 px-4 py-3">
          {footer}
        </div>
      )}
    </article>
  );
}

function DateBox({
  checkIn,
  checkOut,
}: {
  checkIn: string;
  checkOut: string;
}) {
  return (
    <div className="border-t">
      <div className="grid grid-cols-2 divide-x">
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Check-in
          </p>
          <p className="mt-0.5 text-sm font-medium">{formatVisitDate(checkIn)}</p>
        </div>
        <div className="px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Checkout
          </p>
          <p className="mt-0.5 text-sm font-medium">
            {formatVisitDate(checkOut)}
          </p>
        </div>
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
  onCancel,
}: {
  slug: string;
  visit: VisitItem;
  today: string;
  loading: boolean;
  onApprove: () => void;
  onDecline: () => void;
  onCancel: () => void;
}) {
  const badge = visitStatusMeta(visit, today);
  const href = `/dashboard/${slug}/visits/${visit.id}`;
  const firstName = visit.guestName.split(/\s+/)[0] || visit.guestName;
  const state = visitStateMeta(visit, today);
  const canCancel = visit.status === 'approved' && visit.checkOut >= today;

  const actions =
    visit.status === 'requested' ? (
      <>
        <Button
          size="sm"
          className="h-9 flex-1 bg-emerald-600 text-white shadow-sm hover:bg-emerald-700"
          onClick={onApprove}
          disabled={loading}
        >
          <Check />
          Approve visit
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="h-9 w-9 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDecline}
          disabled={loading}
          aria-label="Decline visit"
          title="Decline visit"
        >
          <X />
        </Button>
      </>
    ) : canCancel ? (
      <>
        <Button asChild size="sm" className="h-9 flex-1 shadow-sm">
          <Link href={href}>
            <SlidersHorizontal />
            View visit
          </Link>
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={loading}
              aria-label="Cancel visit"
              title="Cancel visit"
            >
              <X />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this visit?</AlertDialogTitle>
            <AlertDialogDescription>
              {firstName}&apos;s visit will be cancelled and they&apos;ll be
              notified. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep visit</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={onCancel}
            >
              Cancel visit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
        </AlertDialog>
      </>
    ) : null;

  return (
    <CardShell
      badge={badge}
      token={visit.token}
      name={visit.guestName}
      email={visit.email}
      avatarUrl={visit.avatarUrl}
      href={href}
      cardLabel={`View ${firstName}'s visit`}
      bare
      actionBar={actions}
      bottomBleed={
        <DateBox checkIn={visit.checkIn} checkOut={visit.checkOut} />
      }
    >
      <div className="flex items-center gap-3">
        <PersonAvatar
          name={visit.guestName}
          imageUrl={visit.avatarUrl}
          seed={visit.email}
          size="md"
        />
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight group-hover:underline">
            {firstName}&apos;s{' '}
            <span className={state.className}>{state.word}</span> visit
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {visit.relationship ?? visit.email ?? 'No email on file'}
          </p>
        </div>
      </div>

    </CardShell>
  );
}

function InviteCard({
  invite,
  propertyName,
}: {
  invite: InviteItem;
  propertyName?: string | null;
}) {
  const badge = INVITE_STATUS_META[invite.status];
  const state = inviteStateMeta(invite.status);
  // guestName falls back to the email when there's no real name on the invite;
  // in that case skip the possessive since the email shows right below.
  const hasName = invite.guestName !== invite.email;
  const firstName = invite.guestName.split(/\s+/)[0] || invite.guestName;
  // Clicking the card opens the actual guest invite page (what the guest sees),
  // not the host's internal profile view.
  const href = getInviteUrl(invite.token);
  // Sharing only makes sense while the invite is live; expired/revoked invites
  // (shown in the Inactive tab) render read-only.
  const isActionable = invite.status === 'pending';

  const inviteLink = getInviteUrl(invite.token);
  const greetingName = hasName ? firstName : 'there';
  const shareBody = propertyName
    ? `Hi ${greetingName}, you're invited to stay at ${propertyName}. View the details and pick your dates here: ${inviteLink}`
    : `Hi ${greetingName}, you're invited. View the details and pick your dates here: ${inviteLink}`;
  const smsHref = `sms:?&body=${encodeURIComponent(shareBody)}`;
  const mailHref = `mailto:${encodeURIComponent(invite.email)}?subject=${encodeURIComponent(
    propertyName ? `You're invited to stay at ${propertyName}` : `You're invited`
  )}&body=${encodeURIComponent(shareBody)}`;

  const actions = (
    <div className="flex w-full flex-col gap-2">
      <ShareLinkButton
        token={invite.token}
        guestName={hasName ? invite.guestName : undefined}
        propertyName={propertyName}
        className="pointer-events-auto"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-9 pointer-events-auto"
        >
          <a href={mailHref}>
            <Mail />
            Share via email
          </a>
        </Button>
        <Button
          asChild
          variant="outline"
          size="sm"
          className="h-9 pointer-events-auto"
        >
          <a href={smsHref}>
            <MessageSquareText />
            Share via text
          </a>
        </Button>
      </div>
    </div>
  );

  return (
    <CardShell
      badge={badge}
      token={invite.token}
      name={invite.guestName}
      email={invite.email}
      avatarUrl={invite.avatarUrl}
      href={href}
      cardLabel={`View ${firstName}'s invitation`}
      bare
      actionBar={isActionable ? actions : undefined}
      actionBarTransparent
      bottomBleed={
        invite.windows.length > 0 ? (
          <DateBox
            checkIn={invite.windows[0].start}
            checkOut={invite.windows[0].end}
          />
        ) : (
          <div className="border-t px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Dates
            </p>
            <p className="mt-0.5 text-sm font-medium">Open — guest picks dates</p>
          </div>
        )
      }
    >
      <div className="flex items-center gap-3">
        <PersonAvatar
          name={invite.guestName}
          imageUrl={invite.avatarUrl}
          seed={invite.email}
          size="md"
        />
        <div className="min-w-0">
          <p className="truncate font-semibold tracking-tight group-hover:underline">
            {hasName && <>{firstName}&apos;s </>}
            <span className={cn(state.className, !hasName && 'capitalize')}>
              {state.word}
            </span>{' '}
            invitation
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {invite.relationship ?? invite.email ?? 'No email on file'}
          </p>
        </div>
      </div>
    </CardShell>
  );
}
