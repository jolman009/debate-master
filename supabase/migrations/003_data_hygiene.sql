-- Phase 2: soft-delete for debates
--
-- Run this in the Supabase SQL Editor after 002_auth_and_rls.sql.
--
-- Adds an `archived_at` timestamp. The dashboard hides archived debates
-- but the rows (and their turns) are preserved, so a removal is
-- recoverable: UPDATE debates SET archived_at = NULL WHERE id = '...';

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Partial index for the common dashboard query (a user's active debates).
CREATE INDEX IF NOT EXISTS idx_debates_active
  ON debates(user_id, updated_at DESC)
  WHERE archived_at IS NULL;
