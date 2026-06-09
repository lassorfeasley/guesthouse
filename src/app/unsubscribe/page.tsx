import { createAdminClient } from '@/lib/supabase/admin';
import { makeUnsubscribeToken, parseUnsubscribeToken } from '@/lib/unsubscribe';
import {
  ALL_UNSUBSCRIBE_CATEGORIES,
  CATEGORY_META,
  isSubscribedToCategory,
  normalizePrefs,
} from '@/lib/notification-prefs';
import {
  UnsubscribePreferences,
  type PreferenceRow,
} from '@/components/unsubscribe-preferences';

export const metadata = { title: 'Email preferences · GuestHouse' };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const parsed = token ? parseUnsubscribeToken(token) : null;

  let rows: PreferenceRow[] = [];
  if (parsed) {
    const admin = createAdminClient();
    const { data: user } = await admin
      .from('users')
      .select('notification_prefs')
      .eq('id', parsed.userId)
      .maybeSingle();

    if (user) {
      const prefs = normalizePrefs(user.notification_prefs);
      rows = ALL_UNSUBSCRIBE_CATEGORIES.map((category) => ({
        category,
        token: makeUnsubscribeToken(parsed.userId, category),
        label: CATEGORY_META[category].label,
        description: CATEGORY_META[category].description,
        subscribed: isSubscribedToCategory(prefs, category),
        highlighted: category === parsed.category,
      }));
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-2xl border bg-card p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          GuestHouse
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          Email preferences
        </h1>

        <div className="mt-6">
          {parsed && rows.length > 0 ? (
            <UnsubscribePreferences rows={rows} />
          ) : (
            <p className="text-muted-foreground">
              This link is invalid or has expired. You can manage all your email
              preferences from your account settings.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
