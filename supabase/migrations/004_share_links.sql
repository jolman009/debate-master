-- Phase 2: shareable read-only debate links
--
-- Run this in the Supabase SQL Editor after 003_data_hygiene.sql.
--
-- Sharing is opt-in per debate: the owner generates an unguessable
-- `share_token`. RLS still hides the row from everyone but the owner —
-- public read access goes exclusively through the SECURITY DEFINER
-- functions below, which only ever return the single debate whose token
-- matches. Revoking a share is just setting share_token back to NULL.

ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS share_token TEXT UNIQUE;

-- Returns the shared debate (no user_id / share_token exposed).
CREATE OR REPLACE FUNCTION get_shared_debate(token TEXT)
RETURNS TABLE (
  id UUID,
  config JSONB,
  current_stage TEXT,
  feedback JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT d.id, d.config, d.current_stage, d.feedback, d.created_at
  FROM debates d
  WHERE token IS NOT NULL
    AND d.share_token = token
    AND d.archived_at IS NULL;
$$;

-- Returns the turns of the shared debate, oldest first.
CREATE OR REPLACE FUNCTION get_shared_debate_turns(token TEXT)
RETURNS TABLE (
  id UUID,
  stage TEXT,
  role TEXT,
  content TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT t.id, t.stage, t.role, t.content, t.created_at
  FROM debate_turns t
  JOIN debates d ON d.id = t.debate_id
  WHERE token IS NOT NULL
    AND d.share_token = token
    AND d.archived_at IS NULL
  ORDER BY t.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION get_shared_debate(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_shared_debate_turns(TEXT) TO anon, authenticated;
