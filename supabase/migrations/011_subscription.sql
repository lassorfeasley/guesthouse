-- Subscription and hosted-stay usage tracking for freemium billing.
-- Plan and usage live on the property owner account (users row).

ALTER TABLE public.users
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN hosted_stays_used INT NOT NULL DEFAULT 0,
  ADD COLUMN stripe_customer_id TEXT,
  ADD COLUMN stripe_subscription_id TEXT;

ALTER TABLE public.users
  ADD CONSTRAINT users_plan_check CHECK (plan IN ('free', 'pro'));

ALTER TABLE public.users
  ADD CONSTRAINT users_hosted_stays_used_check CHECK (hosted_stays_used >= 0);
