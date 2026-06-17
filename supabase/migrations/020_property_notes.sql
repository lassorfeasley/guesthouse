-- Structured short notes per property (house rules, arrival, checkout).
-- Replaces free-form text fields in the host UI; legacy columns remain for email cron until wired.

CREATE TABLE public.property_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  body TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT property_notes_category_check CHECK (
    category IN ('house', 'checkin', 'checkout')
  ),
  CONSTRAINT property_notes_body_check CHECK (
    char_length(body) <= 200 AND char_length(btrim(body)) >= 1
  )
);

CREATE INDEX idx_property_notes_property ON public.property_notes(property_id);
CREATE INDEX idx_property_notes_property_category ON public.property_notes(property_id, category, display_order);

CREATE OR REPLACE FUNCTION public.enforce_property_notes_limit()
RETURNS TRIGGER AS $$
DECLARE
  note_count INT;
BEGIN
  SELECT count(*)::INT INTO note_count
  FROM public.property_notes
  WHERE property_id = NEW.property_id AND category = NEW.category;

  IF note_count >= 5 THEN
    RAISE EXCEPTION 'Maximum of 5 notes per category';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_notes_limit
  BEFORE INSERT ON public.property_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_property_notes_limit();

CREATE OR REPLACE FUNCTION public.touch_property_notes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER property_notes_updated_at
  BEFORE UPDATE ON public.property_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_property_notes_updated_at();

ALTER TABLE public.property_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_notes_all ON public.property_notes FOR ALL
  USING (public.can_manage_property(property_id));
