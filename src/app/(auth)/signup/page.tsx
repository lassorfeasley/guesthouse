'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Home, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { storePendingUpgrade } from '@/lib/billing-client';
import { slugify } from '@/lib/slug';
import { Wordmark } from '@/components/brand/wordmark';
import {
  signupSchema,
  BED_SIZES,
  BED_SIZE_LABELS,
  summarizeBeds,
} from '@/lib/validations';
import {
  HOME_AMENITY_PRESETS,
  ROOM_AMENITY_PRESETS,
  amenityKey,
} from '@/lib/amenities';
import { cn } from '@/lib/utils';
import type { Amenity } from '@/types/database';
import { AddressAutocomplete } from '@/components/dashboard/address-autocomplete';
import { LocationPicker } from '@/components/dashboard/location-picker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type BedSize = (typeof BED_SIZES)[number];

interface WizardRoom {
  key: string;
  name: string;
  max_occupancy: number;
  beds: BedSize[];
  amenities: Amenity[];
}

type Step =
  | { kind: 'house' }
  | { kind: 'house-address' }
  | { kind: 'house-amenities' }
  | { kind: 'rooms' }
  | { kind: 'room-beds'; roomKey: string; roomIndex: number }
  | { kind: 'room-amenities'; roomKey: string; roomIndex: number }
  | { kind: 'account' };

