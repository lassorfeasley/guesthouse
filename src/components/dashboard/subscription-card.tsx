'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { openBillingPortal, startCheckout } from '@/lib/billing-client';
import { PRICING_PLANS, type PlanId } from '@/lib/pricing';

interface SubscriptionCardProps {
  currentPlan: PlanId;
  hostedStaysUsed: number;
  hostedStaysLimit: number;
  returnPath?: string;
}

export function SubscriptionCard({
  currentPlan,
  hostedStaysUsed,
  hostedStaysLimit,
  returnPath,
}: SubscriptionCardProps) {
  const [interval, setInterval] = useState<'annual' | 'monthly'>('annual');
  const [loading, setLoading] = useState(false);
  const pro = PRICING_PLANS.find((p) => p.id === 'pro')!;
  const isPro = currentPlan === 'pro';

  async function handleUpgrade() {
    setLoading(true);
    await startCheckout(interval, returnPath);
    setLoading(false);
  }

  async function handleManage() {
    setLoading(true);
    await openBillingPortal(returnPath);
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Subscription</CardTitle>
          <Badge variant={isPro ? 'default' : 'secondary'}>
            {isPro ? 'Pro' : 'Free'} plan
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {isPro ? (
          <>
            <p className="text-sm text-muted-foreground">
              You’re on the <strong>Pro</strong> plan with unlimited hosted
              stays, homes, and co-managers.
            </p>
            <Button variant="outline" onClick={handleManage} disabled={loading}>
              {loading ? 'Opening…' : 'Manage billing'}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              You’re on the <strong>Free</strong> plan — your first{' '}
              {hostedStaysLimit} hosted stays are on us. Upgrade to Pro for
              unlimited stays, homes, and co-managers.
            </p>
            <p className="text-sm font-medium">
              {hostedStaysUsed} of {hostedStaysLimit} free stays used
            </p>

            <div className="rounded-xl border p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold">Pro</p>
                  <p className="text-sm text-muted-foreground">
                    {interval === 'annual'
                      ? 'Billed $390 / year'
                      : 'Billed $39 / month'}
                  </p>
                </div>
                <div className="inline-flex rounded-lg border p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setInterval('annual')}
                    className={cn(
                      'rounded-md px-3 py-1.5 font-medium transition-colors',
                      interval === 'annual'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Annual
                  </button>
                  <button
                    type="button"
                    onClick={() => setInterval('monthly')}
                    className={cn(
                      'rounded-md px-3 py-1.5 font-medium transition-colors',
                      interval === 'monthly'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Monthly
                  </button>
                </div>
              </div>

              <ul className="mt-4 space-y-2">
                {pro.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Check className="size-4 shrink-0 text-green-600" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className="mt-5 w-full"
                onClick={handleUpgrade}
                disabled={loading}
              >
                {loading ? 'Redirecting…' : 'Upgrade to Pro'}
              </Button>
              {pro.ctaNote && (
                <p className="mt-2 text-center text-xs text-muted-foreground">
                  {pro.ctaNote}
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
