'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  PROPERTY_NOTE_SECTION_LABELS,
  PROPERTY_NOTES_MAX_PER_CATEGORY,
  groupPropertyNotesByCategory,
  sortPropertyNotes,
} from '@/lib/property-notes';
import {
  PROPERTY_NOTE_MAX_LENGTH,
  propertyNoteBodySchema,
} from '@/lib/validations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { PropertyEditDialog } from '@/components/dashboard/property-edit-dialog';
import { toast } from 'sonner';
import type { Property, PropertyNote, PropertyNoteCategory } from '@/types/database';

function NoteRow({
  note,
  index,
  total,
  onMoveUp,
  onMoveDown,
  onSave,
  onDelete,
}: {
  note: PropertyNote;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSave: (body: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) setDraft(note.body);
  }, [note.body, editing]);

  async function handleSave() {
    const parsed = propertyNoteBodySchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid note');
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed.data);
      setEditing(false);
      toast.success('Note updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save note');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      await onDelete();
      toast.success('Note removed');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove note');
    }
  }

  if (editing) {
    return (
      <li className="rounded-md border p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={PROPERTY_NOTE_MAX_LENGTH}
          autoFocus
        />
        <p className="mt-1 text-right text-xs text-muted-foreground">
          {draft.length}/{PROPERTY_NOTE_MAX_LENGTH}
        </p>
        <div className="mt-2 flex gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            Save
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setDraft(note.body);
              setEditing(false);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-md border px-3 py-2">
      <div className="flex shrink-0 flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={index === 0}
          onClick={onMoveUp}
          aria-label="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          disabled={index === total - 1}
          onClick={onMoveDown}
          aria-label="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </div>
      <p className="flex-1 text-sm">{note.body}</p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => setEditing(true)}
        aria-label="Edit note"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={() => void handleDelete()}
        aria-label="Delete note"
      >
        <Trash2 className="h-3.5 w-3.5 text-destructive" />
      </Button>
    </li>
  );
}

