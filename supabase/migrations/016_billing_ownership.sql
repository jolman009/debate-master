-- Phase 0: billing ownership and reconciliation storage.
-- Apply after 001-015, initially to STAGING only.
-- Read docs/BILLING_MIGRATION_016.md before applying: the existing checkout
-- must switch its Stripe customer-ID write to the service-role client.
-- This migration does not repair webhooks, backfill unverified purchases,
-- change tier resolution, or prove payment reconciliation.

BEGIN;

CREATE TABLE public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'google_play')),
  provider_environment TEXT NOT NULL CHECK (provider_environment IN ('test', 'live')),
  -- Stripe subscription ID or Google Play purchase token. Server-only:
  -- purchase tokens must never be exposed in a client query or analytics.
  provider_subscription_id TEXT NOT NULL CHECK (length(provider_subscription_id) > 0),
  provider_customer_id TEXT,
  product_id TEXT NOT NULL CHECK (length(product_id) > 0),
  -- Preserve provider state; the server must map it to entitlements explicitly.
  status TEXT NOT NULL CHECK (length(status) > 0),
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  provider_updated_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_subscriptions_provider_identity_key
    UNIQUE (provider, provider_environment, provider_subscription_id)
);

CREATE INDEX billing_subscriptions_user_idx
  ON public.billing_subscriptions (user_id, provider_environment);
CREATE INDEX billing_subscriptions_customer_idx
  ON public.billing_subscriptions (provider, provider_environment, provider_customer_id)
  WHERE provider_customer_id IS NOT NULL;

-- Even a service-role upsert cannot silently move a purchase to another user.
-- A replacement Play token is a new row, linked to the verified existing owner
-- by the server; legitimate transfers need a separate, audited procedure.
CREATE FUNCTION public.protect_billing_subscription_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $$
BEGIN
  IF ROW(NEW.id, NEW.user_id, NEW.provider, NEW.provider_environment,
         NEW.provider_subscription_id, NEW.created_at)
     IS DISTINCT FROM
     ROW(OLD.id, OLD.user_id, OLD.provider, OLD.provider_environment,
         OLD.provider_subscription_id, OLD.created_at) THEN
    RAISE EXCEPTION 'Billing subscription identity and ownership are immutable'
      USING ERRCODE = '23514';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_billing_subscription_identity()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER billing_subscriptions_protect_identity
  BEFORE UPDATE ON public.billing_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.protect_billing_subscription_identity();

CREATE TABLE public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'google_play')),
  provider_environment TEXT NOT NULL CHECK (provider_environment IN ('test', 'live')),
  -- Stripe event.id or Google Pub/Sub messageId, after sender verification.
  provider_event_id TEXT NOT NULL CHECK (length(provider_event_id) > 0),
  event_type TEXT NOT NULL CHECK (length(event_type) > 0),
  subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  provider_created_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processing_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  -- A bounded application error code, never a raw payload, token, or email.
  last_error_code TEXT CHECK (length(last_error_code) <= 100),
  CONSTRAINT billing_events_provider_identity_key
    UNIQUE (provider, provider_environment, provider_event_id),
  CONSTRAINT billing_events_completion_check CHECK (
    (processing_status IN ('processed', 'ignored')) = (processed_at IS NOT NULL)
  )
);

CREATE INDEX billing_events_subscription_idx
  ON public.billing_events (subscription_id, received_at DESC);
CREATE INDEX billing_events_retry_idx
  ON public.billing_events (processing_status, received_at)
  WHERE processing_status IN ('pending', 'processing', 'failed');

ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Start with explicit grants rather than inheriting Supabase table defaults.
REVOKE ALL ON public.billing_subscriptions, public.billing_events
  FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.billing_subscriptions, public.billing_events TO service_role;

-- Owners can read a safe projection. SELECT * intentionally fails because
-- provider_subscription_id can contain a reusable Google Play purchase token.
GRANT SELECT (
  id, user_id, provider, provider_environment, product_id, status,
  current_period_end, cancel_at_period_end, acknowledged_at,
  provider_updated_at, verified_at, created_at, updated_at
) ON public.billing_subscriptions TO authenticated;

CREATE POLICY "Owners read safe subscription fields"
  ON public.billing_subscriptions FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- No client policies/grants for billing_events; only trusted server processing
-- can read or write it. The unique event key supports deduplication, but handlers
-- must still implement atomic state updates and retry failed/pending events.

-- Retain legacy profile billing fields for existing server readers/webhooks.
-- Remove broad client writes: RLS alone does not protect paid fields on an
-- otherwise user-owned row. Ordinary profile upserts remain supported.
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT, DELETE ON public.profiles TO authenticated;
GRANT INSERT (user_id, display_name, leaderboard_opt_in, avatar_url, updated_at),
      UPDATE (user_id, display_name, leaderboard_opt_in, avatar_url, updated_at)
  ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- Keep migration 007's ownership policy. It also constrains profile upserts;
-- column grants above prevent clients writing billing fields or Elo ratings.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

COMMIT;
