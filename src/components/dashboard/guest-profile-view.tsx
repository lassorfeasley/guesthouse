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
import { VisitSummaryList } from '@/components/visit-summary-list';
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
  const stay = guest.upcomingVisit;
  if (stay) {
    if (stay.checkIn <= today && stay.checkOut >= today) {
      return { label: 'On property', variant: 'default' };
    }
    return { label: 'Upcoming visit', variant: 'default' };
  }
  if (guest.invitation?.status === 'pending') {
    return { label: 'Invited', variant: 'secondary' };
  }
  if (guest.pastVisitsCount > 0) {
    return { label: 'Past guest', variant: 'outline' };
  }
  return { label: 'No visits yet', variant: 'outline' };
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
    guest.upcomingVisit?.isManual ? guest.upcomingVisit.visitId : null;

  const pastVisits = guest.visits.filter(
    (s) => s.visitId !== guest.upcomingVisit?.visitId
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
            ? 'Manual visit — no contact info on file'
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
          />
        }
      />

      {guest.visits.length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          <span>
            <span className="font-medium text-foreground">
              {guest.visits.length}
            </span>{' '}
            <span className="text-muted-foreground">
              {guest.visits.length === 1 ? 'visit' : 'visits'} total
            </span>
          </span>
          {guest.pastVisitsCount > 0 && (
            <span>
              <span className="font-medium text-foreground">
                {guest.pastVisitsCount}
              </span>{' '}
              <span className="text-muted-foreground">past</span>
            </span>
          )}
        </div>
      )}

      {guest.upcomingVisit && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Upcoming visit
          </h2>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="border-b bg-muted/30 px-6 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={
                    statusVariant[guest.upcomingVisit.status] ?? 'outline'
                  }
                >
                  {guest.upcomingVisit.status}
                </Badge>
                {guest.upcomingVisit.isManual && (
                  <Badge variant="secondary">Manual visit</Badge>
                )}
              </div>
            </div>
            <div className="space-y-5 p-6">
              <VisitSummaryList
                checkIn={guest.upcomingVisit.checkIn}
                checkOut={guest.upcomingVisit.checkOut}
                roomNames={guest.upcomingVisit.roomNames}
                partySize={guest.upcomingVisit.partySize}
              />
              {guest.upcomingVisit.notes && (
                <blockquote className="border-l-2 border-muted-foreground/30 pl-4 text-sm italic text-muted-foreground">
                  &ldquo;{guest.upcomingVisit.notes}&rdquo;
                </blockquote>
              )}
              <Button asChild>
                <Link
                  href={`/dashboard/${slug}/visits/${guest.upcomingVisit.visitId}`}
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
          <h2 className="text-lg font-semibold tracking-tight">Visit history</h2>
          {pastVisits.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {pastVisits.length} {pastVisits.length === 1 ? 'visit' : 'visits'}
            </p>
          )}
        </div>

        {pastVisits.length === 0 ? (
          <div className="rounded-2xl border bg-muted/20 px-6 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {guest.invitation?.status === 'pending'
                ? 'No visits yet — waiting for them to request a visit.'
                : 'No past visits on record.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {pastVisits.map((stay) => (
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
