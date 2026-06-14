import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDevAdminPreviewEnabled } from '@/lib/dev-tools';
import { isSiteAdmin } from '@/lib/site-admin';
import type { User } from '@/types/database';

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getCurrentUser(): Promise<User | null> {
  const authUser = await getAuthUser();
  if (!authUser) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  if (data) {
    await linkOfflineBookingsToUser(authUser.id, authUser.email!);
    return data as User;
  }

  const admin = createAdminClient();
  const meta = authUser.user_metadata ?? {};
  const firstName =
    (meta.first_name as string | undefined) ??
    (meta.name as string | undefined) ??
    authUser.email!.split('@')[0];
  const { data: created } = await admin
    .from('users')
    .upsert({
      id: authUser.id,
      email: authUser.email!,
      first_name: firstName,
      last_name: (meta.last_name as string | undefined) ?? null,
    })
    .select()
    .single();

  await linkOfflineBookingsToUser(authUser.id, authUser.email!);

  return created as User | null;
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * True if the user can host: they own or co-manage at least one property.
 * Host status is derived from data, never stored, so it can't drift out of sync
 * (e.g. an owner who books a stay stays a host).
 */
/**
 * Default destination after sign-in or when visiting `/` while signed in.
 * Hosts land on the dashboard; platform admins without host duties land on
 * /admin; everyone else goes to my-trips.
 */
export async function getAuthenticatedHomePath(
  user: Pick<User, 'id' | 'is_admin' | 'email'>
): Promise<string> {
  if (await userManagesAnyProperty(user.id)) return '/dashboard';
  if (isSiteAdmin(user)) return '/admin';
  return '/my-trips';
}

/** Host or guest app home — never /admin. Used when leaving the admin panel. */
export async function getNonAdminHomePath(
  user: Pick<User, 'id'>
): Promise<string> {
  if (await userManagesAnyProperty(user.id)) return '/dashboard';
  return '/my-trips';
}

export async function userManagesAnyProperty(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const [{ count: owned }, { count: managed }] = await Promise.all([
    admin
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId),
    admin
      .from('property_managers')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ]);
  return (owned ?? 0) > 0 || (managed ?? 0) > 0;
}

export async function requireSiteAdmin(): Promise<User> {
  const user = await requireAuth();
  if (isDevAdminPreviewEnabled()) return user;
  if (!isSiteAdmin(user)) redirect('/');
  return user;
}

export async function canManageProperty(
  propertyId: string,
  userId: string
): Promise<boolean> {
  const admin = createAdminClient();
  const { data: property } = await admin
    .from('properties')
    .select('owner_id')
    .eq('id', propertyId)
    .single();

  if (!property) return false;
  if (property.owner_id === userId) return true;

  const { data: manager } = await admin
    .from('property_managers')
    .select('id')
    .eq('property_id', propertyId)
    .eq('user_id', userId)
    .single();

  return !!manager;
}

export async function requirePropertyAccess(
  propertyId: string
): Promise<User> {
  const user = await requireAuth();
  const hasAccess = await canManageProperty(propertyId, user.id);
  if (!hasAccess) redirect('/dashboard');
  return user;
}

export async function upsertUserProfile(
  userId: string,
  email: string,
  names?: { firstName?: string | null; lastName?: string | null }
) {
  const admin = createAdminClient();
  const profile: {
    id: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  } = { id: userId, email };

  // Only seed a first name when we have one and the row doesn't yet exist;
  // never clobber an existing name with a blank on a returning guest.
  if (names?.firstName !== undefined || names?.lastName !== undefined) {
    profile.first_name = names.firstName || email.split('@')[0];
    profile.last_name = names.lastName ?? null;
  }

  await admin.from('users').upsert(profile, { onConflict: 'id' });

  await linkOfflineBookingsToUser(userId, email);
}

async function linkOfflineBookingsToUser(userId: string, email: string) {
  const admin = createAdminClient();
  await admin
    .from('bookings')
    .update({ guest_user_id: userId })
    .eq('guest_email', email.toLowerCase())
    .is('guest_user_id', null);
}

export async function getOwnerProperties(userId: string) {
  const { normalizeProperty, isValidProperty } = await import('@/lib/properties');
  const supabase = await createClient();
  const { data: owned } = await supabase
    .from('properties')
    .select('*')
    .eq('owner_id', userId)
    .order('name');

  const { data: managed } = await supabase
    .from('property_managers')
    .select('property:properties(*)')
    .eq('user_id', userId);

  const managedProps =
    managed
      ?.map((m) => normalizeProperty(m.property))
      .filter(isValidProperty) ?? [];

  const ownedProps = (owned ?? []).filter(isValidProperty);
  const all = [...ownedProps, ...managedProps];
  const unique = all.filter(
    (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
  );
  return unique;
}
