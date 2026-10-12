-- Run as postgres after migrations 016 and 022. All fixtures roll back.
BEGIN;

CREATE FUNCTION pg_temp.expect_sqlstate(statement TEXT, expected TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %, but statement succeeded', expected;
END;
$$;

INSERT INTO auth.users(id) VALUES
  ('02200000-0000-0000-0000-000000000001'),
  ('02200000-0000-0000-0000-000000000002');
INSERT INTO public.profiles(user_id) VALUES
  ('02200000-0000-0000-0000-000000000001'),
  ('02200000-0000-0000-0000-000000000002');

SET LOCAL ROLE service_role;
SELECT public.claim_google_play_subscription(
  '02200000-0000-0000-0000-000000000001', 'test', 'token_022',
  'premium_monthly', 'active', now() + interval '1 month', now(), now()
);

DO $$ BEGIN
  IF (SELECT subscription_status FROM public.profiles
      WHERE user_id = '02200000-0000-0000-0000-000000000001') <> 'active'
  THEN RAISE EXCEPTION 'Verified purchase did not grant entitlement'; END IF;
END $$;

SELECT pg_temp.expect_sqlstate($q$
  SELECT public.claim_google_play_subscription(
    '02200000-0000-0000-0000-000000000002', 'test', 'token_022',
    'premium_monthly', 'active', now() + interval '1 month', now(), now())
$q$, '23514');

SELECT public.reconcile_google_play_event(
  'test', 'event_022_cancel', 'subscription_notification:13', 'token_022',
  'premium_monthly', 'canceled', now() - interval '1 day', now(), now() + interval '1 minute'
);
DO $$ BEGIN
  IF (SELECT subscription_status FROM public.profiles
      WHERE user_id = '02200000-0000-0000-0000-000000000001') <> 'canceled'
  THEN RAISE EXCEPTION 'Cancellation did not remove entitlement'; END IF;
END $$;

DO $$ BEGIN
  IF public.reconcile_google_play_event(
    'test', 'event_022_cancel', 'subscription_notification:13', 'token_022',
    'premium_monthly', 'canceled', now() - interval '1 day', now(), now() + interval '1 minute'
  ) <> 'duplicate' THEN RAISE EXCEPTION 'Duplicate event was not ignored'; END IF;
END $$;

SELECT pg_temp.expect_sqlstate($q$
  SELECT public.reconcile_google_play_event(
    'test', 'event_022_unknown', 'subscription_notification:2', 'unknown_token_022',
    'premium_monthly', 'active', now() + interval '1 month', now(), now())
$q$, 'P0002');

-- A second verified subscription must preserve premium when the Play row ends.
INSERT INTO public.billing_subscriptions (
  user_id, provider, provider_environment, provider_subscription_id,
  product_id, status, current_period_end, verified_at
) VALUES (
  '02200000-0000-0000-0000-000000000001', 'stripe', 'test', 'sub_022',
  'premium_monthly', 'active', now() + interval '2 months', now()
);
SELECT public.refresh_billing_entitlement('02200000-0000-0000-0000-000000000001');
DO $$ BEGIN
  IF (SELECT subscription_status FROM public.profiles
      WHERE user_id = '02200000-0000-0000-0000-000000000001') <> 'active'
  THEN RAISE EXCEPTION 'Another active provider did not preserve entitlement'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT pg_temp.expect_sqlstate($q$
  SELECT public.refresh_billing_entitlement('02200000-0000-0000-0000-000000000001')
$q$, '42501');
SELECT pg_temp.expect_sqlstate($q$
  SELECT public.claim_google_play_subscription(
    '02200000-0000-0000-0000-000000000001', 'test', 'forged_022',
    'premium_monthly', 'active', now() + interval '1 month', now(), now())
$q$, '42501');

ROLLBACK;
