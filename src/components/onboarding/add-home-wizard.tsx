'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { createPropertyWithRooms } from '@/lib/create-property';
import type { PropertySetupInput } from '@/lib/create-property';
import { Wordmark } from '@/components/brand/wordmark';
import { PropertySetupWizard } from '@/components/onboarding/property-setup-wizard';

export function AddHomeWizard({ userId }: { userId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleComplete(
    propertyData: PropertySetupInput
  ): Promise<string | void> {
    setLoading(true);
    const supabase = createClient();
    const result = await createPropertyWithRooms(supabase, userId, propertyData);
    setLoading(false);

    if ('error' in result && !('slug' in result)) {
      return result.error;
    }

    if ('error' in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success('Your new home is ready.');
    }

    router.push(`/dashboard/${result.slug}/overview`);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      <header className="flex items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/dashboard" aria-label="Gracious home">
          <Wordmark className="h-5 text-primary" />
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Cancel
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-8">
        <PropertySetupWizard
          loading={loading}
          finalActionLabel="Add home"
          finalActionLoadingLabel="Adding home…"
          onComplete={handleComplete}
        />
      </main>
    </div>
  );
}
