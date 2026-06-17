'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { propertySchema, PROPERTY_DESCRIPTION_MAX_LENGTH, type PropertyInput } from '@/lib/validations';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { AmenitiesEditor } from '@/components/dashboard/amenities-editor';
import { HOME_AMENITY_PRESETS } from '@/lib/amenities';
import { AddressAutocomplete } from '@/components/dashboard/address-autocomplete';
import { LocationPicker } from '@/components/dashboard/location-picker';
import { PhotoManager } from '@/components/dashboard/photo-manager';
import type { Property, PropertyImage } from '@/types/database';

const US_TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'Mountain — no DST (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
] as const;

export type PropertyEditField =
  | 'name'
  | 'description'
  | 'image'
  | 'address'
  | 'amenities'
  | 'directions'
  | 'wifi'
  | 'check_in_instructions'
  | 'checkout_instructions'
  | 'checkout_time'
  | 'timezone'
  | 'house_rules';

interface PropertyEditDialogProps {
  property: Property;
  images?: PropertyImage[];
  fields: PropertyEditField[];
  title: string;
  trigger: ReactNode;
}

function toFormValues(property: Property): PropertyInput {
  return {
    name: property.name,
    slug: property.slug,
    description: property.description ?? '',
    address: property.address ?? '',
    directions: property.directions ?? '',
    wifi_name: property.wifi_name ?? '',
    wifi_password: property.wifi_password ?? '',
    house_rules: property.house_rules ?? '',
    check_in_instructions: property.check_in_instructions ?? '',
    checkout_instructions: property.checkout_instructions ?? '',
    checkout_time: property.checkout_time ?? '',
    timezone: property.timezone ?? 'America/Denver',
    latitude: property.latitude ?? null,
    longitude: property.longitude ?? null,
    amenities: property.amenities ?? [],
  };
}

export function PropertyEditDialog({
  property,
  images = [],
  fields,
  title,
  trigger,
}: PropertyEditDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<PropertyInput>({
    resolver: zodResolver(propertySchema),
    defaultValues: toFormValues(property),
  });

  const has = (f: PropertyEditField) => fields.includes(f);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) form.reset(toFormValues(property));
  }

  async function onSubmit(values: PropertyInput) {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from('properties')
      .update(values)
      .eq('id', property.id);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Saved');
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {has('image') && (
              <PhotoManager
                images={images}
                table="property_images"
                parentColumn="property_id"
                parentId={property.id}
                storagePrefix={`${property.id}/property-`}
                featuredTable="properties"
                featuredColumn="hero_image_url"
                featuredId={property.id}
              />
            )}

            {has('name') && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('description') && (
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={5}
                        maxLength={PROPERTY_DESCRIPTION_MAX_LENGTH}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-right text-xs text-muted-foreground">
                      {(field.value ?? '').length}/{PROPERTY_DESCRIPTION_MAX_LENGTH}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('address') && (
              <>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <AddressAutocomplete
                          {...field}
                          value={field.value ?? ''}
                          onPlaceSelect={(place) => {
                            form.setValue('latitude', place.latitude, {
                              shouldDirty: true,
                            });
                            form.setValue('longitude', place.longitude, {
                              shouldDirty: true,
                            });
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="space-y-1">
                  <Label>Location pin</Label>
                  <p className="text-sm text-muted-foreground">
                    Set the exact spot shown on the map. Use “Locate from
                    address” or drag the pin.
                  </p>
                  <LocationPicker
                    address={form.watch('address')}
                    latitude={form.watch('latitude')}
                    longitude={form.watch('longitude')}
                    onChange={(lat, lng) => {
                      form.setValue('latitude', lat, { shouldDirty: true });
                      form.setValue('longitude', lng, { shouldDirty: true });
                    }}
                    className="pt-1"
                  />
                </div>
              </>
            )}

            {has('check_in_instructions') && (
              <FormField
                control={form.control}
                name="check_in_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Check-in instructions</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('checkout_instructions') && (
              <FormField
                control={form.control}
                name="checkout_instructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Checkout instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="e.g. Strip the beds, start the dishwasher, drop keys in the lockbox."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('checkout_time') && (
              <FormField
                control={form.control}
                name="checkout_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Checkout time</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 11:00 AM" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('timezone') && (
              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property timezone</FormLabel>
                    <FormControl>
                      <select
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        {...field}
                      >
                        {US_TIMEZONES.map((tz) => (
                          <option key={tz.value} value={tz.value}>
                            {tz.label}
                          </option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('directions') && (
              <FormField
                control={form.control}
                name="directions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Directions</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('wifi') && (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="wifi_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WiFi network</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wifi_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WiFi password</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            {has('house_rules') && (
              <FormField
                control={form.control}
                name="house_rules"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>House rules</FormLabel>
                    <FormControl>
                      <Textarea rows={4} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('amenities') && (
              <FormField
                control={form.control}
                name="amenities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amenities</FormLabel>
                    <AmenitiesEditor
                      value={field.value}
                      onChange={field.onChange}
                      presets={HOME_AMENITY_PRESETS}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : 'Save changes'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
