import Link from 'next/link';
import { requireAuth, getOwnerProperties } from '@/lib/auth';
import { isSiteAdmin } from '@/lib/site-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { VisibilityToggle } from '@/components/guest/visibility-toggle';
import { TripsView } from '@/components/guest/trips-view';
import { LogoutButton } from '@/components/logout-button';
import { SiteFooter } from '@/components/site-footer';
import { Wordmark } from '@/components/brand/wordmark';
import { Button } from '@/components/ui/button';
import { Home, Shield } from 'lucide-react';

export const metadata = { title: 'My trips' };

export default async function MyTripsPage() {
  const user = await requireAuth();
  const properties = await getOwnerProperties(user.id);
  const isHost = properties.length > 0;
  const showAdminLink = isSiteAdmin(user);

  // Guests can't read rooms/properties under RLS, so their trips would render
  // with null joins (and crash). Query as admin, scoped to the signed-in user.
  const admin = createAdminClient();
  const { data: bookings } = await admin
    .from('bookings')
    .select(
      `
      *,
      property:properties(name, slug),
      dates:booking_dates(check_in, check_out),
      booking_rooms(room:rooms(name)),
      invitation:invitations(token)
    `
    )
    .eq('guest_user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <Link href="/my-trips" aria-label="Gracious home">
            <Wordmark className="h-5 text-primary" />
          </Link>
          <div className="flex items-center gap-2">
            {showAdminLink && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin">
                  <Shield className="mr-2 h-4 w-4" />
                  Admin
                </Link>
              </Button>
            )}
            {isHost && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard">
                  <Home className="mr-2 h-4 w-4" />
                  Switch to hosting
                </Link>
              </Button>
            )}
            <VisibilityToggle visible={user.visible_to_coguests} />
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="container mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold">My trips</h1>
        <p className="mt-1 text-muted-foreground">Your stays and requests</p>

        <TripsView bookings={bookings ?? []} />
      </main>

      <SiteFooter />
    </div>
  );
}
