'use client';

import * as React from 'react';
import {
  Bell,
  Check,
  Heart,
  Home,
  Info,
  Moon,
  Search,
  Sun,
  TriangleAlert,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/* ----------------------------- layout helpers ----------------------------- */

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="scroll-mt-24 space-y-5" id={slug(title)}>
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/* -------------------------------- tokens ---------------------------------- */

const SEMANTIC_COLORS = [
  { name: 'background', fg: 'foreground' },
  { name: 'card', fg: 'card-foreground' },
  { name: 'primary', fg: 'primary-foreground' },
  { name: 'secondary', fg: 'secondary-foreground' },
  { name: 'muted', fg: 'muted-foreground' },
  { name: 'accent', fg: 'accent-foreground' },
  { name: 'success', fg: 'success-foreground' },
  { name: 'warning', fg: 'warning-foreground' },
  { name: 'destructive', fg: 'destructive-foreground' },
] as const;

function Swatch({ name, fg }: { name: string; fg: string }) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div
        className="flex h-20 items-end p-3"
        style={{
          backgroundColor: `hsl(var(--${name}))`,
          color: `hsl(var(--${fg}))`,
        }}
      >
        <span className="text-xs font-medium">Aa</span>
      </div>
      <div className="bg-card px-3 py-2">
        <p className="text-xs font-medium">{name}</p>
        <p className="font-mono text-[10px] text-muted-foreground">
          --{name}
        </p>
      </div>
    </div>
  );
}

const TYPE_SCALE = [
  { label: 'Display', cls: 'font-display text-5xl font-bold tracking-tight' },
  { label: 'Heading 1', cls: 'font-display text-4xl font-semibold tracking-tight' },
  { label: 'Heading 2', cls: 'font-display text-3xl font-semibold tracking-tight' },
  { label: 'Heading 3', cls: 'font-display text-2xl font-semibold tracking-tight' },
  { label: 'Heading 4', cls: 'font-display text-xl font-semibold tracking-tight' },
  { label: 'Lead', cls: 'text-lg text-muted-foreground' },
  { label: 'Body', cls: 'text-base' },
  { label: 'Small', cls: 'text-sm' },
  { label: 'Caption', cls: 'text-xs text-muted-foreground' },
];

const RADII = [
  { label: 'sm', cls: 'rounded-sm' },
  { label: 'md', cls: 'rounded-md' },
  { label: 'lg', cls: 'rounded-lg' },
  { label: 'xl', cls: 'rounded-xl' },
];
const SHADOWS = [
  { label: 'xs', cls: 'shadow-xs' },
  { label: 'sm', cls: 'shadow-sm' },
  { label: 'md', cls: 'shadow-md' },
  { label: 'lg', cls: 'shadow-lg' },
  { label: 'xl', cls: 'shadow-xl' },
];

/* -------------------------------- guide ----------------------------------- */

