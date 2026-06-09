'use client';

import { toast } from 'sonner';
import type { BillingInterval } from '@/lib/pricing';

export interface LimitReachedPayload {
  error: 'limit_reached';
  plan: string;
  used: number;
  limit: number;
}

export function isLimitReachedResponse(
  status: number,
  data: unknown
): data is LimitReachedPayload {
  return (
    status === 402 &&
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    (data as LimitReachedPayload).error === 'limit_reached'
  );
}

export async function startCheckout(
  interval: BillingInterval = 'annual',
  returnPath?: string
): Promise<boolean> {
  const res = await fetch('/api/billing/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ interval, returnPath }),
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : 'Could not start checkout';
    toast.error(message);
    return false;
  }

  if (data.url) {
    window.location.href = data.url;
    return true;
  }

  toast.error('Could not start checkout');
  return false;
}

export async function openBillingPortal(returnPath?: string): Promise<boolean> {
  const res = await fetch('/api/billing/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnPath }),
  });

  const data = await res.json();

  if (!res.ok) {
    const message =
      typeof data.error === 'string'
        ? data.error
        : 'Could not open billing portal';
    toast.error(message);
    return false;
  }

  if (data.url) {
    window.location.href = data.url;
    return true;
  }

  toast.error('Could not open billing portal');
  return false;
}
