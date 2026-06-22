import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getInvitationByToken,
  guestMatchesInvitation,
  invitationHostName,
  inviteUrl,
  isInvitationActive,
} from '@/lib/invitations';
import { getCoGuestsForInvitation } from '@/lib/coguests';
import { getGuestStayForInvitation } from '@/lib/visits';
import { canManageProperty, getAuthUser } from '@/lib/auth';
import { getInvitationRoomAvailability } from '@/lib/guest-availability';
import { formatDateRange, formatDate } from '@/lib/dates';
import { PropertySections } from '@/components/property-sections';
import { PropertyNotesDisplay } from '@/components/property-notes-display';
import { DirectionsDialog } from '@/components/directions-dialog';
import { SiteFooter } from '@/components/site-footer';
import { VisitProvider } from '@/components/guest/visit-context';
import { HouseCalendar } from '@/components/guest/house-calendar';
import { HouseVisitSidebar } from '@/components/guest/house-visit-sidebar';
import { MobileDockedCard } from '@/components/mobile-docked-card';
import {
  appendGuestPreviewToPath,
  isGuestPreviewEnabled,
  parseGuestPreviewAs,
  parseGuestPreviewVisitStatus,
  resolveGuestPreviewUi,
} from '@/lib/guest-preview';
import { guestVisitCtaLabel } from '@/lib/invitation-visit';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, CalendarCheck, CalendarRange, MapPin, Sparkles } from 'lucide-react';
import { InviteCreatedDialog } from '@/components/invite/invite-created-dialog';
import { RoomCard } from '@/components/room-card';
import { formatPersonName } from '@/lib/names';
import {
  INVITATION_TYPE_GUEST_DESCRIPTIONS,
  INVITATION_TYPE_HEADLINE_PHRASE,
  INVITATION_TYPE_LABELS,
} from '@/lib/invitation-types';
import { PhotoMosaic } from '@/components/photo-gallery';
import { PlaceholderImage } from '@/components/placeholder-image';
import { PersonCard } from '@/components/person-card';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);
  if (!invitation) return { title: 'Invitation not found' };

  const property = invitation.property;
  const title = `You're invited to ${property.name}`;
  const description = `${invitationHostName(invitation)} has invited you to stay at ${property.name}.`;

  return {
    title,
    description,
    openGraph: { siteName: 'Gracious', type: 'website', title, description },
  };
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{
    preview?: string;
    as?: string;
    status?: string;
    invited?: string;
  }>;
}) {
  const { token } = await params;
  const { preview, as, status, invited } = await searchParams;
  const invitation = await getInvitationByToken(token);

  if (!invitation) notFound();

  const previewMode = isGuestPreviewEnabled(preview);
  const guestPreviewAs = parseGuestPreviewAs(as);
  const guestPreviewVisitStatus = parseGuestPreviewVisitStatus(status);
  const showVisitRequestCalendar =
    !previewMode || guestPreviewAs !== 'confirmed';
  const active = isInvitationActive(invitation);
  const authUser = await getAuthUser();
  const isAuthenticated = guestMatchesInvitation(authUser, invitation);
  const isHost = authUser
    ? await canManageProperty(invitation.property_id, authUser.id)
    : false;
  const justCreated = isHost && invited === '1';

  const existingStay =
    isAuthenticated && authUser
      ? await getGuestStayForInvitation(invitation.id, authUser.id)
      : null;

  const coguests = await getCoGuestsForInvitation(
    invitation.property_id,
    invitation.windows,
    authUser?.id
  );

  const property = invitation.property;
  const roomIds = invitation.rooms.map((r) => r.id);
  const roomAvailability = await getInvitationRoomAvailability(roomIds);

  const isPrixFixe = invitation.type === 'prix_fixe';
  const fixedWindow = isPrixFixe ? invitation.windows[0] : undefined;
  const defaultRange = fixedWindow
    ? { checkIn: fixedWindow.start_date, checkOut: fixedWindow.end_date }
    : undefined;
  const allowedRanges =
    invitation.windows.length > 0
      ? invitation.windows.map((w) => ({
          start: w.start_date,
          end: w.end_date,
        }))
      : undefined;

  const requestableRooms = invitation.rooms.map((r) => ({
    id: r.id,
    name: r.name,
    max_occupancy: r.max_occupancy,
  }));

  const showSidebar = active || previewMode || !!existingStay;
  const previewUi = resolveGuestPreviewUi(
    previewMode,
    guestPreviewAs,
    isAuthenticated
  );
  const isManageStay =
    (!previewMode && !!existingStay) || previewUi.showManageStay;
  const dock = isManageStay
    ? {
        ctaLabel: 'View stay',
        idleTitle: 'Your stay',
        idleSubtitle: property.name,
        trackDates: false,
      }
    : previewUi.showSignIn
      ? {
          ctaLabel: 'Sign in',
          idleTitle: 'Sign in to request a visit',
          idleSubtitle: 'Magic link to your invited email',
          trackDates: false,
        }
      : {
          ctaLabel: guestVisitCtaLabel(invitation),
          idleTitle: 'Add your dates',
          idleSubtitle: isPrixFixe
            ? 'Fixed-date stay'
            : 'Choose when you’ll arrive',
          trackDates: true,
        };
  const houseVisitSidebar = (
    <HouseVisitSidebar
      invitation={invitation}
      propertyName={property.name}
      isAuthenticated={isAuthenticated}
      existingStay={existingStay}
      previewMode={previewMode}
      guestPreviewAs={guestPreviewAs}
      guestPreviewVisitStatus={guestPreviewVisitStatus}
      isPrixFixe={isPrixFixe}
      allowedRanges={allowedRanges}
    />
  );

  const typeLabel = INVITATION_TYPE_LABELS[invitation.type];
  const typeDescription =
    INVITATION_TYPE_GUEST_DESCRIPTIONS[invitation.type];

  const TypeIcon =
    invitation.type === 'standing'
      ? Sparkles
      : invitation.type === 'date_offer'
        ? CalendarRange
        : CalendarCheck;

  const host = (
    property as unknown as {
      owner?: {
        first_name: string | null;
        last_name: string | null;
        email: string;
        avatar_url: string | null;
      } | null;
    }
  ).owner;
  const hostName = formatPersonName(host, 'Your host') ?? 'Your host';
  const inviteTypeWord = INVITATION_TYPE_HEADLINE_PHRASE[invitation.type];
  const inviteArticle = invitation.type === 'standing' ? 'an' : 'a';

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 sm:px-6">
        {/* Host-only: this is a guest-facing page, so give hosts a way back. */}
        {isHost && (
          <Link
            href={`/dashboard/${property.slug}/visits`}
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to visits
          </Link>
        )}

        {/* Invitation headline */}
        <h1 className="mb-8 max-w-4xl break-words text-3xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
          {hostName} has sent you {inviteArticle} {inviteTypeWord} invitation to
          stay at{' '}
          <span className="text-muted-foreground">{property.name}</span>.
        </h1>

        {/* Compact address + directions trigger */}
        {property.address && (
          <DirectionsDialog
            address={property.address}
            latitude={property.latitude}
            longitude={property.longitude}
          >
            <button className="group mb-3 flex w-full max-w-full min-w-0 items-center gap-1.5 text-left text-sm text-muted-foreground transition-colors hover:text-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{property.address}</span>
              <span className="shrink-0 font-medium text-foreground underline underline-offset-4">
                Get directions
              </span>
            </button>
          </DirectionsDialog>
        )}

        <PhotoMosaic
          photos={property.property_images ?? []}
          className="mb-6"
          emptyState={
            <PlaceholderImage
              type="home"
              name={property.name}
              seed={property.id}
              className="absolute inset-0"
              iconClassName="h-16 w-16"
            />
          }
        />

        <VisitProvider
          rooms={requestableRooms}
          roomAvailability={roomAvailability}
          defaultSelectedRoomIds={roomIds}
          lockRoomSelection={isPrixFixe || invitation.whole_home}
          defaultRange={defaultRange}
          defaultGuests={1}
        >
          <div className="mt-8 grid gap-x-12 gap-y-12 lg:grid-cols-[1fr_360px]">
            <div className="min-w-0">
              <PersonCard
                name={hostName}
                imageUrl={host?.avatar_url ?? null}
                seed={host?.email}
                role={`Your host at ${property.name}`}
                email={host?.email}
                size="md"
                className="mb-6"
              />

              {/* Invitation type */}
              <div className="flex flex-col gap-3 rounded-2xl border p-5 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex min-w-0 items-start gap-4 sm:items-center">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                    <TypeIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium">{typeLabel}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {typeDescription}
                    </p>
                  </div>
                </div>
                {invitation.expires_at && (
                  <Badge variant="outline" className="w-fit shrink-0 sm:ml-auto">
                    Expires {formatDate(invitation.expires_at)}
                  </Badge>
                )}
              </div>

              {!active && (
                <div className="mt-6 rounded-2xl border border-destructive/50 bg-destructive/10 p-5 text-center text-base">
                  This invitation is no longer active.
                </div>
              )}

              {invitation.message && (
                <blockquote className="mt-6 border-l-2 border-foreground/20 pl-5 text-lg italic leading-relaxed text-muted-foreground">
                  &ldquo;{invitation.message}&rdquo;
                </blockquote>
              )}

              <PropertyNotesDisplay
                notes={property.property_notes ?? []}
                categories={['house']}
                className="divide-y"
              />

              <div className="mt-2 divide-y">
              {/* Available dates */}
              <section className="py-10 first:pt-0">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Available dates
                </h2>
                {invitation.type !== 'standing' &&
                  (invitation.windows.length > 0 ? (
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                      {invitation.windows.map((w) => (
                        <li
                          key={w.id}
                          className="rounded-2xl border px-5 py-4 text-base font-medium"
                        >
                          {formatDateRange(w.start_date, w.end_date)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-base text-muted-foreground">
                      Contact your host for date details.
                    </p>
                  ))}

                {(active || previewMode) && showVisitRequestCalendar && (
                  <div className="mt-8">
                    <HouseCalendar
                      allowedRanges={allowedRanges}
                      monthsToShow={2}
                      disabled={isPrixFixe}
                    />
                  </div>
                )}
              </section>

              {/* Rooms available to you */}
              <section className="py-10">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Rooms available to you
                </h2>
                <div className="mt-8 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-2">
                  {invitation.rooms.map((room) => (
                    <Link
                      key={room.id}
                      href={
                        previewMode
                          ? appendGuestPreviewToPath(
                              `/invite/${invitation.token}/rooms/${room.id}`,
                              guestPreviewAs,
                              guestPreviewVisitStatus
                            )
                          : `/invite/${invitation.token}/rooms/${room.id}`
                      }
                      className="group block"
                    >
                      <RoomCard room={room} showDescription />
                    </Link>
                  ))}
                </div>
              </section>

              <PropertySections
                property={property}
                showWifi={existingStay?.status === 'approved'}
              />

              {/* Who's staying */}
              <section className="py-10">
                <h2 className="text-2xl font-semibold tracking-tight">
                  Who&apos;s staying
                </h2>
                {coguests.visible.length === 0 && !coguests.hasHidden ? (
                  <p className="mt-6 text-base text-muted-foreground">
                    No other confirmed guests during your dates yet.
                  </p>
                ) : (
                  <p className="mt-6 text-base">
                    {coguests.visible.map((g) => g.label).join(', ')}
                    {coguests.hasHidden &&
                      (coguests.visible.length > 0
                        ? ', and others'
                        : 'and others')}
                  </p>
                )}
              </section>
              </div>
            </div>

            <aside className="hidden lg:sticky lg:top-8 lg:block lg:self-start">
              {showSidebar ? (
                houseVisitSidebar
              ) : (
                <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
                  This invitation is no longer active.
                </div>
              )}
            </aside>
          </div>

          {showSidebar && (
            <MobileDockedCard
              ctaLabel={dock.ctaLabel}
              idleTitle={dock.idleTitle}
              idleSubtitle={dock.idleSubtitle}
              trackDates={dock.trackDates}
            >
              {houseVisitSidebar}
            </MobileDockedCard>
          )}
        </VisitProvider>
      </div>

      <SiteFooter name={property.name} />

      {justCreated && (
        <InviteCreatedDialog
          token={invitation.token}
          initialUrl={inviteUrl(invitation.token)}
          propertyName={property.name}
          guestEmail={invitation.guest_email}
          guestName={
            [invitation.guest_first_name, invitation.guest_last_name]
              .filter(Boolean)
              .join(' ') || undefined
          }
        />
      )}
    </div>
  );
}
