'use client';

import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AmenityPills } from '@/components/dashboard/amenity-pills';
import type { Amenity } from '@/types/database';

interface AmenitiesEditorProps {
  value: Amenity[];
  onChange: (next: Amenity[]) => void;
  presets: string[];
  notePlaceholder?: string;
}

export function AmenitiesEditor({
  value,
  onChange,
  presets,
  notePlaceholder = 'Add a note (optional)',
}: AmenitiesEditorProps) {
  function removeAmenity(key: string) {
    onChange(value.filter((a) => a.key !== key));
  }

  function setNote(key: string, note: string) {
    onChange(value.map((a) => (a.key === key ? { ...a, note } : a)));
  }

  return (
    <div className="space-y-4">
      <AmenityPills value={value} onChange={onChange} presets={presets} />

      {value.length > 0 && (
        <ul className="space-y-2 border-t pt-4">
          {value.map((amenity) => (
            <li
              key={amenity.key}
              className="flex items-center gap-2 rounded-md border p-2"
            >
              <div className="flex-1">
                <p className="text-sm font-medium">{amenity.label}</p>
                <Input
                  value={amenity.note}
                  onChange={(e) => setNote(amenity.key, e.target.value)}
                  placeholder={notePlaceholder}
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeAmenity(amenity.key)}
                aria-label={`Remove ${amenity.label}`}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
