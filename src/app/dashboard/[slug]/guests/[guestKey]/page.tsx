import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { buildGuestRoster, findRosterEntry } from '@/lib/guest-roster';
import { parseGuestKey } from '@/lib/guest-keys';
import { getInvitationByToken, inviteUrl } from '@/lib/invitations';
import { GuestProfileView } from '@/components/dashboard/guest-profile-view';
import { InviteCreatedDialog } from '@/components/invite/invite-created-dialog';
import type { Invitation } from '@/types/database';

export const metadata = { title: 'Guest profile' };

export default async function GuestProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; guestKey: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { slug, guestKey } = await params;
  const { created } = await searchParams;
  if (!parseGuestKey(guestKey)) notFound();

  const property = await getDashboardProperty(slug);
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: invitations } = await supabase
    .from('invitations')
    .select('*')
    .eq('property_id', property.id);

  const { data: visits } = await supabase
    .from('visits')
    .select(
      `
      id, status, invitation_id, guest_name, guest_email, guest_phone, relationship, party_size, notes,
      guest:users!guest_user_id(name, email),
      dates:visit_dates(check_in, check_out),
      visit_rooms(room:rooms(name)),
      invitation:invitations(*)
    `
    )
    .eq('property_id', property.id)
    .order('created_at', { ascending: false });

  const roster = buildGuestRoster(
    (invitations ?? []) as Invitation[],
    visits ?? [],
    today
  );
  const guest = findRosterEntry(roster, guestKey);
  if (!guest) notFound();

  // A guest who is also a Gracious account may have uploaded an avatar.
  let avatarUrl: string | null = null;
  if (guest.email) {
    const { data: member } = await supabase
      .from('users')
      .select('avatar_url')
      .eq('email', guest.email)
      .maybeSingle();
    avatarUrl = member?.avatar_url ?? null;
  }

  // Just-created invitations land here with `?created=<token>` so the host can
  // grab the share link without ever seeing the guest-facing invite page.
  const createdInvitation =
    created && created === guest.invitation?.token
      ? await getInvitationByToken(created)
      : null;
  const showCreatedDialog =
    !!createdInvitation && createdInvitation.property_id === property.id;

  return (
    <>
      <GuestProfileView
        guest={guest}
        slug={slug}
        today={today}
        avatarUrl={avatarUrl}
      />
      {showCreatedDialog && createdInvitation && (
        <InviteCreatedDialog
          token={createdInvitation.token}
          initialUrl={inviteUrl(createdInvitation.token)}
          propertyName={property.name}
          guestEmail={createdInvitation.guest_email}
          guestName={
            [
              createdInvitation.guest_first_name,
              createdInvitation.guest_last_name,
            ]
              .filter(Boolean)
              .join(' ') || undefined
          }
          hasDates={createdInvitation.windows.length > 0}
        />
      )}
    </>
  );
}
