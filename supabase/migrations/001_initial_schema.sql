-- Gracious initial schema

-- Custom types
CREATE TYPE user_role AS ENUM ('owner', 'guest');
CREATE TYPE invitation_type AS ENUM ('standing', 'date_offer', 'prix_fixe');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'expired', 'revoked');
CREATE TYPE booking_status AS ENUM ('requested', 'approved', 'declined', 'cancelled');

-- Users (extends auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role user_role NOT NULL DEFAULT 'guest',
  visible_to_coguests BOOLEAN NOT NULL DEFAULT true,
  notification_prefs JSONB NOT NULL DEFAULT '{"booking_requests": true, "booking_cancelled": true, "invitation_expiring": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Properties
CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  address TEXT,
  directions TEXT,
  wifi_name TEXT,
  wifi_password TEXT,
  house_rules TEXT,
  check_in_instructions TEXT,
  hero_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_owner ON public.properties(owner_id);
CREATE INDEX idx_properties_slug ON public.properties(slug);

-- Property managers (co-managers)
CREATE TABLE public.property_managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, user_id)
);

CREATE INDEX idx_property_managers_property ON public.property_managers(property_id);
CREATE INDEX idx_property_managers_user ON public.property_managers(user_id);

-- Property images
CREATE TABLE public.property_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  caption TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_property_images_property ON public.property_images(property_id);

-- Rooms
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  max_occupancy INT NOT NULL DEFAULT 2,
  image_url TEXT,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rooms_property ON public.rooms(property_id);

-- Room availability blocks
CREATE TABLE public.room_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_blocked BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);

CREATE INDEX idx_room_availability_room ON public.room_availability(room_id);
CREATE INDEX idx_room_availability_dates ON public.room_availability(room_id, start_date, end_date);

-- Invitations
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  guest_email TEXT NOT NULL,
  guest_name TEXT,
  type invitation_type NOT NULL DEFAULT 'standing',
  status invitation_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  message TEXT,
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invitations_property ON public.invitations(property_id);
CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_guest_email ON public.invitations(guest_email);

-- Invitation rooms
CREATE TABLE public.invitation_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  UNIQUE(invitation_id, room_id)
);

CREATE INDEX idx_invitation_rooms_invitation ON public.invitation_rooms(invitation_id);

-- Invitation windows
CREATE TABLE public.invitation_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  CHECK (end_date > start_date)
);

CREATE INDEX idx_invitation_windows_invitation ON public.invitation_windows(invitation_id);

-- Bookings
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id UUID NOT NULL REFERENCES public.invitations(id),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  guest_user_id UUID NOT NULL REFERENCES public.users(id),
  status booking_status NOT NULL DEFAULT 'requested',
  party_size INT NOT NULL DEFAULT 1,
  notes TEXT,
  decline_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_bookings_property ON public.bookings(property_id);
CREATE INDEX idx_bookings_guest ON public.bookings(guest_user_id);
CREATE INDEX idx_bookings_status ON public.bookings(property_id, status);

-- Booking rooms
CREATE TABLE public.booking_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  UNIQUE(booking_id, room_id)
);

CREATE INDEX idx_booking_rooms_booking ON public.booking_rooms(booking_id);

-- Booking dates
CREATE TABLE public.booking_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE,
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  CHECK (check_out > check_in)
);

CREATE INDEX idx_booking_dates_booking ON public.booking_dates(booking_id);
CREATE INDEX idx_booking_dates_range ON public.booking_dates(check_in, check_out);

