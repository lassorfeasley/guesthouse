'use client';

import { useState } from 'react';
import { ArrowLeft, Plus, Trash2, AlertCircle } from 'lucide-react';
import {
  BED_SIZES,
  BED_SIZE_LABELS,
} from '@/lib/validations';
import {
  HOME_AMENITY_PRESETS,
  ROOM_AMENITY_PRESETS,
} from '@/lib/amenities';
import { cn } from '@/lib/utils';
import type { Amenity } from '@/types/database';
import type { PropertySetupInput } from '@/lib/create-property';
import { AddressAutocomplete } from '@/components/dashboard/address-autocomplete';
import { LocationPicker } from '@/components/dashboard/location-picker';
import { AmenityPills } from '@/components/dashboard/amenity-pills';
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

type PropertyStep =
  | { kind: 'house' }
  | { kind: 'house-amenities' }
  | { kind: 'rooms' }
  | { kind: 'room-amenities'; roomKey: string; roomIndex: number };

type WizardStep = PropertyStep | { kind: 'account' };

function newRoom(): WizardRoom {
  return {
    key: crypto.randomUUID(),
    name: '',
    max_occupancy: 2,
    beds: ['queen'],
    amenities: [],
  };
}

function toPropertySetupInput(
  houseName: string,
  houseAddress: string,
  houseLat: number | null,
  houseLng: number | null,
  houseAmenities: Amenity[],
  rooms: WizardRoom[]
): PropertySetupInput {
  return {
    name: houseName.trim(),
    address: houseAddress.trim() || null,
    latitude: houseLat,
    longitude: houseLng,
    amenities: houseAmenities,
    rooms: rooms
      .filter((r) => r.name.trim())
      .map((r) => ({
        name: r.name.trim(),
        max_occupancy: r.max_occupancy,
        beds: r.beds,
        amenities: r.amenities,
      })),
  };
}

export type PropertySetupWizardProps = {
  includeAccountStep?: boolean;
  renderAccountStep?: (helpers: {
    clearError: () => void;
    propertyPreview: { name: string; roomCount: number };
  }) => React.ReactNode;
  onComplete: (data: PropertySetupInput) => Promise<string | void>;
  loading?: boolean;
  finalActionLabel: string;
  finalActionLoadingLabel: string;
};

