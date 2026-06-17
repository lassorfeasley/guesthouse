import {
  PROPERTY_NOTE_SECTION_LABELS,
  filterPropertyNotes,
} from '@/lib/property-notes';
import type { PropertyNote, PropertyNoteCategory } from '@/types/database';

interface PropertyNotesDisplayProps {
  notes: PropertyNote[];
  categories: PropertyNoteCategory[];
  /** Heading level for section titles (default h2). */
  headingAs?: 'h2' | 'h3';
  className?: string;
}

export function PropertyNotesDisplay({
  notes,
  categories,
  headingAs: Heading = 'h2',
  className,
}: PropertyNotesDisplayProps) {
  const filtered = filterPropertyNotes(notes, categories);
  const byCategory = categories
    .map((category) => ({
      category,
      items: filtered.filter((n) => n.category === category),
    }))
    .filter((section) => section.items.length > 0);

  if (byCategory.length === 0) return null;

  const sectionPad = Heading === 'h3' ? 'pt-4 first:pt-0' : 'py-10';
  const titleClass =
    Heading === 'h3'
      ? 'text-base font-semibold'
      : 'text-2xl font-semibold tracking-tight';

  return (
    <div className={className}>
      {byCategory.map(({ category, items }) => (
        <section key={category} className={sectionPad}>
          <Heading className={titleClass}>
            {PROPERTY_NOTE_SECTION_LABELS[category]}
          </Heading>
          <ul className="mt-6 list-disc space-y-2 pl-5 text-base leading-relaxed text-foreground/90">
            {items.map((note) => (
              <li key={note.id}>{note.body}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
