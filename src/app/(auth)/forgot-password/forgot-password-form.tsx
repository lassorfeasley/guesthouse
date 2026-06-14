'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createClient } from '@/lib/supabase/client';
import {
  forgotPasswordSchema,
  type ForgotPasswordInput,
} from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';
import { Wordmark } from '@/components/brand/wordmark';

export default function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const expired = searchParams.get('error') === 'expired';
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordInput) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <Link href="/" aria-label="Gracious home">
        <Wordmark className="h-7 text-primary" />
      </Link>
      <Card className="w-full max-w-md">
        {sent ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">The letter is on its way</CardTitle>
              <CardDescription>
                If that address belongs to a Gracious account, a link to set a
                new password is in its inbox now. It&apos;s good for one hour.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm text-muted-foreground">
                Back to{' '}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline"
                >
                  sign in
                </Link>
              </p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Reset your password</CardTitle>
              <CardDescription>
                {expired
                  ? 'That link had expired. Tell us your email and we\u2019ll send a fresh one.'
                  : 'Tell us your email and we\u2019ll send a link to set a new one.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="you@example.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Sending…' : 'Send the link'}
                  </Button>
                </form>
              </Form>
              <p className="mt-4 text-center text-sm text-muted-foreground">
                Remembered it after all?{' '}
                <Link
                  href="/login"
                  className="font-medium text-foreground underline"
                >
                  Sign in
                </Link>
              </p>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
