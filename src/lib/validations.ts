import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const signupSchema = z
  .object({
    first_name: z.string().min(1, 'First name is required'),
    last_name: z.string().optional(),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const amenitySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  note: z.string().max(280, 'Note is too long'),
});
export type AmenityInput = z.infer<typeof amenitySchema>;

export const PROPERTY_DESCRIPTION_MAX_LENGTH = 1000;
export const PROPERTY_NOTE_MAX_LENGTH = 200;
export const PROPERTY_NOTES_MAX_PER_CATEGORY = 5;

export const propertyNoteCategorySchema = z.enum(['house', 'checkin', 'checkout']);

export const propertyNoteBodySchema = z
  .string()
  .trim()
  .min(1, 'Note cannot be empty')
  .max(
    PROPERTY_NOTE_MAX_LENGTH,
    `Note must be ${PROPERTY_NOTE_MAX_LENGTH} characters or fewer`
  );

export const propertyNoteSchema = z.object({
  category: propertyNoteCategorySchema,
  body: propertyNoteBodySchema,
});

export type PropertyNoteInput = z.infer<typeof propertyNoteSchema>;

export const propertySchema = z.object({
  name: z.string().min(1, 'Property name is required'),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  description: z
    .string()
    .max(
      PROPERTY_DESCRIPTION_MAX_LENGTH,
      `Description must be ${PROPERTY_DESCRIPTION_MAX_LENGTH} characters or fewer`
    )
    .optional(),
  address: z.string().optional(),
  directions: z.string().optional(),
  wifi_name: z.string().optional(),
  wifi_password: z.string().optional(),
  house_rules: z.string().optional(),
  check_in_instructions: z.string().optional(),
  checkout_instructions: z.string().optional(),
  checkout_time: z.string().optional(),
  timezone: z.string().optional(),
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  amenities: z.array(amenitySchema),
});

export const BED_SIZES = [
  'king',
  'queen',
  'full',
  'twin',
  'bunk',
  'sofa',
  'other',
] as const;

export const BED_SIZE_LABELS: Record<(typeof BED_SIZES)[number], string> = {
  king: 'King',
  queen: 'Queen',
  full: 'Full / Double',
  twin: 'Twin',
  bunk: 'Bunk',
  sofa: 'Sofa bed',
  other: 'Other',
};

export function summarizeBeds(beds: string[] | null | undefined): string {
  if (!beds || beds.length === 0) return 'No beds listed';
  const counts = new Map<string, number>();
  for (const b of beds) counts.set(b, (counts.get(b) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([size, n]) => {
      const label =
        BED_SIZE_LABELS[size as keyof typeof BED_SIZE_LABELS] ?? size;
      return n > 1 ? `${n}× ${label}` : label;
    })
    .join(' · ');
}

export const roomSchema = z.object({
  name: z.string().min(1, 'Room name is required'),
  description: z.string().optional(),
  max_occupancy: z.number().min(1, 'At least 1 guest'),
  beds: z.array(z.enum(BED_SIZES)).min(1, 'Add at least one bed'),
  amenities: z.array(amenitySchema),
});

export const invitationSchema = z
  .object({
    guest_email: z.string().email('Enter a valid email'),
    guest_first_name: z.string().optional(),
    guest_last_name: z.string().optional(),
    relationship: z.string().max(80, 'Keep it under 80 characters').optional(),
    type: z.enum(['standing', 'date_offer', 'prix_fixe']),
    requires_approval: z.boolean(),
    whole_home: z.boolean().optional(),
    message: z.string().optional(),
    expires_at: z.string().optional(),
    room_ids: z.array(z.string()).min(1, 'Select at least one room'),
    windows: z
      .array(
        z.object({
          start_date: z.string(),
          end_date: z.string(),
        })
      )
      .optional(),
    // When the host has already confirmed the stay with the guest, skip the
    // invitation/acceptance flow and book the (fixed-date) stay directly.
    pre_approved: z.boolean().optional(),
    party_size: z.number().min(1, 'At least 1 guest').optional(),
  })
  .refine((d) => !d.pre_approved || d.type === 'prix_fixe', {
    message: 'Only fixed-date invitations can be booked directly',
    path: ['pre_approved'],
  })
  .refine((d) => !d.pre_approved || (d.party_size ?? 0) >= 1, {
    message: 'Add the number of guests',
    path: ['party_size'],
  });

export const visitRequestSchema = z.object({
  invitation_token: z.string().uuid(),
  check_in: z.string().min(1, 'Check-in date is required'),
  check_out: z.string().min(1, 'Check-out date is required'),
  room_ids: z.array(z.string()).min(1, 'Select at least one room'),
  party_size: z.number().min(1, 'At least 1 guest'),
  notes: z.string().optional(),
  guest_first_name: z.string().optional(),
  guest_last_name: z.string().optional(),
});

export const hostVisitSchema = z
  .object({
    property_id: z.string().uuid(),
    guest_first_name: z.string().min(1, 'First name is required'),
    guest_last_name: z.string().optional(),
    guest_email: z.string().email('Enter a valid email').optional().or(z.literal('')),
    guest_phone: z.string().optional(),
    check_in: z.string().min(1, 'Check-in date is required'),
    check_out: z.string().min(1, 'Check-out date is required'),
    room_ids: z.array(z.string()).min(1, 'Select at least one room'),
    party_size: z.number().min(1, 'At least 1 guest'),
    notes: z.string().optional(),
    notify_guest: z.boolean(),
  })
  .refine(
    (d) => !d.notify_guest || (d.guest_email && d.guest_email.length > 0),
    {
      message: 'An email is required to send guest notifications',
      path: ['guest_email'],
    }
  );

export const visitUpdateSchema = z.object({
  check_in: z.string().min(1, 'Check-in date is required'),
  check_out: z.string().min(1, 'Check-out date is required'),
  room_ids: z.array(z.string()).min(1, 'Select at least one room'),
  party_size: z.number().min(1, 'At least 1 guest'),
  notes: z.string().optional(),
});

export type VisitUpdateInput = z.infer<typeof visitUpdateSchema>;

export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type PropertyInput = z.infer<typeof propertySchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type InvitationInput = z.infer<typeof invitationSchema>;
export type VisitRequestInput = z.infer<typeof visitRequestSchema>;
export type HostVisitInput = z.infer<typeof hostVisitSchema>;