function newRoom(): WizardRoom {
  return {
    key: crypto.randomUUID(),
    name: '',
    max_occupancy: 2,
    beds: ['queen'],
    amenities: [],
  };
}

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // House
  const [houseName, setHouseName] = useState('');
  const [houseAddress, setHouseAddress] = useState('');
  const [houseLat, setHouseLat] = useState<number | null>(null);
  const [houseLng, setHouseLng] = useState<number | null>(null);
  const [houseAmenities, setHouseAmenities] = useState<Amenity[]>([]);

  // Rooms
  const [rooms, setRooms] = useState<WizardRoom[]>([newRoom()]);

  // Account (deferred to last step)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Steps are dynamic: each room contributes a "beds" page and an
  // "amenities" page.
  const steps: Step[] = [
    { kind: 'house' },
    { kind: 'house-address' },
    { kind: 'house-amenities' },
    { kind: 'rooms' },
    ...rooms.flatMap((r, i) => [
      { kind: 'room-beds' as const, roomKey: r.key, roomIndex: i },
      { kind: 'room-amenities' as const, roomKey: r.key, roomIndex: i },
    ]),
    { kind: 'account' },
  ];

  const current = Math.min(step, steps.length - 1);
  const currentStep = steps[current];
  const isLast = current === steps.length - 1;
  const progress = ((current + 1) / steps.length) * 100;

  const namedRoomCount = rooms.filter((r) => r.name.trim()).length;

  function stepTitle(s: Step): string {
    switch (s.kind) {
      case 'house':
        return "What's your place called?";
      case 'house-address':
        return 'Where is it located?';
      case 'house-amenities':
        return 'What does your place offer?';
      case 'rooms':
        return 'Add your rooms';
      case 'room-beds': {
        const room = rooms[s.roomIndex];
        return room?.name.trim() || `Room ${s.roomIndex + 1}`;
      }
      case 'room-amenities': {
        const room = rooms[s.roomIndex];
        const name = room?.name.trim() || `Room ${s.roomIndex + 1}`;
        return `What does ${name} offer?`;
      }
      case 'account':
        return 'Create your account';
    }
  }

  function updateRoom(key: string, patch: Partial<WizardRoom>) {
    setRooms((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }

  function addRoom() {
    setRooms((prev) => [...prev, newRoom()]);
  }

  function removeRoom(key: string) {
    setRooms((prev) => prev.filter((r) => r.key !== key));
  }

  function addBed(key: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, beds: [...r.beds, 'queen'] } : r
      )
    );
  }

  function setBed(key: string, index: number, size: BedSize) {
    setRooms((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, beds: r.beds.map((b, i) => (i === index ? size : b)) }
          : r
      )
    );
  }

  function removeBed(key: string, index: number) {
    setRooms((prev) =>
      prev.map((r) =>
        r.key === key
          ? { ...r, beds: r.beds.filter((_, i) => i !== index) }
          : r
      )
    );
  }

  function validateStep(s: Step): boolean {
    if (s.kind === 'house' && !houseName.trim()) {
      toast.error('Give your place a name');
      return false;
    }
    if (s.kind === 'rooms') {
      if (rooms.length === 0) {
        toast.error('Add at least one room');
        return false;
      }
      if (rooms.some((r) => !r.name.trim())) {
        toast.error('Give each room a name, or remove it');
        return false;
      }
    }
    return true;
  }

  function handleNext() {
    if (!validateStep(currentStep)) return;
    setStep(current + 1);
  }

  // Carries "go Pro now" intent (from /signup?upgrade=pro&interval=...) through
  // to the dashboard, which launches Stripe checkout after the account exists.
  function persistUpgradeIntent() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgrade') === 'pro') {
      storePendingUpgrade(params.get('interval') === 'monthly' ? 'monthly' : 'annual');
    }
  }

  async function handleCreateAccount() {
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
      toast.error(first ?? 'Check the account details');
      return;
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

    // The DB trigger that mirrors auth users into public.users may be missing;
    // fall back to the service-role route and sign in explicitly.
    if (error?.message?.includes('Database error saving new user')) {
      const fallback = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const fallbackData = await fallback.json();
      if (!fallback.ok) {
        setLoading(false);
        toast.error(
          typeof fallbackData.error === 'string'
            ? fallbackData.error
            : 'Signup failed. Run supabase/migrations/002_fix_auth_user_trigger.sql in the Supabase SQL Editor.'
        );
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });
      if (signInError) {
        setLoading(false);
        toast.error(signInError.message);
        return;
      }
    } else if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      toast.error('Check your email to confirm your account, then sign in.');
      return;
    }

    // owner_id FKs to public.users, so ensure the profile row exists first.
    // Creating the property below is what makes this account a host.
    await supabase.from('users').upsert({
      id: user.id,
      email: parsed.data.email,
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name ?? null,
    });

    const slug = await insertPropertyWithUniqueSlug(supabase, user.id, {
      name: houseName.trim(),
      address: houseAddress.trim() || null,
      latitude: houseLat,
      longitude: houseLng,
      amenities: houseAmenities,
    });
    if (!slug) {
      setLoading(false);
      toast.error('Account created, but we could not set up your place. Try again from the dashboard.');
      router.push('/dashboard');
      router.refresh();
      return;
    }

    const namedRooms = rooms.filter((r) => r.name.trim());
    if (namedRooms.length > 0) {
      const { data: property } = await supabase
        .from('properties')
        .select('id')
        .eq('slug', slug)
        .single();
      if (property) {
        const { error: roomsError } = await supabase.from('rooms').insert(
          namedRooms.map((r, i) => ({
            property_id: property.id,
            name: r.name.trim(),
            max_occupancy: r.max_occupancy,
            beds: r.beds,
            amenities: r.amenities,
            display_order: i,
          }))
        );
        if (roomsError) {
          toast.error('Your place was created, but some rooms could not be added.');
        }
      }
    }

    persistUpgradeIntent();
    toast.success('Welcome! Your place is ready.');
    router.push(`/dashboard/${slug}/overview`);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" aria-label="Gracious home">
          <Wordmark className="h-5 text-primary" />
        </Link>
        <p className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-foreground underline">
            Sign in
          </Link>
        </p>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-8">
        <div className="flex h-[min(82vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-card shadow-sm">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-10 sm:px-10">
            <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {stepTitle(currentStep)}
            </h1>

            <div className="mt-8">
              {currentStep.kind === 'house' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="house-name">Place name</Label>
                    <Input
                      id="house-name"
                      autoFocus
                      placeholder="Lake House"
                      value={houseName}
                      onChange={(e) => setHouseName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNext();
                      }}
                    />
                    {houseName.trim() && (
                      <p className="text-xs text-muted-foreground">
                        Your link: /{slugify(houseName)}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {currentStep.kind === 'house-address' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="house-address">Address</Label>
                    <AddressAutocomplete
                      id="house-address"
                      value={houseAddress}
                      onChange={setHouseAddress}
                      onPlaceSelect={(place) => {
                        setHouseAddress(place.address);
                        setHouseLat(place.latitude);
                        setHouseLng(place.longitude);
                      }}
                    />
                  </div>
                  <LocationPicker
                    address={houseAddress}
                    latitude={houseLat}
                    longitude={houseLng}
                    onChange={(lat, lng) => {
                      setHouseLat(lat);
                      setHouseLng(lng);
                    }}
                  />
                </div>
              )}

              {currentStep.kind === 'house-amenities' && (
                <div className="space-y-4">
                  <AmenityPills
                    value={houseAmenities}
                    onChange={setHouseAmenities}
                    presets={HOME_AMENITY_PRESETS}
                  />
                </div>
              )}

              {currentStep.kind === 'rooms' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Name each room guests can stay in. You&apos;ll set up beds for
                    each one next.
                  </p>

                  <div className="space-y-3">
                    {rooms.map((room, roomIndex) => (
                      <div key={room.key} className="flex items-end gap-3">
                        <div className="flex-1 space-y-2">
                          <Label htmlFor={`room-name-${room.key}`}>
                            Room {roomIndex + 1}
                          </Label>
                          <Input
                            id={`room-name-${room.key}`}
                            placeholder="Master bedroom"
                            value={room.name}
                            onChange={(e) =>
                              updateRoom(room.key, { name: e.target.value })
                            }
                          />
                        </div>
                        {rooms.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRoom(room.key)}
                            aria-label={`Remove room ${roomIndex + 1}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRoom}
                    className="w-full"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    Add another room
                  </Button>
                </div>
              )}

              {currentStep.kind === 'room-beds' &&
                (() => {
                  const room = rooms[currentStep.roomIndex];
                  if (!room) return null;
                  return (
                    <div className="space-y-6">
                      <p className="text-sm text-muted-foreground">
                        How many guests can stay here, and what beds are in the
                        room?
                      </p>

                      <div className="space-y-2">
                        <Label>Sleeps</Label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() =>
                              updateRoom(room.key, {
                                max_occupancy: Math.max(1, room.max_occupancy - 1),
                              })
                            }
                            disabled={room.max_occupancy <= 1}
                          >
                            −
                          </Button>
                          <span className="w-6 text-center text-sm font-medium">
                            {room.max_occupancy}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() =>
                              updateRoom(room.key, {
                                max_occupancy: room.max_occupancy + 1,
                              })
                            }
                          >
                            +
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-baseline justify-between">
                          <Label>Beds</Label>
                          <span className="text-xs text-muted-foreground">
                            {summarizeBeds(room.beds)}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {room.beds.map((bed, bedIndex) => (
                            <div key={bedIndex} className="flex items-center gap-2">
                              <Select
                                value={bed}
                                onValueChange={(v) =>
                                  setBed(room.key, bedIndex, v as BedSize)
                                }
                              >
                                <SelectTrigger className="flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {BED_SIZES.map((size) => (
                                    <SelectItem key={size} value={size}>
                                      {BED_SIZE_LABELS[size]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeBed(room.key, bedIndex)}
                                disabled={room.beds.length === 1}
                                aria-label={`Remove bed ${bedIndex + 1}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addBed(room.key)}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add bed
                        </Button>
                      </div>
                    </div>
                  );
                })()}

              {currentStep.kind === 'room-amenities' &&
                (() => {
                  const room = rooms[currentStep.roomIndex];
                  if (!room) return null;
                  return (
                    <div className="space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Tap what this room offers.
                      </p>
                      <AmenityPills
                        value={room.amenities}
                        onChange={(next) =>
                          updateRoom(room.key, { amenities: next })
                        }
                        presets={ROOM_AMENITY_PRESETS}
                      />
                    </div>
                  );
                })()}

              {currentStep.kind === 'account' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-4">
                    <Home className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <p className="text-sm">
                      <span className="font-medium">{houseName || 'Your place'}</span>
                      {namedRoomCount > 0 && (
                        <span className="text-muted-foreground">
                          {' '}
                          · {namedRoomCount}{' '}
                          {namedRoomCount === 1 ? 'room' : 'rooms'}
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
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last name (optional)</Label>
                      <Input
                        id="last-name"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
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
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm password</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 space-y-5 px-6 pb-7 pt-2 sm:px-10">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-success transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              {current > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep(current - 1)}
                  disabled={loading}
                >
                  <ArrowLeft className="mr-1 h-4 w-4" />
                  Back
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                size="lg"
                onClick={isLast ? handleCreateAccount : handleNext}
                disabled={loading}
              >
                {isLast
                  ? loading
                    ? 'Creating account…'
                    : 'Create account'
                  : 'Next'}
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function AmenityPills({
  value,
  onChange,
  presets,
}: {
  value: Amenity[];
  onChange: (next: Amenity[]) => void;
  presets: string[];
}) {
  const selected = new Set(value.map((a) => a.key));

  function toggle(label: string) {
    const key = amenityKey(label);
    if (!key) return;
    if (selected.has(key)) {
      onChange(value.filter((a) => a.key !== key));
    } else {
      onChange([...value, { key, label, note: '' }]);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => {
        const key = amenityKey(preset);
        const isSelected = selected.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => toggle(preset)}
            aria-pressed={isSelected}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors',
              isSelected
                ? 'border-foreground bg-foreground text-background'
                : 'hover:bg-muted'
            )}
          >
            {isSelected ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {preset}
          </button>
        );
      })}
    </div>
  );
}

async function insertPropertyWithUniqueSlug(
  supabase: ReturnType<typeof createClient>,
  ownerId: string,
  details: {
    name: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    amenities: Amenity[];
  }
): Promise<string | null> {
  const base = slugify(details.name) || 'my-place';
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from('properties').insert({
      owner_id: ownerId,
      slug,
      ...details,
    });
    if (!error) return slug;
    // 23505 = unique_violation (slug already taken); retry with a suffix.
    if (error.code !== '23505') return null;
  }
  return null;
}
