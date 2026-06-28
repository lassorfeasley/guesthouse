import { Check, Navigation } from 'lucide-react';
import { PropertyMap } from '@/components/dashboard/property-map';
import { DirectionsDialog } from '@/components/directions-dialog';
import { PropertyNotesDisplay } from '@/components/property-notes-display';
import { ExpandableText } from '@/components/expandable-text';
import { Button } from '@/components/ui/button';
import type { Property, PropertyNoteCategory } from '@/types/database';

/**
 * Read-only property detail sections (About / Location / Amenities / Guest info)
 * shared by the guest invite page and the host manage-visit view. Each section
 * is hidden when its data is empty.
 */
export function PropertySections({
  property,
  noteCategories,
  showWifi = false,
  audience = 'guest',
}: {
  property: Property;
  noteCategories?: PropertyNoteCategory[];
  /** WiFi and other access details — only after a visit is approved. */
  showWifi?: boolean;
  /** Flips guest-addressed copy ("staying") to host copy ("hosting"). */
  audience?: 'guest' | 'host';
}) {
  const notes = property.property_notes ?? [];

  return (
    <>
      {property.description && (
        <section className="py-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            About this place
          </h2>
          <ExpandableText
            text={property.description}
            className="mt-6 whitespace-pre-wrap text-lg leading-relaxed text-foreground/90"
          />
        </section>
      )}

      {property.address && (
        <section className="py-10">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">
              {audience === 'host'
                ? "Where you're hosting"
                : "Where you're staying"}
            </h2>
            <DirectionsDialog
              address={property.address}
              latitude={property.latitude}
              longitude={property.longitude}
            >
              <Button variant="outline" size="sm">
                <Navigation />
                Directions
              </Button>
            </DirectionsDialog>
          </div>
          <div className="mt-6">
            <PropertyMap
              address={property.address}
              latitude={property.latitude}
              longitude={property.longitude}
            />
          </div>
          {property.directions && (
            <div className="mt-8">
              <h3 className="text-lg font-medium">Getting there</h3>
              <p className="mt-2 whitespace-pre-wrap text-base text-muted-foreground">
                {property.directions}
              </p>
            </div>
          )}
        </section>
      )}

      {property.amenities && property.amenities.length > 0 && (
        <section className="py-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            {audience === 'host'
              ? 'What your place offers'
              : 'What this place offers'}
          </h2>
          <ul className="mt-8 grid gap-x-12 gap-y-5 sm:grid-cols-2">
            {property.amenities.map((a) => (
              <li
                key={a.key}
                className="flex items-start gap-4 border-b border-border/60 pb-5 text-base"
              >
                <Check
                  className="mt-0.5 h-5 w-5 shrink-0 text-foreground"
                  strokeWidth={1.5}
                />
                <span>
                  {a.label}
                  {a.note ? (
                    <span className="block text-sm text-muted-foreground">
                      {a.note}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {noteCategories && noteCategories.length > 0 && (
        <PropertyNotesDisplay notes={notes} categories={noteCategories} />
      )}

      {showWifi && property.wifi_name && (
        <section className="py-10">
          <h2 className="text-2xl font-semibold tracking-tight">
            WiFi
          </h2>
          <p className="mt-6 text-base text-muted-foreground">
            {property.wifi_name}
            {property.wifi_password ? ` · ${property.wifi_password}` : ''}
          </p>
        </section>
      )}
    </>
  );
}
