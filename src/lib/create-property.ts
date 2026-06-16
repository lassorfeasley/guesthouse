import type { SupabaseClient } from '@supabase/supabase-js';
import { slugify } from '@/lib/slug';
import type { Amenity } from '@/types/database';
import type { BED_SIZES } from '@/lib/validations';

export type WizardRoomInput = {
  name: string;
  max_occupancy: number;
  beds: (typeof BED_SIZES)[number][];
  amenities: Amenity[];
};

export type PropertySetupInput = {
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: Amenity[];
  rooms: WizardRoomInput[];
};

export async function insertPropertyWithUniqueSlug(
  supabase: SupabaseClient,
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
    const slug =
      attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const { error } = await supabase.from('properties').insert({
      owner_id: ownerId,
      slug,
      ...details,
    });
    if (!error) return slug;
    if (error.code !== '23505') return null;
  }
  return null;
}

export async function createPropertyWithRooms(
  supabase: SupabaseClient,
  ownerId: string,
  input: PropertySetupInput
): Promise<{ slug: string; error?: string } | { error: string }> {
  const slug = await insertPropertyWithUniqueSlug(supabase, ownerId, {
    name: input.name.trim(),
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    amenities: input.amenities,
  });

  if (!slug) {
    return { error: 'Could not create your home. Try a different name.' };
  }

  const namedRooms = input.rooms.filter((r) => r.name.trim());
  if (namedRooms.length === 0) return { slug };

  const { data: property } = await supabase
    .from('properties')
    .select('id')
    .eq('slug', slug)
    .single();

  if (!property) return { slug };

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
    return {
      slug,
      error: 'Your home was created, but some rooms could not be added.',
    };
  }

  return { slug };
}
