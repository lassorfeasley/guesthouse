-- Guest relationships + user avatars
-- Idempotent: every statement guards on the existence of what it touches so the
-- migration is safe to re-run from any partially-applied state.

-- Avatar image for an account (placeholder is generated client-side when null).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Host's label for who a guest is to them ("Sister", "College roommate", …).
-- Lives on both invitations and visits so manual (invitation-less) stays carry
-- the same context.
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS relationship TEXT;

ALTER TABLE public.visits
  ADD COLUMN IF NOT EXISTS relationship TEXT;

-- Storage bucket for avatars (public read, authenticated write) — mirrors the
-- existing property-images bucket policy shape.
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Avatars upload'
  ) THEN
    CREATE POLICY "Avatars upload" ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Avatars read'
  ) THEN
    CREATE POLICY "Avatars read" ON storage.objects FOR SELECT
      USING (bucket_id = 'avatars');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Avatars update'
  ) THEN
    CREATE POLICY "Avatars update" ON storage.objects FOR UPDATE
      USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Avatars delete'
  ) THEN
    CREATE POLICY "Avatars delete" ON storage.objects FOR DELETE
      USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END $$;
