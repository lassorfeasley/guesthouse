'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { storePendingUpgrade } from '@/lib/billing-client';
import { createPropertyWithRooms } from '@/lib/create-property';
import type { PropertySetupInput } from '@/lib/create-property';
import { Wordmark } from '@/components/brand/wordmark';
import { signupSchema } from '@/lib/validations';
import { PropertySetupWizard } from '@/components/onboarding/property-setup-wizard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  function persistUpgradeIntent() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'pro') {
      storePendingUpgrade(params.get('interval') === 'monthly' ? 'monthly' : 'annual');
    }
  }

  async function handleComplete(
    propertyData: PropertySetupInput
  ): Promise<string | void> {
    const parsed = signupSchema.safeParse({
      first_name: firstName,
      last_name: lastName,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors)
        .flat()
        .find(Boolean);
      return first ?? 'Check the account details';
    }

    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: {
          first_name: parsed.data.first_name,
          last_name: parsed.data.last_name ?? null,
        },
      },
    });

    if (error?.message?.includes('Database error saving new user')) {
      const fallback = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const fallbackData = await fallback.json();
      if (!fallback.ok) {
        setLoading(false);
        return typeof fallbackData.error === 'string'
          ? fallbackData.error
          : 'Signup failed. Run supabase/migrations/002_fix_auth_user_trigger.sql in the Supabase SQL Editor.';
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInError) {
        setLoading(false);
        return signInError.message;
      }
    } else if (error) {
      setLoading(false);
      if (/registered|already|exists/i.test(error.message)) {
        toast.error(
          'You already have a Gracious account with this email. Sign in, then add your home from your dashboard.'
        );
        router.push('/login?redirect=/dashboard');
        return;
      }
      return error.message;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return 'Check your email to confirm your account, then sign in.';
    }

    await supabase.from('users').upsert({
      id: user.id,
      email: parsed.data.email,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name ?? null,
    });

    const result = await createPropertyWithRooms(supabase, user.id, propertyData);
    setLoading(false);

    if ('error' in result && !('slug' in result)) {
      toast.error(result.error);
      router.push('/dashboard');
      router.refresh();
      return;
    }

    if ('error' in result && result.error) {
      toast.error(result.error);
    }

    persistUpgradeIntent();
    toast.success('Welcome! Your place is ready.');
    router.push(`/dashboard/${result.slug}/overview`);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <header className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link href="/" aria-label="Gracious home">
          <Wordmark className="h-5 text-primary" />
        </Link>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground underline">
            Sign in
          </Link>
        </p>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-8">
        <PropertySetupWizard
          includeAccountStep
          loading={loading}
          finalActionLabel="Create account"
          finalActionLoadingLabel="Creating account…"
          onComplete={handleComplete}
          renderAccountStep={({ clearError, propertyPreview }) => (
            <div className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
                <Home className="h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="text-sm">
                  <span className="font-medium">
                    {propertyPreview.name || 'Your place'}
                  </span>
                  {propertyPreview.roomCount > 0 && (
                    <span className="text-muted-foreground">
                      {' '}
                      · {propertyPreview.roomCount}{' '}
                      {propertyPreview.roomCount === 1 ? 'room' : 'rooms'}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Last step — create your login so you can manage everything.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    autoFocus
                    placeholder="Jane"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      clearError();
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name">Last name (optional)</Label>
                  <Input
                    id="last-name"
                    placeholder="Doe"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      clearError();
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    clearError();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    clearError();
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    clearError();
                  }}
                />
              </div>
            </div>
          )}
        />
      </main>
    </div>
  );
}
