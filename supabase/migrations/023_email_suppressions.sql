-- Email suppression list: addresses we must stop sending to.
--
-- Populated by the Resend webhook (/api/webhooks/resend) on hard bounces and
-- spam complaints, and optionally by operators. The delivery choke point
-- (deliverRendered) filters recipients against this table before every send,
-- so continuing to mail dead/hostile addresses can't quietly erode our sender
-- reputation. Critical user-initiated auth mail bypasses the check in code.

CREATE TABLE public.email_suppressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Always stored lowercased/trimmed by the app layer.
  email TEXT NOT NULL,
  -- hard_bounce: address invalid | complaint: marked as spam | manual: operator
  reason TEXT NOT NULL,
  -- Resend message id that triggered the suppression, when known.
  provider_message_id TEXT,
  -- Free-form provider detail (e.g. bounce diagnostic message).
  detail TEXT,
  CONSTRAINT email_suppressions_reason_check
    CHECK (reason IN ('hard_bounce', 'complaint', 'manual'))
);

-- One row per address; upserts on the webhook path key off this.
CREATE UNIQUE INDEX idx_email_suppressions_email
  ON public.email_suppressions (email);

-- Contains recipient addresses (PII). RLS on with NO policies blocks anon and
-- authenticated roles entirely; the service role (webhook + senders) bypasses.
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;
