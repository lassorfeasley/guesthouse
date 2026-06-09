import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth';
import { isSiteAdmin } from '@/lib/site-admin';
import { isLandingPreviewEnabled } from '@/lib/dev-tools';
import { redirect } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { HowItWorksCarousel } from '@/components/how-it-works-carousel';
import { PricingCards } from '@/components/pricing-cards';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const landingPreview = isLandingPreviewEnabled(preview);

  const user = await getCurrentUser();

  if (!landingPreview) {
    if (user && isSiteAdmin(user)) redirect('/admin');
    if (user?.role === 'owner') redirect('/dashboard');
    if (user) redirect('/my-trips');
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <span className="text-lg font-semibold tracking-tight">GuestHouse</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="#pricing">Pricing</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Share your second home
          <br />
          <span className="text-muted-foreground">with people you trust</span>
        </h1>
        <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
          GuestHouse is a private, invitation-only platform for vacation homeowners
          to manage stays with friends and family. Never public. Always personal.
        </p>
        <div className="mt-10 flex justify-center gap-4">
          <Button size="lg" asChild>
            <Link href="/signup">Create your account</Link>
          </Button>
        </div>
      </main>

      <section id="how-it-works" className="border-t py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              How it works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three steps to go from empty calendar to guests at the door —
              built for hosts, not listings.
            </p>
          </div>
          <HowItWorksCarousel className="mt-12" />
        </div>
      </section>

      <section id="pricing" className="border-t bg-muted/30 py-24">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Simple, honest pricing
            </h2>
            <p className="mt-3 text-muted-foreground">
              Set everything up and host your first two stays free. Keep going
              when you&apos;re ready.
            </p>
          </div>
          <PricingCards className="mt-12" />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
