'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  roomSchema,
  type RoomInput,
  BED_SIZES,
  BED_SIZE_LABELS,
} from '@/lib/validations';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { AmenitiesEditor } from '@/components/dashboard/amenities-editor';
import { ROOM_AMENITY_PRESETS } from '@/lib/amenities';
import { PhotoManager } from '@/components/dashboard/photo-manager';
import { DeleteRoomConfirm } from '@/components/dashboard/delete-room-button';
import type { Room, RoomImage } from '@/types/database';

type BedSize = (typeof BED_SIZES)[number];

export type RoomEditField =
  | 'name'
  | 'max_occupancy'
  | 'beds'
  | 'description'
  | 'amenities'
  | 'image';

const EMPTY_VALUES: RoomInput = {
  name: '',
  description: '',
  max_occupancy: 2,
  beds: ['queen'],
  amenities: [],
};

interface RoomEditDialogProps {
  /** Omit to create a new room. */
  room?: Room;
  images?: RoomImage[];
  /** Required when creating a new room. */
  propertyId?: string;
  /** display_order to assign a newly created room. */
  displayOrder?: number;
  /** When editing an existing room, enables delete with redirect after removal. */
  deleteRedirectTo?: string;
  fields: RoomEditField[];
  title: string;
  trigger: ReactNode;
}

function toFormValues(room: Room): RoomInput {
  return {
    name: room.name,
    description: room.description ?? '',
    max_occupancy: room.max_occupancy,
    beds:
      room.beds && room.beds.length > 0
        ? (room.beds as BedSize[])
        : (['queen'] as BedSize[]),
    amenities: room.amenities ?? [],
  };
}

export function RoomEditDialog({
  room,
  images = [],
  propertyId,
  displayOrder,
  deleteRedirectTo,
  fields,
  title,
  trigger,
}: RoomEditDialogProps) {
  const router = useRouter();
  const isCreate = !room;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteResetKey, setDeleteResetKey] = useState(0);

  const form = useForm<RoomInput>({
    resolver: zodResolver(roomSchema),
    defaultValues: room ? toFormValues(room) : EMPTY_VALUES,
  });

  const beds = form.watch('beds');

  const has = (f: RoomEditField) => fields.includes(f);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      form.reset(room ? toFormValues(room) : EMPTY_VALUES);
      setDeleteResetKey((k) => k + 1);
    }
  }

  function addBed() {
    form.setValue('beds', [...beds, 'queen'], { shouldValidate: true });
  }
  function removeBed(index: number) {
    form.setValue(
      'beds',
      beds.filter((_, i) => i !== index),
      { shouldValidate: true }
    );
  }
  function setBedSize(index: number, size: BedSize) {
    form.setValue(
      'beds',
      beds.map((b, i) => (i === index ? size : b)),
      { shouldValidate: true }
    );
  }

  async function onSubmit(values: RoomInput) {
    setLoading(true);
    const supabase = createClient();
    const { error } = room
      ? await supabase.from('rooms').update(values).eq('id', room.id)
      : await supabase.from('rooms').insert({
          ...values,
          property_id: propertyId,
          display_order: displayOrder ?? 0,
        });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(isCreate ? 'Room added' : 'Room updated');
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
            {has('image') && room && (
              <PhotoManager
                images={images}
                table="room_images"
                parentColumn="room_id"
                parentId={room.id}
                storagePrefix={`${room.property_id}/room-${room.id}-`}
                featuredTable="rooms"
                featuredColumn="image_url"
                featuredId={room.id}
              />
            )}

            {has('name') && (
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Master bedroom" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('max_occupancy') && (
              <FormField
                control={form.control}
                name="max_occupancy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Max occupancy</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {has('beds') && (
              <FormField
                control={form.control}
                name="beds"
                render={() => (
                  <FormItem>
                    <FormLabel>Beds</FormLabel>
                    <div className="space-y-2">
                      {beds.map((bed, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Select
                            value={bed}
                            onValueChange={(v) => setBedSize(i, v as BedSize)}
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
                            onClick={() => removeBed(i)}
                            disabled={beds.length === 1}
                            aria-label={`Remove bed ${i + 1}`}
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
                      onClick={addBed}
                      className="mt-2"
                    >
                      <Plus className="mr-1 h-4 w-4" />
                      Add bed
                    </Button>
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
                      <Textarea rows={5} {...field} />
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
                      presets={ROOM_AMENITY_PRESETS}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" disabled={loading}>
              {loading
                ? isCreate
                  ? 'Adding…'
                  : 'Saving…'
                : isCreate
                  ? 'Add room'
                  : 'Save changes'}
            </Button>

            {room && deleteRedirectTo && (
              <div className="border-t pt-6">
                <DeleteRoomConfirm
                  key={deleteResetKey}
                  roomId={room.id}
                  roomName={room.name}
                  redirectTo={deleteRedirectTo}
                  onDeleted={() => setOpen(false)}
                />
              </div>
            )}
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
