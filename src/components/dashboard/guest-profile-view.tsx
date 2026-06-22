import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  ChevronRight,
  Send,
} from 'lucide-react';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import { formatDate, formatDateRange } from '@/lib/dates';
import { INVITATION_TYPE_LABELS } from '@/lib/invitation-types';
import { StaySummaryList } from '@/components/stay-summary-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PersonCard } from '@/components/person-card';
import { GuestProfileActions } from '@/components/dashboard/guest-profile-actions';
import type { GuestRosterEntry } from '@/lib/guest-roster';

const statusVariant: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  pending: 'secondary',
  accepted: 'default',
  expired: 'outline',
  revoked: 'destructive',
  approved: 'default',
  requested: 'secondary',
  declined: 'destructive',
  cancelled: 'outline',
};

function guestHeadline(
  guest: GuestRosterEntry,
  today: string
): { label: string; variant: 'default' | 'secondary' | 'outline' } {
  const stay = guest.upcomingStay;
  if (stay) {
    if (stay.checkIn <= today && stay.checkOut >= today) {
      return { label: 'On property', variant: 'default' };
    }
    return { label: 'Upcoming stay', variant: 'default' };
  }
  if (guest.invitation?.status === 'pending') {
    return { label: 'Invited', variant: 'secondary' };
  }
  if (guest.pastStaysCount > 0) {
    return { label: 'Past guest', variant: 'outline' };
  }
  return { label: 'No stays yet', variant: 'outline' };
}

export function GuestProfileView({
  guest,
  slug,
  today,
  avatarUrl,
}: {
  guest: GuestRosterEntry;
  slug: string;
  today: string;
  avatarUrl?: string | null;
}) {
  const headline = guestHeadline(guest, today);
  const upcomingManualId =
    guest.upcomingStay?.isManual ? guest.upcomingStay.visitId : null;

  const pastStays = guest.stays.filter(
    (s) => s.visitId !== guest.upcomingStay?.visitId
  );

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href={`/dashboard/${slug}/visits`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Visits
      </Link>

      <PersonCard
        name={guest.name}
        imageUrl={avatarUrl}
        seed={guest.email}
        role={
          guest.relationship ??
          (!guest.email && !guest.phone
            ? 'Manual stay — no contact info on file'
            : null)
        }
        email={guest.email}
        phone={guest.phone}
        badges={<Badge variant={headline.variant}>{headline.label}</Badge>}
        actions={
          <GuestProfileActions
            invitationToken={guest.invitation?.token}
            invitationId={guest.invitation?.id}
            invitationStatus={guest.invitation?.status}
            manualVisitId={upcomingManualId}
            invitePageHref={
              guest.invitation?.token
                ? `/invite/${guest.invitation.token}`
                : undefined
            }
          />
        }
      />

      {guest.stays.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            <span className="font-medium text-foreground">
              {guest.stays.length}
            </span>{' '}
            <span className="text-muted-foreground">
              {guest.stays.length === 1 ? 'stay' : 'stays'} total
            </span>
          </span>
          {guest.pastStaysCount > 0 && (
            <span>
              <span className="font-medium text-foreground">
                {guest.pastStaysCount}
              </span>{' '}
              <span className="text-muted-foreground">past</span>
            </span>
          )}
        </div>
      )}

      {guest.upcomingStay && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Upcoming stay
          </h2>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b bg-muted/30 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    statusVariant[guest.upcomingStay.status] ?? 'outline'
                  }
                >
                  {guest.upcomingStay.status}
                </Badge>
                {guest.upcomingStay.isManual && (
                  <Badge variant="secondary">Manual stay</Badge>
                )}
              </div>
            </div>
            <div className="space-y-5 p-6">
              <StaySummaryList
                checkIn={guest.upcomingStay.checkIn}
                checkOut={guest.upcomingStay.checkOut}
                roomNames={guest.upcomingStay.roomNames}
                partySize={guest.upcomingStay.partySize}
              />
              {guest.upcomingStay.notes && (
                <blockquote className="border-l-2 border-muted-foreground/30 pl-4 text-sm italic text-muted-foreground">
                  &ldquo;{guest.upcomingStay.notes}&rdquo;
                </blockquote>
              )}
              <Button asChild>
                <Link
                  href={`/dashboard/${slug}/visits/${guest.upcomingStay.visitId}`}
                >
                  Manage visit
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {guest.invitation && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">Invitation</h2>
          <div className="rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Send className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={
                      statusVariant[guest.invitation.status] ?? 'outline'
                    }
                  >
                    {guest.invitation.status}
                  </Badge>
                  <Badge variant="outline">
                    {INVITATION_TYPE_LABELS[guest.invitation.type] ??
                      guest.invitation.type}
                  </Badge>
                  <Badge variant="outline">
                    {guest.invitation.requiresApproval
                      ? 'Approval required'
                      : 'Auto-confirm'}
                  </Badge>
                </div>
                {guest.invitation.message && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {guest.invitation.message}
                  </p>
                )}
                {guest.invitation.expiresAt && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    Expires {formatDate(guest.invitation.expiresAt)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Stay history</h2>
          {pastStays.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {pastStays.length} {pastStays.length === 1 ? 'stay' : 'stays'}
            </p>
          )}
        </div>

        {pastStays.length === 0 ? (
          <div className="rounded-2xl border bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {guest.invitation?.status === 'pending'
                ? 'No visits yet — waiting for them to request a visit.'
                : 'No past stays on record.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pastStays.map((stay) => (
              <li key={stay.visitId}>
                <Link
                  href={`/dashboard/${slug}/visits/${stay.visitId}`}
                  className="group flex items-center justify-between gap-4 rounded-2xl border bg-card p-5 shadow-sm transition-colors hover:border-foreground/20 hover:bg-muted/30"
                >
                  <div className="min-w-0 space-y-2">
                    <p className="font-medium">
                      {formatDateRange(stay.checkIn, stay.checkOut)}
                      <span className="ml-1 font-normal text-muted-foreground">
                        ·{' '}
                        {differenceInCalendarDays(
                          parseISO(stay.checkOut),
                          parseISO(stay.checkIn)
                        )}{' '}
                        nights
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant[stay.status] ?? 'outline'}>
                        {stay.status}
                      </Badge>
                      {stay.isManual && (
                        <Badge variant="secondary">Manual</Badge>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {stay.partySize}{' '}
                        {stay.partySize === 1 ? 'guest' : 'guests'}
                        {stay.roomNames.length > 0 &&
                          ` · ${stay.roomNames.join(', ')}`}
                      </span>
                    </div>
                    {stay.notes && (
                      <p className="truncate text-sm italic text-muted-foreground">
                        {stay.notes}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
