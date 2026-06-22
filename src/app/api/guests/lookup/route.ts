import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser, canManageProperty } from '@/lib/auth';
import { formatPersonName } from '@/lib/names';

export interface GuestLookupResult {
  email: string;
  isMember: boolean;
  name: string | null;
  avatarUrl: string | null;
  /** Whether this email already has an invitation on this property. */
  invitedHere: boolean;
  pastStaysHere: number;
  relationship: string | null;
}

/**
 * Resolves an arbitrary email the host typed: is it already a Gracious member,
 * and do they have history on this property? Powers the "already on Gracious"
 * inline feedback in the invite flow.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const propertyId = request.nextUrl.searchParams.get('property_id');
  const rawEmail = request.nextUrl.searchParams.get('email');
  if (!propertyId || !rawEmail) {
    return NextResponse.json(
      { error: 'property_id and email are required' },
      { status: 400 }
    );
  }

  // Scope the lookup to hosts of the property — this avoids turning the
  // endpoint into an open membership probe.
  if (!(await canManageProperty(propertyId, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email = rawEmail.trim().toLowerCase();
  if (!email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const admin = createAdminClient();

  const [{ data: member }, { data: invites }, { data: visits }] =
    await Promise.all([
      admin
        .from('users')
        .select('first_name, last_name, email, avatar_url')
        .eq('email', email)
        .maybeSingle(),
      admin
        .from('invitations')
        .select('relationship, created_at')
        .eq('property_id', propertyId)
        .eq('guest_email', email)
        .order('created_at', { ascending: false }),
      admin
        .from('visits')
        .select('status, relationship, dates:visit_dates(check_out)')
        .eq('property_id', propertyId)
        .eq('guest_email', email),
    ]);

  const today = new Date().toISOString().split('T')[0];
  const pastStaysHere = (visits ?? []).filter((v) => {
    const dates = Array.isArray(v.dates) ? v.dates[0] : v.dates;
    return v.status === 'approved' && dates?.check_out && dates.check_out < today;
  }).length;

  const relationship =
    (invites ?? []).find((i) => i.relationship)?.relationship ??
    (visits ?? []).find((v) => v.relationship)?.relationship ??
    null;

  const result: GuestLookupResult = {
    email,
    isMember: Boolean(member),
    name: member ? (formatPersonName(member) ?? null) : null,
    avatarUrl: member?.avatar_url ?? null,
    invitedHere: (invites ?? []).length > 0,
    pastStaysHere,
    relationship,
  };

  return NextResponse.json(result);
}