export function PropertyNotesCategoryEditor({
  propertyId,
  category,
  notes,
  onNotesChange,
}: {
  propertyId: string;
  category: PropertyNoteCategory;
  notes: PropertyNote[];
  onNotesChange: (next: PropertyNote[]) => void;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);
  const atLimit = notes.length >= PROPERTY_NOTES_MAX_PER_CATEGORY;

  async function persistOrder(nextNotes: PropertyNote[]) {
    const supabase = createClient();
    for (const note of nextNotes) {
      const { error } = await supabase
        .from('property_notes')
        .update({ display_order: note.display_order })
        .eq('id', note.id);
      if (error) throw error;
    }
    onNotesChange(nextNotes);
    router.refresh();
  }

  async function handleAdd() {
    const parsed = propertyNoteBodySchema.safeParse(draft);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? 'Invalid note');
      return;
    }
    if (atLimit) return;

    setAdding(true);
    const supabase = createClient();
    const displayOrder =
      notes.length === 0
        ? 0
        : Math.max(...notes.map((n) => n.display_order)) + 1;

    const { data, error } = await supabase
      .from('property_notes')
      .insert({
        property_id: propertyId,
        category,
        body: parsed.data,
        display_order: displayOrder,
      })
      .select()
      .single();

    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }

    onNotesChange(sortPropertyNotes([...notes, data as PropertyNote]));
    setDraft('');
    toast.success('Note added');
    router.refresh();
  }

  async function handleSave(noteId: string, body: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('property_notes')
      .update({ body })
      .eq('id', noteId)
      .select()
      .single();
    if (error) throw error;
    onNotesChange(
      notes.map((n) => (n.id === noteId ? (data as PropertyNote) : n))
    );
    router.refresh();
  }

  async function handleDelete(noteId: string) {
    const supabase = createClient();
    const { error } = await supabase
      .from('property_notes')
      .delete()
      .eq('id', noteId);
    if (error) throw error;
    onNotesChange(notes.filter((n) => n.id !== noteId));
    router.refresh();
  }

  function swapOrder(indexA: number, indexB: number) {
    const sorted = sortPropertyNotes(notes);
    const next = [...sorted];
    [next[indexA], next[indexB]] = [next[indexB], next[indexA]];
    const withOrders = next.map((n, i) => ({ ...n, display_order: i }));
    void persistOrder(withOrders).catch((err) =>
      toast.error(err instanceof Error ? err.message : 'Could not reorder')
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Short notes guests will see before or during their stay. Up to{' '}
        {PROPERTY_NOTES_MAX_PER_CATEGORY} per section,{' '}
        {PROPERTY_NOTE_MAX_LENGTH} characters each.
      </p>

      {notes.length > 0 ? (
        <ul className="space-y-2">
          {sortPropertyNotes(notes).map((note, index) => (
            <NoteRow
              key={note.id}
              note={note}
              index={index}
              total={notes.length}
              onMoveUp={() => swapOrder(index, index - 1)}
              onMoveDown={() => swapOrder(index, index + 1)}
              onSave={(body) => handleSave(note.id, body)}
              onDelete={() => handleDelete(note.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      )}

      <div className="space-y-1">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a short note…"
            maxLength={PROPERTY_NOTE_MAX_LENGTH}
            disabled={atLimit || adding}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <Button
            type="button"
            variant="outline"
            className="shrink-0"
            disabled={atLimit || adding || !draft.trim()}
            onClick={() => void handleAdd()}
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Add note</span>
          </Button>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {notes.length} of {PROPERTY_NOTES_MAX_PER_CATEGORY} notes
          </span>
          <span>
            {draft.length}/{PROPERTY_NOTE_MAX_LENGTH}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PropertyNotesEditDialog({
  propertyId,
  category,
  notes: initialNotes,
  trigger,
}: {
  propertyId: string;
  category: PropertyNoteCategory;
  notes: PropertyNote[];
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(() => sortPropertyNotes(initialNotes));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) setNotes(sortPropertyNotes(initialNotes));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{PROPERTY_NOTE_SECTION_LABELS[category]}</DialogTitle>
        </DialogHeader>
        <PropertyNotesCategoryEditor
          propertyId={propertyId}
          category={category}
          notes={notes}
          onNotesChange={setNotes}
        />
      </DialogContent>
    </Dialog>
  );
}

function NotesSummary({ notes }: { notes: PropertyNote[] }) {
  const sorted = sortPropertyNotes(notes);
  if (sorted.length === 0) {
    return <p className="mt-2 text-base text-muted-foreground">Not set</p>;
  }
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5 text-base text-muted-foreground">
      {sorted.map((note) => (
        <li key={note.id}>{note.body}</li>
      ))}
    </ul>
  );
}

const NOTE_CATEGORIES: PropertyNoteCategory[] = [
  'house',
  'checkin',
  'checkout',
];

export function GuestInformationSection({
  property,
  notes: initialNotes,
}: {
  property: Property;
  notes: PropertyNote[];
}) {
  const grouped = groupPropertyNotesByCategory(initialNotes);

  return (
    <section id="guest-info" className="scroll-mt-28 py-10">
      <h2 className="text-2xl font-semibold tracking-tight">Guest information</h2>
      <dl className="mt-8 grid gap-8 sm:grid-cols-2">
        {NOTE_CATEGORIES.map((category) => (
          <div key={category}>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-base font-medium">
                {PROPERTY_NOTE_SECTION_LABELS[category]}
              </dt>
              <PropertyNotesEditDialog
                propertyId={property.id}
                category={category}
                notes={grouped[category]}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Edit ${PROPERTY_NOTE_SECTION_LABELS[category].toLowerCase()}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
            <dd>
              <NotesSummary notes={grouped[category]} />
            </dd>
          </div>
        ))}

        <div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-base font-medium">Checkout time</dt>
            <PropertyEditDialog
              property={property}
              fields={['checkout_time']}
              title="Edit checkout time"
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Edit checkout time"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
          </div>
          <dd className="mt-2 text-base text-muted-foreground">
            {property.checkout_time || 'Not set'}
          </dd>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-base font-medium">WiFi</dt>
            <PropertyEditDialog
              property={property}
              fields={['wifi']}
              title="Edit WiFi"
              trigger={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Edit WiFi"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              }
            />
          </div>
          <dd className="mt-2 text-base text-muted-foreground">
            {property.wifi_name ? (
              <>
                {property.wifi_name}
                {property.wifi_password ? ` · ${property.wifi_password}` : ''}
              </>
            ) : (
              'Not set'
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
