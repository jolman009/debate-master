-- Run as postgres after migration 016 in a disposable database or staging.
-- Synthetic fixtures and the test helper are rolled back, including on failure.
BEGIN;

CREATE FUNCTION pg_temp.expect_sqlstate(statement TEXT, expected TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE = expected THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'Expected SQLSTATE %, but statement succeeded: %', expected, statement;
END;
$$;

INSERT INTO auth.users(id) VALUES
  ('01600000-0000-0000-0000-000000000001'),
  ('01600000-0000-0000-0000-000000000002');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '01600000-0000-0000-0000-000000000001', true);
INSERT INTO public.profiles(user_id, display_name, leaderboard_opt_in, avatar_url, updated_at)
VALUES ('01600000-0000-0000-0000-000000000001', 'Billing A', false, null, now());
-- Match the profile API's INSERT ... ON CONFLICT update, including user_id.
INSERT INTO public.profiles(user_id, display_name, updated_at)
VALUES ('01600000-0000-0000-0000-000000000001', 'Billing A updated', now())
ON CONFLICT (user_id) DO UPDATE SET
  user_id = EXCLUDED.user_id, display_name = EXCLUDED.display_name,
  updated_at = EXCLUDED.updated_at;
DO $$ BEGIN
  IF (SELECT display_name FROM public.profiles
      WHERE user_id = '01600000-0000-0000-0000-000000000001') <> 'Billing A updated'
  THEN RAISE EXCEPTION 'Profile upsert failed'; END IF;
END $$;

SELECT pg_temp.expect_sqlstate($q$
  UPDATE public.profiles SET subscription_status = 'active'
  WHERE user_id = '01600000-0000-0000-0000-000000000001'
$q$, '42501');
SELECT pg_temp.expect_sqlstate($q$
  INSERT INTO public.profiles(user_id, subscription_status)
  VALUES ('01600000-0000-0000-0000-000000000001', 'active')
  ON CONFLICT (user_id) DO UPDATE SET subscription_status = EXCLUDED.subscription_status
$q$, '42501');
SELECT pg_temp.expect_sqlstate($q$
  UPDATE public.profiles SET stripe_customer_id = 'cus_forged',
    subscription_current_period_end = now() + interval '100 years'
$q$, '42501');
SELECT pg_temp.expect_sqlstate($q$
  UPDATE public.profiles SET elo_rating = 9999
$q$, '42501');
SELECT pg_temp.expect_sqlstate($q$
  INSERT INTO public.profiles(user_id, display_name)
  VALUES ('01600000-0000-0000-0000-000000000002', 'Forged B')
$q$, '42501');

RESET ROLE;
SET LOCAL ROLE service_role;
UPDATE public.profiles SET subscription_status = 'active', stripe_customer_id = 'cus_fixture_016',
  subscription_current_period_end = now() + interval '1 month'
WHERE user_id = '01600000-0000-0000-0000-000000000001';
INSERT INTO public.billing_subscriptions (
  id, user_id, provider, provider_environment, provider_subscription_id, product_id, status, verified_at
) VALUES (
  '01600000-0000-0000-0000-000000000003', '01600000-0000-0000-0000-000000000001',
  'google_play', 'test', 'synthetic_token_016', 'fixture_product', 'active', now()
);
UPDATE public.billing_subscriptions SET status = 'canceled'
WHERE id = '01600000-0000-0000-0000-000000000003';
SELECT pg_temp.expect_sqlstate($q$
  UPDATE public.billing_subscriptions SET user_id = '01600000-0000-0000-0000-000000000002'
  WHERE id = '01600000-0000-0000-0000-000000000003'
$q$, '23514');
SELECT pg_temp.expect_sqlstate($q$
  INSERT INTO public.billing_subscriptions (
    user_id, provider, provider_environment, provider_subscription_id, product_id, status, verified_at
  ) VALUES ('01600000-0000-0000-0000-000000000002', 'google_play', 'test',
    'synthetic_token_016', 'fixture_product', 'active', now())
$q$, '23505');

