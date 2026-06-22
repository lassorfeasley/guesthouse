'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { ArrowLeft, Check, CalendarIcon, Plus, Minus, X } from 'lucide-react';
import { invitationSchema, type InvitationInput } from '@/lib/validations';
import { formatDate, formatDateRange } from '@/lib/dates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectableRoomCard } from '@/components/room-card';
import {
  AvailabilityCalendar,
  type CalendarSelection,
  type DateField,
} from '@/components/dashboard/availability-calendar';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { SurveyDialogLayout } from '@/components/dashboard/survey-dialog-layout';
import { ManualStaySurvey } from '@/components/dashboard/host-visit-dialog';
import { GuestCombobox } from '@/components/dashboard/guest-combobox';
import { VisitProvider, useOptionalVisit } from '@/components/guest/visit-context';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';
import type { RoomAvailability } from '@/lib/guest-calendar';
import type { Room } from '@/types/database';
import { cn } from '@/lib/utils';
import {
  INVITATION_TYPE_LABELS,
  INVITATION_TYPE_OPTIONS,
} from '@/lib/invitation-types';
import { guestProfileHref } from '@/lib/guest-keys';

interface InviteGuestDialogProps {
  propertyId: string;
  rooms: Room[];
  roomAvailability?: Record<string, RoomAvailability>;
  preselectedRoomIds?: string[];
  /** When true, manual stay uses the surrounding VisitProvider. */
  useParentVisitContext?: boolean;
  trigger?: ReactNode;
}

type StepKey = 'guest' | 'type' | 'dates' | 'rooms' | 'details' | 'review';

const STEP_TITLES: Record<StepKey, string> = {
  guest: 'Who are you inviting?',
  type: 'What kind of invitation?',
  dates: 'When can they come?',
  rooms: 'Which rooms can they request?',
  details: 'Add a personal touch',
  review: 'Review and send',
};

