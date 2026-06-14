import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { SettingsForm } from '@/components/dashboard/settings-form';
import { SubscriptionCard } from '@/components/dashboard/subscription-card';
import { getAccountUsage } from '@/lib/billing';
import { DashboardContainer } from '@/components/dashboard/dashboard-container';

export const metadata = { title: 'Settings' };

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireAuth();
  // getDashboardProperty notFounds if the user can't manage this property.
  const property = await getDashboardProperty(slug);
  const isPropertyOwner = property.owner_id === user.id;
  const supabase = await createClient();

  const { data: managersRaw } = await supabase
    .from('property_managers')
    .select('id, user:users(email, name)')
    .eq('property_id', property.id);

  const usage = isPropertyOwner
    ? await getAccountUsage(property.owner_id)
    : null;

  const managers = (managersRaw ?? []).map((m) => {
    const u = Array.isArray(m.user) ? m.user[0] : m.user;
    return {
      id: m.id as string,
      user: u as { email: string; name: string | null },
    };
  });

  return (
    <DashboardContainer width="form">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your account, notifications, and billing.
        </p>
      </div>

      <div className="mt-4 divide-y">
        {isPropertyOwner && usage && (
          <SubscriptionCard
            currentPlan={usage.plan}
            hostedStaysUsed={usage.used}
            hostedStaysLimit={usage.limit}
            returnPath={`/dashboard/${slug}/settings`}
          />
        )}

        <SettingsForm
          user={user}
          propertyId={property.id}
          propertyName={property.name}
          isPropertyOwner={isPropertyOwner}
          managers={managers}
        />
      </div>
    </DashboardContainer>
  );
}