INSERT INTO public.billing_events (
  provider, provider_environment, provider_event_id, event_type, subscription_id
) VALUES ('google_play', 'test', 'fixture_message_016', 'subscription_notification',
  '01600000-0000-0000-0000-000000000003');
INSERT INTO public.billing_events (provider, provider_environment, provider_event_id, event_type)
VALUES ('google_play', 'test', 'fixture_message_016', 'subscription_notification')
ON CONFLICT (provider, provider_environment, provider_event_id) DO NOTHING;
SELECT pg_temp.expect_sqlstate($q$
  INSERT INTO public.billing_events (provider, provider_environment, provider_event_id, event_type)
  VALUES ('google_play', 'test', 'fixture_message_016', 'subscription_notification')
$q$, '23505');
SELECT pg_temp.expect_sqlstate($q$
  UPDATE public.billing_events SET processing_status = 'processed'
  WHERE provider_event_id = 'fixture_message_016'
$q$, '23514');
UPDATE public.billing_events SET processing_status = 'processed', processed_at = now(),
  attempt_count = attempt_count + 1, last_attempt_at = now()
WHERE provider_event_id = 'fixture_message_016';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.billing_events
      WHERE provider_event_id = 'fixture_message_016') <> 1
  THEN RAISE EXCEPTION 'Event deduplication failed'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  IF (SELECT count(id) FROM public.billing_subscriptions
      WHERE id = '01600000-0000-0000-0000-000000000003') <> 1
  THEN RAISE EXCEPTION 'Owner cannot read subscription'; END IF;
  IF (SELECT status FROM public.billing_subscriptions
      WHERE id = '01600000-0000-0000-0000-000000000003') <> 'canceled'
  THEN RAISE EXCEPTION 'Server update failed'; END IF;
  IF (SELECT subscription_status FROM public.profiles
      WHERE user_id = '01600000-0000-0000-0000-000000000001') <> 'active'
  THEN RAISE EXCEPTION 'Server profile update failed'; END IF;
END $$;
SELECT pg_temp.expect_sqlstate('SELECT provider_subscription_id FROM public.billing_subscriptions', '42501');
SELECT pg_temp.expect_sqlstate('SELECT * FROM public.billing_subscriptions', '42501');
SELECT pg_temp.expect_sqlstate('UPDATE public.billing_subscriptions SET status = ''active''', '42501');
SELECT pg_temp.expect_sqlstate($q$
  INSERT INTO public.billing_subscriptions (
    user_id, provider, provider_environment, provider_subscription_id, product_id, status, verified_at
  ) VALUES ('01600000-0000-0000-0000-000000000001', 'stripe', 'test',
    'sub_forged', 'price_forged', 'active', now())
$q$, '42501');
SELECT pg_temp.expect_sqlstate('DELETE FROM public.billing_subscriptions', '42501');
SELECT pg_temp.expect_sqlstate('SELECT * FROM public.billing_events', '42501');
SELECT pg_temp.expect_sqlstate($q$
  INSERT INTO public.billing_events(provider, provider_environment, provider_event_id, event_type)
  VALUES ('stripe', 'test', 'evt_forged', 'forged')
$q$, '42501');

SELECT set_config('request.jwt.claim.sub', '01600000-0000-0000-0000-000000000002', true);
DO $$ BEGIN
  IF EXISTS (SELECT id FROM public.billing_subscriptions
             WHERE id = '01600000-0000-0000-0000-000000000003')
  THEN RAISE EXCEPTION 'Account B can see account A subscription'; END IF;
  IF EXISTS (SELECT user_id FROM public.profiles
             WHERE user_id = '01600000-0000-0000-0000-000000000001')
  THEN RAISE EXCEPTION 'Account B can see account A profile'; END IF;
END $$;

RESET ROLE;
SET LOCAL ROLE anon;
SELECT pg_temp.expect_sqlstate('SELECT id FROM public.billing_subscriptions', '42501');
SELECT pg_temp.expect_sqlstate('SELECT * FROM public.billing_events', '42501');
SELECT pg_temp.expect_sqlstate('SELECT * FROM public.profiles', '42501');
RESET ROLE;

ROLLBACK;
