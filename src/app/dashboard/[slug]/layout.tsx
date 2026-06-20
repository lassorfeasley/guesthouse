import { notFound } from 'next/navigation';
import { requireAuth, getOwnerProperties } from '@/lib/auth';
import { isSiteAdmin } from '@/lib/site-admin';
import { createClient } from '@/lib/supabase/server';
import { DashboardTopNav } from '@/components/dashboard/top-nav';
import { RequestsAlertBanner } from '@/components/dashboard/requests-alert-banner';
import { SiteFooter } from '@/components/site-footer';

export default async function PropertyDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireAuth();
  const properties = await getOwnerProperties(user.id);
  const currentProperty = properties.find((p) => p.slug === slug);

  // getOwnerProperties only returns owned/co-managed properties, so a slug the
  // user can't manage (or any non-host) lands here and is rejected.
  if (!currentProperty) notFound();

  const supabase = await createClient();
  const { count: requestCount } = await supabase
    .from('bookings')
    .select('*', { count: 'exact', head: true })
    .eq('property_id', currentProperty.id)
    .eq('status', 'requested');

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardTopNav
        properties={properties}
        currentProperty={currentProperty}
        userEmail={user.email ?? undefined}
        userId={user.id}
        showAdminLink={isSiteAdmin(user)}
      />
      <RequestsAlertBanner
        slug={currentProperty.slug}
        requestCount={requestCount ?? 0}
      />
      <main className="flex-1 px-6 pt-6 pb-32">{children}</main>
      <SiteFooter name={currentProperty.name} />
    </div>
  );
}
