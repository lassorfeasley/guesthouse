-- Plain-text alternative for queued email.
--
-- Every message now ships as multipart/alternative (HTML + text). HTML-only
-- mail is a well-known spam signal, so we render and store a text body next to
-- the HTML. Nullable so any rows queued before this migration still drain.
--
-- claim_email_outbox RETURNS SETOF public.email_outbox, so the new column is
-- picked up automatically — no function change needed.

ALTER TABLE public.email_outbox
  ADD COLUMN text TEXT;
