import type { PropertyNote, PropertyNoteCategory } from '@/types/database';

export const PROPERTY_NOTE_CATEGORIES = [
  'house',
  'checkin',
  'checkout',
] as const;

export const PROPERTY_NOTE_MAX_LENGTH = 200;
export const PROPERTY_NOTES_MAX_PER_CATEGORY = 5;

export const PROPERTY_NOTE_SECTION_LABELS: Record<PropertyNoteCategory, string> = {
  house: 'House notes',
  checkin: 'Arrival',
  checkout: 'Before you go',
};

export function sortPropertyNotes(notes: PropertyNote[]): PropertyNote[] {
  return [...notes].sort(
    (a, b) =>
      a.display_order - b.display_order ||
      a.created_at.localeCompare(b.created_at)
  );
}

export function groupPropertyNotesByCategory(
  notes: PropertyNote[]
): Record<PropertyNoteCategory, PropertyNote[]> {
  const grouped: Record<PropertyNoteCategory, PropertyNote[]> = {
    house: [],
    checkin: [],
    checkout: [],
  };

  for (const note of sortPropertyNotes(notes)) {
    grouped[note.category].push(note);
  }

  return grouped;
}

export function filterPropertyNotes(
  notes: PropertyNote[],
  categories: PropertyNoteCategory[]
): PropertyNote[] {
  const allowed = new Set(categories);
  return sortPropertyNotes(notes).filter((n) => allowed.has(n.category));
}
