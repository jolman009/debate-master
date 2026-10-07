-- Atomic Google Play ownership and entitlement reconciliation.
-- Apply after migration 016. These RPCs are service-role only.

BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_billing_entitlement(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  active_end TIMESTAMPTZ;
BEGIN
  SELECT max(current_period_end)
    INTO active_end
    FROM public.billing_subscriptions
   WHERE user_id = p_user_id
     AND status IN ('active', 'trialing')
     AND (current_period_end IS NULL OR current_period_end > now());

  UPDATE public.profiles
     SET subscription_status = CASE WHEN active_end IS NOT NULL THEN 'active' ELSE 'canceled' END,
         subscription_current_period_end = active_end,
         updated_at = now()
   WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (
      user_id, subscription_status, subscription_current_period_end, updated_at
    ) VALUES (
      p_user_id,
      CASE WHEN active_end IS NOT NULL THEN 'active' ELSE 'canceled' END,
      active_end,
      now()
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_google_play_subscription(
  p_user_id UUID,
  p_environment TEXT,
  p_purchase_token TEXT,
  p_product_id TEXT,
  p_status TEXT,
  p_period_end TIMESTAMPTZ,
  p_acknowledged_at TIMESTAMPTZ,
  p_provider_updated_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  owned_id UUID;
  existing_owner UUID;
BEGIN
  SELECT user_id INTO existing_owner
    FROM public.billing_subscriptions
   WHERE provider = 'google_play'
     AND provider_environment = p_environment
     AND provider_subscription_id = p_purchase_token
   FOR UPDATE;

  IF existing_owner IS NOT NULL AND existing_owner <> p_user_id THEN
    RAISE EXCEPTION 'Google Play purchase is already owned by another account'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.billing_subscriptions (
    user_id, provider, provider_environment, provider_subscription_id,
    product_id, status, current_period_end, acknowledged_at,
    provider_updated_at, verified_at
  ) VALUES (
    p_user_id, 'google_play', p_environment, p_purchase_token,
    p_product_id, p_status, p_period_end, p_acknowledged_at,
    p_provider_updated_at, now()
  )
  ON CONFLICT (provider, provider_environment, provider_subscription_id)
  DO UPDATE SET
    product_id = EXCLUDED.product_id,
    status = EXCLUDED.status,
    current_period_end = EXCLUDED.current_period_end,
    acknowledged_at = COALESCE(EXCLUDED.acknowledged_at, billing_subscriptions.acknowledged_at),
    provider_updated_at = GREATEST(
      EXCLUDED.provider_updated_at,
      billing_subscriptions.provider_updated_at
    ),
    verified_at = now()
  RETURNING id INTO owned_id;

  PERFORM public.refresh_billing_entitlement(p_user_id);
  RETURN owned_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_google_play_event(
  p_environment TEXT,
  p_event_id TEXT,
  p_event_type TEXT,
  p_purchase_token TEXT,
  p_product_id TEXT,
  p_status TEXT,
  p_period_end TIMESTAMPTZ,
  p_event_created_at TIMESTAMPTZ,
  p_provider_updated_at TIMESTAMPTZ
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  owned public.billing_subscriptions%ROWTYPE;
  event_row_id UUID;
BEGIN
  SELECT * INTO owned
    FROM public.billing_subscriptions
   WHERE provider = 'google_play'
     AND provider_environment = p_environment
     AND provider_subscription_id = p_purchase_token
   FOR UPDATE;

  IF owned.id IS NULL THEN
    RAISE EXCEPTION 'Google Play purchase has no verified owner'
      USING ERRCODE = 'P0002';
  END IF;

  INSERT INTO public.billing_events (
    provider, provider_environment, provider_event_id, event_type,
    subscription_id, provider_created_at, processing_status,
    attempt_count, last_attempt_at
  ) VALUES (
    'google_play', p_environment, p_event_id, p_event_type,
    owned.id, p_event_created_at, 'processing', 1, now()
  )
  ON CONFLICT (provider, provider_environment, provider_event_id) DO NOTHING
  RETURNING id INTO event_row_id;

  IF event_row_id IS NULL THEN
    RETURN 'duplicate';
  END IF;

  IF owned.provider_updated_at IS NULL
     OR p_provider_updated_at >= owned.provider_updated_at THEN
    UPDATE public.billing_subscriptions
       SET product_id = p_product_id,
           status = p_status,
           current_period_end = p_period_end,
           provider_updated_at = p_provider_updated_at,
           verified_at = now()
     WHERE id = owned.id;
    PERFORM public.refresh_billing_entitlement(owned.user_id);
  END IF;

  UPDATE public.billing_events
     SET processing_status = 'processed', processed_at = now()
   WHERE id = event_row_id;

  RETURN CASE
    WHEN owned.provider_updated_at IS NOT NULL
     AND p_provider_updated_at < owned.provider_updated_at THEN 'stale'
    ELSE 'processed'
  END;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_billing_entitlement(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_google_play_subscription(UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_google_play_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_billing_entitlement(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_google_play_subscription(UUID,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_google_play_event(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ) TO service_role;

COMMIT;
