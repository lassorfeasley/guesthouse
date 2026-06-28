import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import {
  getInvitationByToken,
  inviteUrl,
  isInvitationActive,
} from '@/lib/invitations';
import {
  canManageProperty,
  getAuthUser,
  getCurrentUser,
  getOwnerProperties,
} from '@/lib/auth';
import { isSiteAdmin } from '@/lib/site-admin';
import { DashboardTopNav } from '@/components/dashboard/top-nav';
import {
  getGuestVisitForInvitation,
  getVisitForInvitation,
} from '@/lib/visits';
import { HostVisitSidebar } from '@/components/guest/host-visit-sidebar';
import { createAdminClient } from '@/lib/supabase/admin';
import { assignColors } from '@/lib/calendar-colors';
import { summarizeBeds } from '@/lib/validations';
import { SectionNav } from '@/components/dashboard/section-nav';
import { SiteFooter } from '@/components/site-footer';
import { VisitProvider } from '@/components/guest/visit-context';
import { SelectableRoomCalendar } from '@/components/guest/selectable-room-calendar';
import { VisitSidebar } from '@/components/guest/visit-sidebar';
import { MobileDockedCard } from '@/components/mobile-docked-card';
import { guestVisitCtaLabel } from '@/lib/invitation-visit';
import { PhotoMosaic } from '@/components/photo-gallery';
import { PlaceholderImage } from '@/components/placeholder-image';
import {
  RoomHero,
  RoomAboutSection,
  RoomBedsSection,
  RoomAmenitiesSection,
  RoomBreadcrumb,
  ReturnToHouseCard,
} from '@/components/room-profile';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string; roomId: string }>;
}): Promise<Metadata> {
  const { token, roomId } = await params;
  const invitation = await getInvitationByToken(token);
  const room = invitation?.rooms.find((r) => r.id === roomId);
  if (!invitation || !room) return { title: 'Invitation not found' };

  const title = `${room.name} · ${invitation.property.name}`;
  const description = `Up to ${room.max_occupancy} guests · ${summarizeBeds(room.beds)}`;

  return {
    title,
    description,
    openGraph: { siteName: 'Gracious', type: 'website', title, description },
  };
}