export function InviteGuestDialog({
  propertyId,
  rooms,
  roomAvailability = {},
  preselectedRoomIds,
  useParentVisitContext = false,
  trigger,
}: InviteGuestDialogProps) {
  const router = useRouter();
  const params = useParams();
  const propertySlug = typeof params.slug === 'string' ? params.slug : undefined;
  const parentBooking = useOptionalVisit();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'invite' | 'manual'>('invite');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [windows, setWindows] = useState<{ start_date: string; end_date: string }[]>(
    []
  );
  const [dateSelection, setDateSelection] = useState<CalendarSelection>({
    checkIn: null,
    checkOut: null,
  });
  const [dateField, setDateField] = useState<DateField | null>(null);

  const defaultRoomIds = (preselectedRoomIds ?? []).filter((id) =>
    rooms.some((r) => r.id === id)
  );

  const form = useForm<InvitationInput>({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      guest_email: '',
      guest_first_name: '',
      guest_last_name: '',
      relationship: '',
      type: 'standing',
      requires_approval: false,
      whole_home: false,
      message: '',
      room_ids: defaultRoomIds.length > 0 ? defaultRoomIds : rooms.map((r) => r.id),
      pre_approved: false,
      party_size: 1,
    },
  });

  const invType = form.watch('type');
  const values = form.watch();
  const preApproved = invType === 'prix_fixe' && values.pre_approved === true;
  const selectedMaxOcc = rooms
    .filter((r) => values.room_ids?.includes(r.id))
    .reduce((sum, r) => sum + r.max_occupancy, 0);

  // "Already confirmed" is the pre-approved direct-visit path surfaced as a
  // first-class choice. Under the hood it's a fixed-date stay booked on the
  // guest's behalf — no acceptance step.
  const KIND_OPTIONS = [
    ...INVITATION_TYPE_OPTIONS,
    {
      value: 'confirmed',
      label: 'Already confirmed',
      description:
        'You confirmed this stay outside Gracious — confirm it now and we’ll notify the guest. No acceptance needed.',
    },
  ];
  const selectedKind = preApproved ? 'confirmed' : invType;

  function selectKind(value: string) {
    if (value === 'confirmed') {
      form.setValue('type', 'prix_fixe');
      form.setValue('pre_approved', true);
      form.setValue('requires_approval', false);
    } else {
      form.setValue('type', value as InvitationInput['type']);
      form.setValue('pre_approved', false);
    }
  }

  const steps = useMemo((): StepKey[] => {
    const base: StepKey[] = ['guest', 'type'];
    if (invType !== 'standing') base.push('dates');
    base.push('rooms', 'details', 'review');
    return base;
  }, [invType]);

  const current = Math.min(step, steps.length - 1);
  const stepKey = steps[current];
  const isLast = current === steps.length - 1;

  useEffect(() => {
    if (step >= steps.length) {
      setStep(Math.max(0, steps.length - 1));
    }
  }, [step, steps.length]);

  function resetForm() {
    form.reset({
      guest_email: '',
      guest_first_name: '',
      guest_last_name: '',
      relationship: '',
      type: 'standing',
      requires_approval: false,
      whole_home: false,
      message: '',
      room_ids:
        defaultRoomIds.length > 0 ? defaultRoomIds : rooms.map((r) => r.id),
      pre_approved: false,
      party_size: 1,
    });
    setWindows([]);
    setDateSelection({ checkIn: null, checkOut: null });
    setDateField(null);
    setStep(0);
    setMode('invite');
  }

  function collectWindows() {
    if (invType === 'prix_fixe') {
      return dateSelection.checkIn && dateSelection.checkOut
        ? [{ start_date: dateSelection.checkIn, end_date: dateSelection.checkOut }]
        : [];
    }
    const added = windows.filter((w) => w.start_date && w.end_date);
    if (dateSelection.checkIn && dateSelection.checkOut) {
      added.push({
        start_date: dateSelection.checkIn,
        end_date: dateSelection.checkOut,
      });
    }
    return added;
  }

  function addWindow() {
    if (!dateSelection.checkIn || !dateSelection.checkOut) return;
    setWindows((prev) => [
      ...prev.filter((w) => w.start_date && w.end_date),
      { start_date: dateSelection.checkIn!, end_date: dateSelection.checkOut! },
    ]);
    setDateSelection({ checkIn: null, checkOut: null });
    setDateField('checkIn');
  }

  function removeWindow(index: number) {
    setWindows((prev) => prev.filter((_, i) => i !== index));
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      resetForm();
      // Carry over any dates the host already picked in the page sidebar.
      const pre = useParentVisitContext ? parentBooking : null;
      if (pre?.checkIn && pre?.checkOut) {
        setDateSelection({ checkIn: pre.checkIn, checkOut: pre.checkOut });
        form.setValue('type', 'prix_fixe');
      }
    } else {
      setMode('invite');
    }
  }

  const requestableRooms = rooms.map((r) => ({
    id: r.id,
    name: r.name,
    max_occupancy: r.max_occupancy,
  }));

  const manualSurvey = (
    <ManualStaySurvey
      propertyId={propertyId}
      onClose={() => setOpen(false)}
      onBackFromStart={() => setMode('invite')}
    />
  );

  function toggleRoom(roomId: string) {
    const value = form.getValues('room_ids');
    if (value.includes(roomId)) {
      form.setValue(
        'room_ids',
        value.filter((id) => id !== roomId),
        { shouldValidate: true }
      );
    } else {
      form.setValue('room_ids', [...value, roomId], { shouldValidate: true });
    }
  }

  function setWholeHome(on: boolean) {
    form.setValue('whole_home', on);
    if (on) {
      form.setValue(
        'room_ids',
        rooms.map((r) => r.id),
        { shouldValidate: true }
      );
    }
  }

  async function validateCurrentStep(): Promise<boolean> {
    if (stepKey === 'guest') {
      return form.trigger('guest_email');
    }
    if (stepKey === 'dates') {
      if (collectWindows().length === 0) {
        toast.error(
          invType === 'prix_fixe'
            ? 'Select the stay dates'
            : 'Add at least one date range'
        );
        return false;
      }
      return true;
    }
    if (stepKey === 'rooms') {
      return form.trigger('room_ids');
    }
    return true;
  }

  async function handleNext() {
    if (!isLast) {
      const ok = await validateCurrentStep();
      if (!ok) return;
      setStep(current + 1);
      return;
    }
    await form.handleSubmit(onSubmit)();
  }

  async function onSubmit(formValues: InvitationInput) {
    const validWindows = collectWindows();

    if (formValues.type !== 'standing' && validWindows.length === 0) {
      toast.error('Add at least one date window');
      return;
    }

    const confirmDirectly = formValues.type === 'prix_fixe' && preApproved;

    setLoading(true);
    const payload = {
      property_id: propertyId,
      ...formValues,
      requires_approval: confirmDirectly ? false : formValues.requires_approval,
      pre_approved: confirmDirectly,
      party_size: confirmDirectly ? formValues.party_size : undefined,
      windows: formValues.type !== 'standing' ? validWindows : undefined,
    };

    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setLoading(false);

    const data = await res.json();

    if (!res.ok) {
      if (data.error === 'limit_reached') {
        toast.error(
          "You've reached your hosted-stay limit. Upgrade your plan to host more visits."
        );
        return;
      }
      toast.error(
        typeof data.error === 'string'
          ? data.error
          : confirmDirectly
            ? 'Failed to confirm the stay'
            : 'Failed to create invitation'
      );
      return;
    }

    if (data.preApproved) {
      toast.success('Visit confirmed — your guest has been notified.');
    } else if (data.emailSent === false) {
      toast.warning(
        'Invitation created, but the email could not be sent. Copy the link to share it manually.'
      );
    } else {
      toast.success('Invitation sent!');
    }
    setOpen(false);
    resetForm();
    if (!data.preApproved && data.invitation?.token) {
      router.push(`/invite/${data.invitation.token}?invited=1`);
    } else if (propertySlug) {
      router.push(guestProfileHref(propertySlug, formValues.guest_email));
    }
    router.refresh();
  }

  const roomLabels = rooms
    .filter((r) => values.room_ids?.includes(r.id))
    .map((r) => r.name)
    .join(', ');

  const validWindows = collectWindows();

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" disabled={rooms.length === 0}>
            <UserPlus className="mr-1 h-4 w-4" />
            Invite a guest
          </Button>
        )}
      </DialogTrigger>

      {open &&
        mode === 'manual' &&
        (useParentVisitContext ? (
          manualSurvey
        ) : (
          <VisitProvider
            rooms={requestableRooms}
            roomAvailability={roomAvailability}
            defaultGuests={1}
            defaultSelectedRoomIds={
              defaultRoomIds.length > 0
                ? defaultRoomIds
                : requestableRooms.map((r) => r.id)
            }
          >
            {manualSurvey}
          </VisitProvider>
        ))}

      {open && mode === 'invite' && (
      <SurveyDialogLayout
        title="Invite a guest"
        stepIndex={current}
        stepCount={steps.length}
        stepTitle={
          preApproved && stepKey === 'dates'
            ? 'When is the stay?'
            : preApproved && stepKey === 'rooms'
              ? 'Which rooms are confirmed?'
              : STEP_TITLES[stepKey]
        }
        onBack={current > 0 ? () => setStep(current - 1) : undefined}
        onNext={handleNext}
        nextLabel={
          isLast
            ? preApproved
              ? loading
                ? 'Visit…'
                : 'Confirm visit'
              : loading
                ? 'Sending…'
                : 'Send invitation'
            : 'Next'
        }
        loading={loading}
      >
        <Form {...form}>
          {stepKey === 'guest' && (
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="guest_email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Guest email</FormLabel>
                    <FormControl>
                      <GuestCombobox
                        propertyId={propertyId}
                        value={field.value}
                        autoFocus
                        onEmailChange={field.onChange}
                        onPickGuest={(g) => {
                          if (g.firstName)
                            form.setValue('guest_first_name', g.firstName);
                          if (g.lastName)
                            form.setValue('guest_last_name', g.lastName);
                          if (g.relationship)
                            form.setValue('relationship', g.relationship);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <p className="text-sm text-muted-foreground">
                Guest doesn&apos;t have an email?{' '}
                <button
                  type="button"
                  onClick={() => setMode('manual')}
                  className="font-medium text-foreground underline underline-offset-2"
                >
                  Add a manual stay instead
                </button>
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="guest_first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="guest_last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name (optional)</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="relationship"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Relationship (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. College friend, Aunt, Coworker"
                        {...field}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      How you know them — shown on their guest profile.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {stepKey === 'type' && (
            <div className="space-y-3">
              {KIND_OPTIONS.map((opt) => {
                const selected = selectedKind === opt.value;
                return (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => selectKind(opt.value)}
                    className={cn(
                      'flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors',
                      selected
                        ? 'border-foreground ring-1 ring-foreground'
                        : 'hover:bg-muted'
                    )}
                  >
                    <div>
                      <p className="font-medium">{opt.label}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {opt.description}
                      </p>
                    </div>
                    {selected && <Check className="h-5 w-5 shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {stepKey === 'dates' && (
            <div className="space-y-6">
              <p className="text-sm text-muted-foreground">
                {invType === 'prix_fixe'
                  ? 'Select the exact dates of the stay.'
                  : 'Select one or more date ranges they can request within.'}
              </p>

              <AvailabilityCalendar
                visits={[]}
                monthsToShow={2}
                selectable
                value={dateSelection}
                onChange={setDateSelection}
                activeField={dateField}
                onActiveFieldChange={setDateField}
              />

              {dateSelection.checkIn && (
                <div className="flex items-center justify-between gap-3 rounded-xl border p-4 text-sm">
                  <span className="font-medium">
                    {dateSelection.checkOut
                      ? formatDateRange(
                          dateSelection.checkIn,
                          dateSelection.checkOut
                        )
                      : `${formatDate(dateSelection.checkIn)} — pick a checkout date`}
                  </span>
                  {invType === 'date_offer' &&
                    dateSelection.checkIn &&
                    dateSelection.checkOut && (
                      <Button type="button" size="sm" onClick={addWindow}>
                        <Plus className="mr-1 h-4 w-4" />
                        Add window
                      </Button>
                    )}
                </div>
              )}

              {invType === 'date_offer' &&
                windows.filter((w) => w.start_date && w.end_date).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Offered windows
                    </p>
                    {windows
                      .filter((w) => w.start_date && w.end_date)
                      .map((w, i) => (
                        <div
                          key={`${w.start_date}-${w.end_date}-${i}`}
                          className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                        >
                          <span className="font-medium">
                            {formatDateRange(w.start_date, w.end_date)}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeWindow(i)}
                            className="text-muted-foreground transition-colors hover:text-foreground"
                            aria-label="Remove window"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
            </div>
          )}

          {stepKey === 'rooms' && (
            <div className="space-y-4">
              {rooms.length > 1 && (
                <div className="flex items-center justify-between gap-4 border-b pb-5">
                  <div>
                    <p className="font-medium">Entire home only</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Guests request the whole place — they can&apos;t pick
                      individual rooms.
                    </p>
                  </div>
                  <Switch
                    checked={values.whole_home ?? false}
                    onCheckedChange={setWholeHome}
                    className="shrink-0"
                  />
                </div>
              )}
              {!values.whole_home && (
                <div className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
                  {rooms.map((room) => {
                    const selected = values.room_ids.includes(room.id);
                    return (
                      <SelectableRoomCard
                        key={room.id}
                        room={room}
                        selected={selected}
                        onToggle={() => toggleRoom(room.id)}
                      />
                    );
                  })}
                </div>
              )}
              {form.formState.errors.room_ids && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.room_ids.message}
                </p>
              )}
            </div>
          )}

          {stepKey === 'details' && (
            <div className="space-y-4">
              {preApproved && (
                <FormField
                  control={form.control}
                  name="party_size"
                  render={({ field }) => {
                    const count = field.value ?? 1;
                    const max = selectedMaxOcc || undefined;
                    return (
                      <FormItem className="flex flex-row items-center justify-between gap-4 rounded-xl border p-4">
                        <div className="space-y-1">
                          <FormLabel className="text-base">Guests</FormLabel>
                          <p className="text-sm text-muted-foreground">
                            How many people are staying
                            {max ? ` (up to ${max})` : ''}.
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={count <= 1}
                            onClick={() => field.onChange(Math.max(1, count - 1))}
                            aria-label="Fewer guests"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-6 text-center font-medium tabular-nums">
                            {count}
                          </span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            disabled={max ? count >= max : false}
                            onClick={() =>
                              field.onChange(max ? Math.min(max, count + 1) : count + 1)
                            }
                            aria-label="More guests"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </FormItem>
                    );
                  }}
                />
              )}

              {!preApproved && (
                <FormField
                  control={form.control}
                  name="requires_approval"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start justify-between gap-4 rounded-xl border p-4">
                      <div className="space-y-1">
                        <FormLabel className="text-base">
                          Require host approval
                        </FormLabel>
                        <p className="text-sm text-muted-foreground">
                          {field.value
                            ? 'Guests submit a request; you approve or decline.'
                            : 'Visits are confirmed immediately.'}
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal message (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Can't wait to host you!"
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      {preApproved
                        ? 'Included in the confirmation email we send your guest.'
                        : 'Included in the invitation email.'}
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!preApproved && (
              <FormField
                control={form.control}
                name="expires_at"
                render={({ field }) => {
                  const selected = field.value
                    ? new Date(field.value)
                    : undefined;
                  return (
                    <FormItem className="flex flex-col">
                      <FormLabel>Invitation expires (optional)</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                'justify-start text-left font-normal',
                                !selected && 'text-muted-foreground'
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selected
                                ? format(selected, 'PPP')
                                : 'No expiration'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={selected}
                            onSelect={(d) => {
                              if (!d) {
                                field.onChange('');
                                return;
                              }
                              const end = new Date(d);
                              end.setHours(23, 59, 59, 0);
                              field.onChange(end.toISOString());
                            }}
                            disabled={{ before: new Date() }}
                            autoFocus
                          />
                          {selected && (
                            <div className="border-t p-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full"
                                onClick={() => field.onChange('')}
                              >
                                Clear date
                              </Button>
                            </div>
                          )}
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
              )}
            </div>
          )}

          {stepKey === 'review' && (
            <dl className="space-y-4 text-sm">
              <div className="rounded-xl border p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Guest
                </dt>
                <dd className="mt-1 font-medium">
                  {[values.guest_first_name, values.guest_last_name]
                    .filter(Boolean)
                    .join(' ') || values.guest_email}
                </dd>
                {(values.guest_first_name || values.guest_last_name) && (
                  <dd className="text-muted-foreground">{values.guest_email}</dd>
                )}
              </div>
              <div className="rounded-xl border p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {preApproved ? 'Visit' : 'Invitation'}
                </dt>
                <dd className="mt-1 font-medium">
                  {preApproved ? 'Already confirmed' : INVITATION_TYPE_LABELS[invType]}
                </dd>
                <dd className="mt-1 text-muted-foreground">
                  {preApproved
                    ? 'Confirmed directly — guest notified, no acceptance needed'
                    : values.requires_approval
                      ? 'Requires your approval'
                      : 'Auto-confirms'}
                </dd>
              </div>
              {preApproved && (
                <div className="rounded-xl border p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Guests
                  </dt>
                  <dd className="mt-1 font-medium">{values.party_size ?? 1}</dd>
                </div>
              )}
              {validWindows.length > 0 && (
                <div className="rounded-xl border p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Dates
                  </dt>
                  <dd className="mt-1 space-y-1">
                    {validWindows.map((w) => (
                      <p key={`${w.start_date}-${w.end_date}`} className="font-medium">
                        {formatDateRange(w.start_date, w.end_date)}
                      </p>
                    ))}
                  </dd>
                </div>
              )}
              <div className="rounded-xl border p-4">
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Rooms
                </dt>
                <dd className="mt-1 font-medium">
                  {values.whole_home ? 'Entire home' : roomLabels || '—'}
                </dd>
              </div>
              {values.message?.trim() && (
                <div className="rounded-xl border p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Message
                  </dt>
                  <dd className="mt-1 whitespace-pre-wrap">{values.message}</dd>
                </div>
              )}
              {values.expires_at && (
                <div className="rounded-xl border p-4">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Expires
                  </dt>
                  <dd className="mt-1 font-medium">
                    {formatDate(values.expires_at)}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </Form>
      </SurveyDialogLayout>
      )}
    </Dialog>
  );
}
