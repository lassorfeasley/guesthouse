import { createClient } from '@/lib/supabase/server';
import { requireOwner, getOwnerProperties } from '@/lib/auth';
import { getDashboardProperty } from '@/lib/dashboard-property';
import { PropertyHomesSection } from '@/components/dashboard/property-homes-section';
import { SettingsForm } from '@/components/dashboard/settings-form';
import { SubscriptionCard } from '@/components/dashboard/subscription-card';
import { getAccountUsage } from '@/lib/billing';

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireOwner();
  const property = await getDashboardProperty(slug);
  const properties = await getOwnerProperties(user.id);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Account, your homes, and who can help manage them
        </p>
      </div>

      <PropertyHomesSection
        properties={properties}
        currentPropertyId={property.id}
        userId={user.id}
      />

      {isPropertyOwner && usage && (
        <div className="max-w-xl">
          <SubscriptionCard
            currentPlan={usage.plan}
            hostedStaysUsed={usage.used}
            hostedStaysLimit={usage.limit}
            returnPath={`/dashboard/${slug}/settings`}
          />
        </div>
      )}

      <SettingsForm
        user={user}
        propertyId={property.id}
        propertyName={property.name}
        isPropertyOwner={isPropertyOwner}
        managers={managers}
      />
    </div>
  );
}
