-- Phase 4 (Monetization): Stripe billing columns on profiles
--
-- Run this in the Supabase SQL Editor after 007_leaderboard.sql.
--
-- Subscription state lives on the existing profiles table. The Stripe webhook
-- writes these via the service-role key (no user session); users read their
-- own row through existing RLS to learn their tier.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT,
  ADD COLUMN IF NOT EXISTS subscription_current_period_end TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
  ON profiles(stripe_customer_id);
