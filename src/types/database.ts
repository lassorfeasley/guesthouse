export type UserRole = 'owner' | 'guest' | 'admin';
export type PlanId = 'free' | 'pro';
export type InvitationType = 'standing' | 'date_offer' | 'prix_fixe';
export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';
export type BookingStatus = 'requested' | 'approved' | 'declined' | 'cancelled';

export interface User {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  /** Generated full name (first_name + last_name). Read-only. */
  name: string | null;
  role: UserRole;
  plan: PlanId;
  hosted_stays_used: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  visible_to_coguests: boolean;
  notification_prefs: NotificationPrefs;
  created_at: string;
}

export interface NotificationPrefs {
  // Host activity (opt-out, granular)
  booking_requests: boolean;
  booking_cancelled: boolean;
  invitation_expiring: boolean;
  // Guest stay reminders (opt-out)
  guest_reminders: boolean;
  // Host onboarding/engagement nudges, e.g. "finish your home profile" (opt-out)
  host_tips: boolean;
  // Product updates — marketing (opt-out, scoped to people who own a home)
  product_updates: boolean;
}

export interface Amenity {
  key: string;
  label: string;
  note: string;
}

export interface Property {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  directions: string | null;
  wifi_name: string | null;
  wifi_password: string | null;
  house_rules: string | null;
  check_in_instructions: string | null;
  checkout_instructions: string | null;
  checkout_time: string | null;
  timezone: string;
  hero_image_url: string | null;
  latitude: number | null;
  longitude: number | null;
  amenities: Amenity[];
  created_at: string;
  property_images?: PropertyImage[];
}

export interface PropertyManager {
  id: string;
  property_id: string;
  user_id: string;
  created_at: string;
}

export interface PropertyImage {
  id: string;
  property_id: string;
  url: string;
  caption: string | null;
  display_order: number;
  is_featured: boolean;
}

export interface RoomImage {
  id: string;
  room_id: string;
  url: string;
  caption: string | null;
  display_order: number;
  is_featured: boolean;
}

export interface Room {
  id: string;
  property_id: string;
  name: string;
  description: string | null;
  max_occupancy: number;
  beds: string[];
  amenities: Amenity[];
  image_url: string | null;
  display_order: number;
  room_images?: RoomImage[];
}

export interface RoomAvailability {
  id: string;
  room_id: string;
  start_date: string;
  end_date: string;
  is_blocked: boolean;
}

export interface Invitation {
  id: string;
  token: string;
  property_id: string;
  guest_email: string;
  guest_first_name: string | null;
  guest_last_name: string | null;
  /** Generated full name (guest_first_name + guest_last_name). Read-only. */
  guest_name: string | null;
  type: InvitationType;
  status: InvitationStatus;
  expires_at: string | null;
  message: string | null;
  requires_approval: boolean;
  created_by: string;
  created_at: string;
}

export interface InvitationRoom {
  id: string;
  invitation_id: string;
  room_id: string;
}

export interface InvitationWindow {
  id: string;
  invitation_id: string;
  start_date: string;
  end_date: string;
}

export interface BookingGuest {
  id: string | null;
  name: string | null;
  email: string | null;
}

export interface Booking {
  id: string;
  invitation_id: string | null;
  property_id: string;
  guest_user_id: string | null;
  guest_first_name: string | null;
  guest_last_name: string | null;
  /** Generated full name (guest_first_name + guest_last_name). Read-only. */
  guest_name: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  notify_guest: boolean;
  created_by: string | null;
  status: BookingStatus;
  party_size: number;
  notes: string | null;
  decline_message: string | null;
  created_at: string;
}

export interface BookingRoom {
  id: string;
  booking_id: string;
  room_id: string;
}

export interface BookingDates {
  id: string;
  booking_id: string;
  check_in: string;
  check_out: string;
}

export interface InvitationWithDetails extends Invitation {
  property: Property;
  rooms: Room[];
  windows: InvitationWindow[];
}

export interface BookingWithDetails extends Booking {
  guest: BookingGuest;
  dates: BookingDates;
  rooms: Room[];
  property: Property;
  invitation: Invitation | null;
}
