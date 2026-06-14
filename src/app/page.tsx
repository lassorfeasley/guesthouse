import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getAuthenticatedHomePath, getCurrentUser } from '@/lib/auth';
import { isLandingPreviewEnabled } from '@/lib/dev-tools';
import { redirect } from 'next/navigation';
import { SiteFooter } from '@/components/site-footer';
import { HowItWorks } from '@/components/landing/how-it-works';
import { StayShowcase } from '@/components/landing/stay-showcase';
import { PricingCards } from '@/components/pricing-cards';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const { preview } = await searchParams;
  const landingPreview = isLandingPreviewEnabled(preview);

  const user = await getCurrentUser();

  if (!landingPreview && user) {
    redirect(await getAuthenticatedHomePath(user));
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <span className="font-display text-2xl tracking-tight sm:text-3xl">
            Gracious
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="lg" className="text-base" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="lg" className="text-base" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="container mx-auto px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium tracking-wide text-brass">
            For guest homes and guest rooms
          </p>
          <h1 className="mt-6 font-display text-4xl font-medium tracking-tight sm:text-5xl xl:text-6xl">
            Every room, every guest, on one calendar.
          </h1>
          <p className="mx-auto mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground">
            See who&apos;s staying across all your homes at a glance. We take care
            of inviting, booking, and coordinating graciously — so you can be a
            great host while we do the rest.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Button size="lg" asChild>
              <Link href="/signup">Get started</Link>
            </Button>
          </div>
        </div>
        <StayShowcase className="mx-auto mt-16 max-w-4xl sm:mt-20" />
      </main>

      <section id="how-it-works" className="border-t border-border/60 py-28">
        <div className="container mx-auto px-4">
          <HowItWorks />
        </div>
      </section>

      <section id="pricing" className="border-t border-border/60 py-28">
        <div className="container mx-auto px-4">
          <PricingCards />
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
