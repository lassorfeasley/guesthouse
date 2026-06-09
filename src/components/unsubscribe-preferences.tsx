'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export interface PreferenceRow {
  category: string;
  token: string;
  label: string;
  description: string;
  subscribed: boolean;
  /** The category the unsubscribe link was for, emphasized in the UI. */
  highlighted: boolean;
}

export function UnsubscribePreferences({ rows }: { rows: PreferenceRow[] }) {
  const [state, setState] = useState<Record<string, boolean>>(
    Object.fromEntries(rows.map((r) => [r.category, r.subscribed]))
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(row: PreferenceRow, next: boolean) {
    setPending(row.category);
    setError(null);
    const previous = state[row.category];
    setState((s) => ({ ...s, [row.category]: next }));
    try {
      const res = await fetch(
        `/api/unsubscribe?token=${encodeURIComponent(row.token)}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ subscribed: next }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? 'Something went wrong');
      }
    } catch (err) {
      setState((s) => ({ ...s, [row.category]: previous }));
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-5">
      <ul className="space-y-4">
        {rows.map((row) => (
          <li
            key={row.category}
            className={`flex items-start justify-between gap-4 rounded-lg border p-4 ${
              row.highlighted ? 'border-foreground/30 bg-muted/40' : ''
            }`}
          >
            <div className="min-w-0">
              <Label htmlFor={row.category} className="text-sm font-medium">
                {row.label}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.description}
              </p>
            </div>
            <Switch
              id={row.category}
              checked={state[row.category]}
              disabled={pending === row.category}
              onCheckedChange={(v) => toggle(row, v)}
            />
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        Changes save automatically. Essential emails — sign-in, invitations, and
        booking confirmations — are always sent and can&apos;t be turned off.
      </p>
    </div>
  );
}