-- Notifications log
CREATE TABLE public.notifications_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  invitation_id UUID REFERENCES public.invitations(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_log_type ON public.notifications_log(type, sent_at);
CREATE INDEX idx_notifications_log_booking ON public.notifications_log(booking_id, type);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'owner' THEN 'owner'::public.user_role
      ELSE 'guest'::public.user_role
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    role = EXCLUDED.role;
  RETURN NEW;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON TABLE public.users TO supabase_auth_admin;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitation_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

-- Helper: check if user can manage property
CREATE OR REPLACE FUNCTION public.can_manage_property(prop_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = prop_id AND p.owner_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.property_managers pm
    WHERE pm.property_id = prop_id AND pm.user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Users policies
CREATE POLICY users_select_own ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY users_insert_own ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY users_update_own ON public.users FOR UPDATE USING (auth.uid() = id);

-- Properties policies
CREATE POLICY properties_select ON public.properties FOR SELECT
  USING (owner_id = auth.uid() OR public.can_manage_property(id));
CREATE POLICY properties_insert ON public.properties FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY properties_update ON public.properties FOR UPDATE
  USING (public.can_manage_property(id));
CREATE POLICY properties_delete ON public.properties FOR DELETE
  USING (owner_id = auth.uid());

-- Property managers policies
CREATE POLICY property_managers_select ON public.property_managers FOR SELECT
  USING (public.can_manage_property(property_id));
CREATE POLICY property_managers_insert ON public.property_managers FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));
CREATE POLICY property_managers_delete ON public.property_managers FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()));

-- Property images policies
CREATE POLICY property_images_all ON public.property_images FOR ALL
  USING (public.can_manage_property(property_id));

-- Rooms policies
CREATE POLICY rooms_all ON public.rooms FOR ALL
  USING (public.can_manage_property(property_id));

-- Room availability policies
CREATE POLICY room_availability_all ON public.room_availability FOR ALL
  USING (EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND public.can_manage_property(r.property_id)));

-- Invitations policies
CREATE POLICY invitations_select ON public.invitations FOR SELECT
  USING (public.can_manage_property(property_id) OR guest_email = (SELECT email FROM public.users WHERE id = auth.uid()));
CREATE POLICY invitations_insert ON public.invitations FOR INSERT
  WITH CHECK (public.can_manage_property(property_id));
CREATE POLICY invitations_update ON public.invitations FOR UPDATE
  USING (public.can_manage_property(property_id));

-- Invitation rooms/windows policies
CREATE POLICY invitation_rooms_all ON public.invitation_rooms FOR ALL
  USING (EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND public.can_manage_property(i.property_id)));
CREATE POLICY invitation_windows_all ON public.invitation_windows FOR ALL
  USING (EXISTS (SELECT 1 FROM public.invitations i WHERE i.id = invitation_id AND public.can_manage_property(i.property_id)));

-- Bookings policies
CREATE POLICY bookings_select ON public.bookings FOR SELECT
  USING (guest_user_id = auth.uid() OR public.can_manage_property(property_id));
CREATE POLICY bookings_insert ON public.bookings FOR INSERT
  WITH CHECK (guest_user_id = auth.uid());
CREATE POLICY bookings_update ON public.bookings FOR UPDATE
  USING (guest_user_id = auth.uid() OR public.can_manage_property(property_id));

-- Booking rooms/dates policies
CREATE POLICY booking_rooms_all ON public.booking_rooms FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.guest_user_id = auth.uid() OR public.can_manage_property(b.property_id))));
CREATE POLICY booking_dates_all ON public.booking_dates FOR ALL
  USING (EXISTS (SELECT 1 FROM public.bookings b WHERE b.id = booking_id AND (b.guest_user_id = auth.uid() OR public.can_manage_property(b.property_id))));

-- Notifications log (owners only via service role mostly)
CREATE POLICY notifications_log_select ON public.notifications_log FOR SELECT
  USING (user_id = auth.uid());

-- Storage bucket for property images
INSERT INTO storage.buckets (id, name, public) VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Property images upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'property-images' AND auth.role() = 'authenticated');
CREATE POLICY "Property images read" ON storage.objects FOR SELECT
  USING (bucket_id = 'property-images');
CREATE POLICY "Property images delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'property-images' AND auth.role() = 'authenticated');