export function StyleGuide() {
  const [dark, setDark] = React.useState(false);

  // Tailwind v4's @theme resolves --color-* at :root, so dark mode only takes
  // effect when `.dark` is on <html> (matching how next-themes behaves in prod).
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    return () => root.classList.remove('dark');
  }, [dark]);

  return (
    <div>
      <div className="min-h-screen bg-background text-foreground">
        <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                GuestHouse — Design System
              </h1>
              <p className="text-xs text-muted-foreground">
                Living style guide · tokens &amp; components
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDark((d) => !d)}
            >
              {dark ? <Sun /> : <Moon />}
              {dark ? 'Light' : 'Dark'}
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-5xl space-y-16 px-6 py-12">
          <Section
            title="Colors"
            description="Semantic tokens driven by CSS variables in globals.css. These adapt automatically to light and dark mode."
          >
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {SEMANTIC_COLORS.map((c) => (
                <Swatch key={c.name} name={c.name} fg={c.fg} />
              ))}
            </div>
          </Section>

          <Section
            title="Typography"
            description="Headings use Plus Jakarta Sans (display); body uses Inter."
          >
            <Card>
              <CardContent className="space-y-4 pt-6">
                {TYPE_SCALE.map((t) => (
                  <div
                    key={t.label}
                    className="flex flex-col gap-1 border-b pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-6"
                  >
                    <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                      {t.label}
                    </span>
                    <span className={t.cls}>The quick brown fox</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </Section>

          <Section title="Radius & Elevation" description="Corner radii scale from the --radius token; shadows are soft and layered.">
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Radius</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-4">
                  {RADII.map((r) => (
                    <div
                      key={r.label}
                      className="flex flex-col items-center gap-2"
                    >
                      <div
                        className={cn('size-16 border bg-secondary', r.cls)}
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {r.label}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Shadow</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-5">
                  {SHADOWS.map((s) => (
                    <div
                      key={s.label}
                      className="flex flex-col items-center gap-2"
                    >
                      <div className={cn('size-16 rounded-lg bg-card', s.cls)} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.label}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="Buttons" description="All variants and sizes.">
            <Card>
              <CardContent className="space-y-6 pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Button>Primary</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                  <Button variant="destructive">Destructive</Button>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon" aria-label="Like">
                    <Heart />
                  </Button>
                  <Button>
                    <Search />
                    With icon
                  </Button>
                  <Button disabled>Disabled</Button>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title="Badges">
            <div className="flex flex-wrap gap-3">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </Section>

          <Section title="Form controls">
            <Card>
              <CardContent className="grid gap-6 pt-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="sg-name">Name</Label>
                  <Input id="sg-name" placeholder="Jane Doe" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sg-email">Email</Label>
                  <Input id="sg-email" type="email" placeholder="jane@home.co" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="sg-note">Message</Label>
                  <Textarea id="sg-note" placeholder="Tell us about your stay…" />
                </div>
                <div className="flex items-center gap-3">
                  <Switch id="sg-switch" defaultChecked />
                  <Label htmlFor="sg-switch">Enable notifications</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox id="sg-check" defaultChecked />
                  <Label htmlFor="sg-check">I agree to the house rules</Label>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Section title="Cards">
            <div className="grid gap-6 sm:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Lakeside Cabin</CardTitle>
                  <CardDescription>Tahoe City, California</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  A cozy two-bedroom retreat with a private dock and a wood-burning
                  fireplace.
                </CardContent>
                <CardFooter className="justify-between">
                  <span className="text-sm font-semibold">$220 / night</span>
                  <Button size="sm">Request stay</Button>
                </CardFooter>
              </Card>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <CardTitle>Hover elevation</CardTitle>
                  <CardDescription>
                    Hover me to see the soft shadow lift.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center gap-2 text-sm text-success">
                  <Check className="size-4" /> Available this weekend
                </CardContent>
              </Card>
            </div>
          </Section>

          <Section title="Alerts">
            <div className="space-y-3">
              <Alert>
                <Info />
                <AlertTitle>Heads up</AlertTitle>
                <AlertDescription>
                  Your invitation link expires in 7 days.
                </AlertDescription>
              </Alert>
              <Alert variant="destructive">
                <TriangleAlert />
                <AlertTitle>Payment failed</AlertTitle>
                <AlertDescription>
                  We couldn&apos;t process your subscription renewal.
                </AlertDescription>
              </Alert>
            </div>
          </Section>

          <Section title="Tabs">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList>
                <TabsTrigger value="overview">
                  <Home className="size-4" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="activity">
                  <Bell className="size-4" />
                  Activity
                </TabsTrigger>
              </TabsList>
              <TabsContent value="overview" className="pt-4 text-sm text-muted-foreground">
                Overview content lives here.
              </TabsContent>
              <TabsContent value="activity" className="pt-4 text-sm text-muted-foreground">
                Recent activity shows up here.
              </TabsContent>
            </Tabs>
          </Section>

          <Separator />
          <p className="pb-8 text-center text-xs text-muted-foreground">
            Edit tokens in <code className="font-mono">src/app/globals.css</code> —
            every component on this page updates automatically.
          </p>
        </main>
      </div>
    </div>
  );
}
