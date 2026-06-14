import { redirect } from 'next/navigation';
import { requireAuth, getOwnerProperties } from '@/lib/auth';
import { CreatePropertyForm } from '@/components/dashboard/create-property-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SiteFooter } from '@/components/site-footer';
import { Wordmark } from '@/components/brand/wordmark';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const user = await requireAuth();
  const properties = await getOwnerProperties(user.id);

  if (properties.length === 1 && properties[0]?.slug) {
    redirect(`/dashboard/${properties[0].slug}/overview`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b">
        <div className="container mx-auto flex h-14 items-center px-4">
          <Link href="/dashboard" aria-label="Gracious home">
            <Wordmark className="h-5 text-primary" />
          </Link>
        </div>
      </header>
      <main className="container mx-auto w-full max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-semibold">Your properties</h1>
        <p className="mt-1 text-muted-foreground">
          Select a property to manage or create a new one
        </p>

        {properties.length === 0 ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Add your first property</CardTitle>
            </CardHeader>
            <CardContent>
              <CreatePropertyForm userId={user.id} />
            </CardContent>
          </Card>
        ) : (
          <div className="mt-8 grid gap-4">
            {properties.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    {p.address && (
                      <p className="text-sm text-muted-foreground">{p.address}</p>
                    )}
                  </div>
                  <Button asChild>
                    <Link href={`/dashboard/${p.slug}/overview`}>Open</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add another property</CardTitle>
              </CardHeader>
              <CardContent>
                <CreatePropertyForm userId={user.id} />
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
