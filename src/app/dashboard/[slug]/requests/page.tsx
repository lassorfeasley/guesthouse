import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getDashboardProperty } from '@/lib/dashboard-property';

export default async function RequestsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ booking?: string; action?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  // Preserve one-click email actions (?booking=&action=approve|decline): run
  // the action here, then forward to the merged Bookings hub with a notice.
  let notice: string | null = null;
  if (sp.booking && sp.action) {
    const property = await getDashboardProperty(slug);
    const user = await getCurrentUser();
    if (user) {
      notice = await handleQuickAction(
        property.id,
        user.id,
        sp.booking,
        sp.action
      );
    }
  }

  const query = notice ? `&notice=${notice}` : '';
  redirect(`/dashboard/${slug}/bookings?status=requested${query}`);
}

async function handleQuickAction(
  propertyId: string,
  actorUserId: string,
  bookingId: string,
  action: string
): Promise<string | null> {
  if (action !== 'approve' && action !== 'decline') return null;
  const { approveBooking, declineBooking } = await import(
    '@/lib/booking-actions'
  );

  // Scope by propertyId so a tampered booking id from an email link can't act
  // on a stay this host doesn't manage. The shared action also enforces the
  // pending-only guard, so a refresh of an already-handled request is a no-op.
  const result =
    action === 'approve'
      ? await approveBooking(bookingId, actorUserId, { propertyId })
      : await declineBooking(bookingId, actorUserId, { propertyId });

  if (!result.ok) return 'handled';
  return action === 'approve' ? 'approved' : 'declined';
}
