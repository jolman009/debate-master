-- Migration 011: Supabase Realtime for human-vs-human debates (Phase B).
--
-- Run this in the Supabase SQL Editor after 010_h2h_core.sql.
--
-- Enables live sync by adding debate_turns + debates to the supabase_realtime
-- publication so the browser (subscribed directly, not via Vercel) receives
-- Postgres Changes. Realtime enforces each subscriber's RLS, so only the two
-- participants of a human debate receive its events — the participant-based
-- SELECT policies from migration 010 are exactly what gate this.
--
-- REPLICA IDENTITY FULL: UPDATE/DELETE change payloads (and the RLS check on
-- them) need the full old row, not just the primary key. `debates` rows are
-- UPDATEd on every stage advance, so it must be FULL. `debate_turns` is
-- insert-only, but we set it too for consistency/future-proofing.
--
-- Idempotent: re-running is safe (skips tables already in the publication).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'debate_turns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE debate_turns;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'debates'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE debates;
  END IF;
END $$;

ALTER TABLE debate_turns REPLICA IDENTITY FULL;
ALTER TABLE debates REPLICA IDENTITY FULL;
