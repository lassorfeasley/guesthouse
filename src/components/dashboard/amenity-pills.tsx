'use client';

import { useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { amenityKey } from '@/lib/amenities';
import type { Amenity } from '@/types/database';

interface AmenityPillsProps {
  value: Amenity[];
  onChange: (next: Amenity[]) => void;
  presets: string[];
}

export function AmenityPills({ value, onChange, presets }: AmenityPillsProps) {
  const [customInput, setCustomInput] = useState('');
  const selected = new Set(value.map((a) => a.key));
  const presetKeys = new Set(presets.map(amenityKey));
  const customAmenities = value.filter((a) => !presetKeys.has(a.key));

  function addAmenity(label: string) {
    const trimmed = label.trim();
    const key = amenityKey(trimmed);
    if (!key || selected.has(key)) {
      setCustomInput('');
      return;
    }
    onChange([...value, { key, label: trimmed, note: '' }]);
    setCustomInput('');
  }

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
    <div className="space-y-3">
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
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-foreground/30 bg-background text-foreground shadow-xs hover:border-foreground/45 hover:bg-muted/60'
              )}
            >
              {isSelected ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5 text-foreground/65" />
              )}
              {preset}
            </button>
          );
        })}
        {customAmenities.map((amenity) => (
          <button
            key={amenity.key}
            type="button"
            onClick={() => toggle(amenity.label)}
            aria-pressed
            className="inline-flex items-center gap-1.5 rounded-full border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            {amenity.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add your own…"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addAmenity(customInput);
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          className="shrink-0 font-medium"
          onClick={() => addAmenity(customInput)}
          disabled={!customInput.trim()}
        >
          Add
        </Button>
      </div>
    </div>
  );
}
