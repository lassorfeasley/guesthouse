import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { buildGuestRoster, findRosterEntry } from '@/lib/guest-roster';
import { parseGuestKey } from '@/lib/guest-keys';
import { GuestProfileView } from '@/components/dashboard/guest-profile-view';
import type { Invitation } from '@/types/database';

export const metadata = { title: 'Guest profile' };

export default async function GuestProfilePage({
  params,
}: {
  params: Promise<{ slug: string; guestKey: string }>;
}) {
  const { slug, guestKey } = await params;
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

  return (
    <GuestProfileView
      guest={guest}
      slug={slug}
      today={today}
      avatarUrl={avatarUrl}
    />
  );
}
