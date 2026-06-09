'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { startCheckout } from '@/lib/billing-client';
import { FREE_INCLUDED_STAYS } from '@/lib/pricing';

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  used?: number;
  limit?: number;
  returnPath?: string;
}

export function UpgradeDialog({
  open,
  onOpenChange,
  used = FREE_INCLUDED_STAYS,
  limit = FREE_INCLUDED_STAYS,
  returnPath,
}: UpgradeDialogProps) {
  const [interval, setInterval] = useState<'annual' | 'monthly'>('annual');
  const [loading, setLoading] = useState(false);

  async function handleUpgrade() {
    setLoading(true);
    await startCheckout(interval, returnPath);
    setLoading(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>You&apos;ve hosted your {limit} free stays</DialogTitle>
          <DialogDescription>
            You&apos;ve used {used} of {limit} free hosted stays on your account.
            Upgrade to Pro for unlimited stays, homes, and co-managers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
              Annual — $390/yr
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
              Monthly — $39/mo
            </button>
          </div>

          <Button className="w-full" onClick={handleUpgrade} disabled={loading}>
            {loading ? 'Redirecting…' : 'Upgrade to Pro'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
