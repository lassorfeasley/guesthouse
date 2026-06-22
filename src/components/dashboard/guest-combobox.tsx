'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GuestDirectoryEntry } from '@/app/api/guests/route';
import type { GuestLookupResult } from '@/app/api/guests/lookup/route';

export interface PickedGuest {
  email: string;
  firstName: string | null;
  lastName: string | null;
  relationship: string | null;
}

interface GuestComboboxProps {
  propertyId: string;
  value: string;
  onEmailChange: (email: string) => void;
  /** Fired when a known past guest is chosen from the list. */
  onPickGuest: (guest: PickedGuest) => void;
  autoFocus?: boolean;
}

function splitName(name: string): { firstName: string | null; lastName: string | null } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function GuestCombobox({
  propertyId,
  value,
  onEmailChange,
  onPickGuest,
  autoFocus,
}: GuestComboboxProps) {
  const [guests, setGuests] = useState<GuestDirectoryEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [lookup, setLookup] = useState<GuestLookupResult | null>(null);
  const [looking, setLooking] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load the property's known guests on first focus.
  async function ensureLoaded() {
    if (loaded) return;
    setLoaded(true);
    try {
      const res = await fetch(`/api/guests?property_id=${propertyId}`);
      if (res.ok) {
        const data = await res.json();
        setGuests(data.guests ?? []);
      }
    } catch {
      // Non-fatal: the field still works as a plain email input.
    }
  }

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const query = value.trim().toLowerCase();

  const matches = useMemo(() => {
    if (!query) return guests.slice(0, 6);
    return guests
      .filter(
        (g) =>
          g.email?.toLowerCase().includes(query) ||
          g.name.toLowerCase().includes(query)
      )
      .slice(0, 6);
  }, [guests, query]);

  // Debounced membership lookup for an email that isn't already a known guest.
  useEffect(() => {
    const email = value.trim().toLowerCase();
    const isKnown = guests.some((g) => g.email?.toLowerCase() === email);
    if (!email.includes('@') || isKnown) {
      setLookup(null);
      setLooking(false);
      return;
    }
    setLooking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/guests/lookup?property_id=${propertyId}&email=${encodeURIComponent(email)}`
        );
        if (res.ok) setLookup(await res.json());
        else setLookup(null);
      } catch {
        setLookup(null);
      } finally {
        setLooking(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [value, guests, propertyId]);

  function pick(g: GuestDirectoryEntry) {
    const { firstName, lastName } = splitName(g.name);
    onEmailChange(g.email ?? '');
    onPickGuest({
      email: g.email ?? '',
      firstName,
      lastName,
      relationship: g.relationship,
    });
    setOpen(false);
  }

  const showList = open && matches.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <Input
        type="email"
        autoFocus={autoFocus}
        value={value}
        placeholder="guest@email.com"
        onFocus={() => {
          void ensureLoaded();
          setOpen(true);
        }}
        onChange={(e) => {
          onEmailChange(e.target.value);
          setOpen(true);
        }}
        autoComplete="off"
      />

      {showList && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border bg-popover shadow-md">
          <p className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
            Past guests
          </p>
          <ul className="max-h-64 overflow-y-auto p-1">
            {matches.map((g) => {
              const selected = g.email?.toLowerCase() === query;
              return (
                <li key={g.key}>
                  <button
                    type="button"
                    onClick={() => pick(g)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent"
                  >
                    <PersonAvatar
                      name={g.name}
                      imageUrl={g.avatarUrl}
                      seed={g.email}
                      size="sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate font-medium">{g.name}</span>
                        {g.relationship && (
                          <span className="truncate text-xs text-muted-foreground">
                            · {g.relationship}
                          </span>
                        )}
                      </span>
                      {g.email && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {g.email}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      {g.pastStaysCount > 0 && (
                        <Badge variant="outline" className="text-[10px]">
                          {g.pastStaysCount} {g.pastStaysCount === 1 ? 'stay' : 'stays'}
                        </Badge>
                      )}
                      {selected && <Check className="h-4 w-4" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* "Already on Gracious" feedback for a typed (not-yet-known) email. */}
      {!showList && looking && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Checking…
        </p>
      )}
      {!showList && !looking && lookup?.isMember && (
        <div className="mt-2 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
          <PersonAvatar
            name={lookup.name ?? lookup.email}
            imageUrl={lookup.avatarUrl}
            seed={lookup.email}
            size="sm"
          />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {lookup.name ?? lookup.email}
            </span>{' '}
            is already on Gracious — this invite links to their existing account.
            {lookup.invitedHere && ' You\u2019ve invited them here before.'}
          </p>
        </div>
      )}
    </div>
  );
}
