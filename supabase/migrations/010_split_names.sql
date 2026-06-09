-- Split single "name" fields into first_name / last_name across users,
-- invitations, and bookings.
--
-- The original `name` / `guest_name` columns are recreated as GENERATED
-- full-name columns (first_name + last_name), so existing reads keep working
-- while the structured first/last fields become the source of truth.
--
-- This applies to ALL users (guests included): a guest today may become a
-- host later, and we want their name structured consistently from the start.

-- Helper expressions used below:
--   first token of a name  -> split_part(trimmed, ' ', 1)
--   remainder as last name -> substr(trimmed, length(first) + 1) then trim

-- ============================ users ============================
ALTER TABLE public.users
  ADD COLUMN first_name TEXT,
  ADD COLUMN last_name TEXT;

UPDATE public.users
SET
  first_name = NULLIF(split_part(btrim(name), ' ', 1), ''),
  last_name = NULLIF(
    btrim(substr(btrim(name), length(split_part(btrim(name), ' ', 1)) + 1)),
    ''
  )
WHERE name IS NOT NULL;

ALTER TABLE public.users DROP COLUMN name;
ALTER TABLE public.users
  ADD COLUMN name TEXT GENERATED ALWAYS AS (x
    NULLIF(btrim(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  ) STORED;

-- ========================= invitations =========================
ALTER TABLE public.invitations
  ADD COLUMN guest_first_name TEXT,
  ADD COLUMN guest_last_name TEXT;

UPDATE public.invitations
SET
  guest_first_name = NULLIF(split_part(btrim(guest_name), ' ', 1), ''),
  guest_last_name = NULLIF(
    btrim(substr(btrim(guest_name), length(split_part(btrim(guest_name), ' ', 1)) + 1)),
    ''
  )
WHERE guest_name IS NOT NULL;

ALTER TABLE public.invitations DROP COLUMN guest_name;
ALTER TABLE public.invitations
  ADD COLUMN guest_name TEXT GENERATED ALWAYS AS (
    NULLIF(
      btrim(COALESCE(guest_first_name, '') || ' ' || COALESCE(guest_last_name, '')),
      ''
    )
  ) STORED;

-- =========================== bookings ==========================
ALTER TABLE public.bookings
  ADD COLUMN guest_first_name TEXT,
  ADD COLUMN guest_last_name TEXT;

UPDATE public.bookings
SET
  guest_first_name = NULLIF(split_part(btrim(guest_name), ' ', 1), ''),
  guest_last_name = NULLIF(
    btrim(substr(btrim(guest_name), length(split_part(btrim(guest_name), ' ', 1)) + 1)),
    ''
  )
WHERE guest_name IS NOT NULL;

ALTER TABLE public.bookings DROP COLUMN guest_name;
ALTER TABLE public.bookings
  ADD COLUMN guest_name TEXT GENERATED ALWAYS AS (
    NULLIF(
      btrim(COALESCE(guest_first_name, '') || ' ' || COALESCE(guest_last_name, '')),
      ''
    )
  ) STORED;

-- ===================== auth user trigger =======================
-- Recreate the signup trigger to populate first_name / last_name (the `name`
-- column is generated and can no longer be written to directly).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name, last_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email'),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      split_part(COALESCE(NEW.email, ''), '@', 1)
    ),
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    CASE
      WHEN NEW.raw_user_meta_data->>'role' = 'owner' THEN 'owner'::public.user_role
      ELSE 'guest'::public.user_role
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    role = EXCLUDED.role;
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user error: %', SQLERRM;
    RAISE;
END;
$$;