export function PropertySetupWizard({
  includeAccountStep = false,
  renderAccountStep,
  onComplete,
  loading = false,
  finalActionLabel,
  finalActionLoadingLabel,
}: PropertySetupWizardProps) {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const [houseName, setHouseName] = useState('');
  const [houseAddress, setHouseAddress] = useState('');
  const [houseLat, setHouseLat] = useState<number | null>(null);
  const [houseLng, setHouseLng] = useState<number | null>(null);
  const [houseAmenities, setHouseAmenities] = useState<Amenity[]>([]);
  const [rooms, setRooms] = useState<WizardRoom[]>([newRoom()]);

  const propertySteps: PropertyStep[] = [
    { kind: 'house' },
    { kind: 'house-amenities' },
    { kind: 'rooms' },
    ...rooms.flatMap((r, i) => [
      { kind: 'room-amenities' as const, roomKey: r.key, roomIndex: i },
    ]),
  ];

  const steps: WizardStep[] = includeAccountStep
    ? [...propertySteps, { kind: 'account' }]
    : propertySteps;

  const current = Math.min(step, steps.length - 1);
  const currentStep = steps[current];
  const isLast = current === steps.length - 1;
  const progress = ((current + 1) / steps.length) * 100;

  const namedRoomCount = rooms.filter((r) => r.name.trim()).length;

  function stepTitle(s: WizardStep): string {
    switch (s.kind) {
      case 'house':
        return "What's your place called?";
      case 'house-amenities':
        return 'What does your place offer?';
      case 'rooms':
        return 'Add your rooms';
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
    setStepError(null);
    setRooms((prev) => [...prev, newRoom()]);
  }

  function removeRoom(key: string) {
    setStepError(null);
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

  function validateStep(s: WizardStep): string | null {
    if (s.kind === 'house' && !houseName.trim()) {
      return 'Give your place a name';
    }
    if (s.kind === 'rooms') {
      if (rooms.length === 0) {
        return 'Add at least one room';
      }
      if (rooms.some((r) => !r.name.trim())) {
        return 'Give each room a name, or remove it';
      }
    }
    return null;
  }

  async function handleNext() {
    const error = validateStep(currentStep);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);

    if (isLast) {
      const error = await onComplete(
        toPropertySetupInput(
          houseName,
          houseAddress,
          houseLat,
          houseLng,
          houseAmenities,
          rooms
        )
      );
      if (error) {
        setStepError(error);
      }
      return;
    }

    setStep(current + 1);
  }

  return (
    <div className="flex h-[min(82vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-10 sm:px-10">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {stepTitle(currentStep)}
        </h1>

        {stepError && (
          <div
            role="alert"
            className="mt-4 flex items-center gap-3 rounded-lg border border-destructive/50 bg-white px-4 py-3 text-sm text-foreground/75"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p>{stepError}</p>
          </div>
        )}

        <div className={cn('mt-8', stepError && 'mt-6')}>
          {currentStep.kind === 'house' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="house-name">Place name</Label>
                <Input
                  id="house-name"
                  autoFocus
                  placeholder="Lake House"
                  value={houseName}
                  onChange={(e) => {
                    setHouseName(e.target.value);
                    setStepError(null);
                  }}
                />
              </div>
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
            <AmenityPills
              value={houseAmenities}
              onChange={setHouseAmenities}
              presets={HOME_AMENITY_PRESETS}
            />
          )}

          {currentStep.kind === 'rooms' && (
            <div className="space-y-4">
              <div className="space-y-4">
                {rooms.map((room, roomIndex) => (
                  <div
                    key={room.key}
                    className="space-y-3 rounded-xl border border-border/60 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Label
                        htmlFor={`room-name-${room.key}`}
                        className="w-16 shrink-0"
                      >
                        Room {roomIndex + 1}
                      </Label>
                      <Input
                        id={`room-name-${room.key}`}
                        className="flex-1"
                        placeholder="Master bedroom"
                        value={room.name}
                        onChange={(e) => {
                          updateRoom(room.key, { name: e.target.value });
                          setStepError(null);
                        }}
                      />
                      {rooms.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => removeRoom(room.key)}
                          aria-label={`Remove room ${roomIndex + 1}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      ) : (
                        <span className="w-9 shrink-0" aria-hidden />
                      )}
                    </div>

                    <RoomBedsFields
                      room={room}
                      onUpdate={(patch) => updateRoom(room.key, patch)}
                      onAddBed={() => addBed(room.key)}
                      onSetBed={(index, size) => setBed(room.key, index, size)}
                      onRemoveBed={(index) => removeBed(room.key, index)}
                    />
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRoom}
                className="h-auto px-0 text-foreground/70 hover:bg-transparent hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
                Add another room
              </Button>
            </div>
          )}

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

          {currentStep.kind === 'account' &&
            renderAccountStep?.({
              clearError: () => setStepError(null),
              propertyPreview: {
                name: houseName,
                roomCount: namedRoomCount,
              },
            })}
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
              onClick={() => {
                setStepError(null);
                setStep(current - 1);
              }}
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
            onClick={handleNext}
            disabled={loading}
          >
            {loading
              ? finalActionLoadingLabel
              : isLast
                ? finalActionLabel
                : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RoomBedsFields({
  room,
  onUpdate,
  onAddBed,
  onSetBed,
  onRemoveBed,
}: {
  room: WizardRoom;
  onUpdate: (patch: Partial<WizardRoom>) => void;
  onAddBed: () => void;
  onSetBed: (index: number, size: BedSize) => void;
  onRemoveBed: (index: number) => void;
}) {
  const labelClass = 'w-16 shrink-0';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Label className={labelClass}>Sleeps</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() =>
              onUpdate({
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
              onUpdate({ max_occupancy: room.max_occupancy + 1 })
            }
          >
            +
          </Button>
        </div>
      </div>

      {room.beds.map((bed, bedIndex) => (
        <div key={bedIndex} className="flex items-center gap-3">
          {bedIndex === 0 ? (
            <Label className={labelClass}>Beds</Label>
          ) : (
            <span className={labelClass} aria-hidden />
          )}
          <Select
            value={bed}
            onValueChange={(v) => onSetBed(bedIndex, v as BedSize)}
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
          <div className="w-9 shrink-0">
            {bedIndex > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemoveBed(bedIndex)}
                aria-label={`Remove bed ${bedIndex + 1}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <span className={labelClass} aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddBed}
          className="h-auto px-0 text-foreground/70 hover:bg-transparent hover:text-foreground"
        >
          <Plus className="h-4 w-4" />
          Add bed
        </Button>
      </div>
    </div>
  );
}
