import { requireAuth } from '@/lib/auth';
import { AddHomeWizard } from '@/components/onboarding/add-home-wizard';

export const metadata = { title: 'Add a home' };

export default async function AddHomePage() {
  const user = await requireAuth();
  return <AddHomeWizard userId={user.id} />;
}
