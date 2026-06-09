-- Host onboarding/engagement nudges (e.g. "finish your home profile"), opt-out
-- and subscribed by default.

ALTER TABLE public.users
  ALTER COLUMN notification_prefs
  SET DEFAULT '{"booking_requests": true, "booking_cancelled": true, "invitation_expiring": true, "guest_reminders": true, "host_tips": true, "product_updates": true}'::jsonb;

UPDATE public.users
SET notification_prefs = '{"host_tips": true}'::jsonb || notification_prefs
WHERE NOT (notification_prefs ? 'host_tips');