export default async function GuestRoomPage({
  params,
}: {
  params: Promise<{ token: string; roomId: string }>;
}) {
  const { token, roomId } = await params;
  const invitation = await getInvitationByToken(token);
  if (!invitation) notFound();

  const room = invitation.rooms.find((r) => r.id === roomId);
  if (!room) notFound();

  const active = isInvitationActive(invitation);
  const authUser = await getAuthUser();
  const isAuthenticated =
    !!authUser && authUser.email === invitation.guest_email;
  const property = invitation.property;

  // A host viewing this room link gets their own view, with host controls.
  const isHost = authUser
    ? await canManageProperty(invitation.property_id, authUser.id)
    : false;

  let hostNav: ReactNode = null;
  if (isHost && authUser) {
    const [hostProperties, currentUser] = await Promise.all([
      getOwnerProperties(authUser.id),
      getCurrentUser(),
    ]);
    const hostCurrentProperty = hostProperties.find(
      (p) => p.id === invitation.property_id
    );
    if (hostCurrentProperty) {
      hostNav = (
        <DashboardTopNav
          properties={hostProperties}
          currentProperty={hostCurrentProperty}
          userEmail={authUser.email ?? undefined}
          userId={authUser.id}
          showAdminLink={currentUser ? isSiteAdmin(currentUser) : false}
        />
      );
    }
  }

  const houseHref = `/invite/${invitation.token}`;

  const existingVisit =
    isAuthenticated && authUser
      ? await getGuestVisitForInvitation(invitation.id, authUser.id)
      : null;
  const hostVisit = isHost ? await getVisitForInvitation(invitation.id) : null;

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

  const admin = createAdminClient();
  const { data: visitRows } = await admin
    .from('visit_rooms')
    .select(
      `visit:visits(id, status, dates:visit_dates(check_in, check_out))`
    )
    .eq('room_id', roomId);

  const roomVisits = assignColors(
    (visitRows ?? [])
      .map((row) => (Array.isArray(row.visit) ? row.visit[0] : row.visit))
      .filter(
        (b): b is NonNullable<typeof b> =>
          !!b && (b.status === 'approved' || b.status === 'requested')
      )
      .map((b) => {
        const dates = Array.isArray(b.dates) ? b.dates[0] : b.dates;
        return {
          id: b.id,
          guestName: 'Booked',
          checkIn: dates?.check_in ?? '',
          checkOut: dates?.check_out ?? '',
        };
      })
      .filter((b) => b.checkIn && b.checkOut)
  );

  const { data: blocks } = await admin
    .from('room_availability')
    .select('*')
    .eq('room_id', roomId)
    .eq('is_blocked', true);

  const showSidebar = isHost || active || !!existingVisit;
  const isManageVisit = !isHost && !!existingVisit;
  const dock = isHost
    ? {
        ctaLabel: 'Share invitation',
        idleTitle: 'Share invitation',
        idleSubtitle: property.name,
        trackDates: false,
      }
    : isManageVisit
      ? {
          ctaLabel: 'View visit',
          idleTitle: 'Your visit',
          idleSubtitle: property.name,
          trackDates: false,
        }
      : !isAuthenticated
        ? {
            ctaLabel: 'Sign in',
            idleTitle: 'Sign in to request a visit',
            idleSubtitle: 'Magic link to your invited email',
            trackDates: false,
          }
        : invitation.whole_home
          ? {
              ctaLabel: 'Book home',
              idleTitle: 'Booked as a whole home',
              idleSubtitle: 'Reserve the entire place',
              trackDates: false,
            }
          : {
              ctaLabel: guestVisitCtaLabel(invitation),
              idleTitle: 'Add your dates',
              idleSubtitle: isPrixFixe
                ? 'Fixed-date visit'
                : 'Choose when you’ll arrive',
              trackDates: true,
            };
  const visitSidebar = isHost ? (
    <HostVisitSidebar
      slug={property.slug}
      inviteUrl={inviteUrl(invitation.token)}
      invitationId={invitation.id}
      invitationStatus={invitation.status}
      propertyName={property.name}
      guestName={
        [invitation.guest_first_name, invitation.guest_last_name]
          .filter(Boolean)
          .join(' ') || null
      }
      guestEmail={invitation.guest_email}
      windows={invitation.windows.map((w) => ({
        start: w.start_date,
        end: w.end_date,
      }))}
      roomNames={invitation.rooms.map((r) => r.name)}
      visit={
        hostVisit
          ? {
              id: hostVisit.id,
              status: hostVisit.status,
              checkIn: hostVisit.checkIn,
              checkOut: hostVisit.checkOut,
            }
          : null
      }
    />
  ) : (
    <VisitSidebar
      invitation={invitation}
      propertyName={property.name}
      room={room}
      isAuthenticated={isAuthenticated}
      existingVisit={existingVisit}
      isPrixFixe={isPrixFixe}
      maxGuests={room.max_occupancy}
      visits={roomVisits}
      blocks={blocks ?? []}
      allowedRanges={allowedRanges}
      wholeHome={invitation.whole_home}
      houseHref={houseHref}
    />
  );

  const navSections = [
    ...(room.description ? [{ id: 'about', label: 'About' }] : []),
    ...(room.beds.length > 0 ? [{ id: 'sleeping', label: 'Beds' }] : []),
    ...(room.amenities && room.amenities.length > 0
      ? [{ id: 'amenities', label: 'Amenities' }]
      : []),
    { id: 'availability', label: 'Availability' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {hostNav}
      {/* Breadcrumb */}
      <div className="border-b">
        <RoomBreadcrumb
          houseHref={houseHref}
          houseName={property.name}
          roomName={room.name}
          className="mx-auto w-full max-w-6xl px-6 py-3"
        />
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 pt-6 pb-24">
        <VisitProvider
          defaultRange={defaultRange}
          defaultGuests={1}
          maxGuestsCap={room.max_occupancy}
        >
          <div className="grid gap-x-12 gap-y-12 lg:grid-cols-[1fr_360px]">
            {/* Left column */}
            <div className="min-w-0">
              {/* Title + hero banner */}
              <PhotoMosaic
                photos={room.room_images ?? []}
                emptyState={
                  <PlaceholderImage
                    type="room"
                    name={room.name}
                    seed={room.id}
                    className="absolute inset-0"
                    iconClassName="h-14 w-14"
                  />
                }
              />

              <RoomHero room={room} className="mt-6" />

              <ReturnToHouseCard
                href={houseHref}
                houseName={property.name}
                houseId={property.id}
                houseImageUrl={property.hero_image_url}
                label="Back to house"
                className="mt-6"
              />

              <SectionNav
                sections={navSections}
                className="top-0 mt-2"
                scrollOffset={100}
              />

              <div className="mt-2 divide-y">
              <RoomAboutSection room={room} />
              <RoomBedsSection room={room} />
              <RoomAmenitiesSection room={room} />

              <section
                id="availability"
                className="scroll-mt-24 py-10 first:pt-0"
              >
                  <h2 className="text-2xl font-semibold tracking-tight">
                    Availability
                  </h2>
                  <p className="mt-2 text-base text-muted-foreground">
                    {isPrixFixe
                      ? 'This is a fixed-date visit.'
                      : 'Select your dates — crossed-out days are unavailable.'}
                  </p>
                  <div className="mt-6">
                    <SelectableRoomCalendar
                      visits={roomVisits}
                      blocks={blocks ?? []}
                      allowedRanges={allowedRanges}
                    />
                  </div>
                </section>
              </div>
            </div>

            {/* Right column — visit sidebar (desktop only; mobile uses the
                persistent bottom bar below). */}
            <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
              {showSidebar ? (
                visitSidebar
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
              {visitSidebar}
            </MobileDockedCard>
          )}
        </VisitProvider>
      </div>

      <SiteFooter name={property.name} />
    </div>
  );
}
