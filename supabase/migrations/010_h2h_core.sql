-- Migration 010: Human-vs-human core (Phase A of the H2H plan)
--
-- Run this in the Supabase SQL Editor after 009_atomic_debate_create.sql.
--
-- Adds everything needed for two authenticated humans to play a full debate
-- through an invite link. It is strictly ADDITIVE: existing AI debates have no
-- participant rows and no `mode` in their config, so every AI-mode policy,
-- row, and code path is unchanged. The AI path keeps its owner-only access via
-- `debates.user_id`; the human path layers participant-based access on top.
--
-- Design notes:
--  * `invite_token` is distinct from `share_token`. share = anonymous
--    read-only view (migration 004); invite = an authenticated second player
--    joining and claiming the open side.
--  * `debate_participants` has NO direct INSERT policy. Participants are only
--    ever created through the two SECURITY DEFINER functions below, so the
--    "claim a side" logic (and its uniqueness) is server-controlled.
--  * RLS avoids cross-table recursion: `debates`/`debate_turns` policies check
--    membership by querying `debate_participants`, so `debate_participants`'
--    own SELECT policy is a bare `user_id = auth.uid()` with NO back-reference
--    to `debates`. Any reference there would make the two tables' policies
--    evaluate each other forever (Postgres 42P17). The roster is exposed
--    instead via the get_debate_participants() SECURITY DEFINER function.

-- 1. invite_token on debates --------------------------------------------------
ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;

-- 2. participants table -------------------------------------------------------
CREATE TABLE IF NOT EXISTS debate_participants (
  debate_id  UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side       TEXT NOT NULL CHECK (side IN ('pro', 'con')),
  role       TEXT NOT NULL DEFAULT 'debater',
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (debate_id, user_id),
  -- One player per side: the second joiner can only take the open side.
  UNIQUE (debate_id, side)
);

CREATE INDEX IF NOT EXISTS idx_participants_user ON debate_participants(user_id);

ALTER TABLE debate_participants ENABLE ROW LEVEL SECURITY;

-- 3. widen debate_turns.role + author_id --------------------------------------
-- Human turns write role = the debater's side ('pro'/'con') plus the author's
-- user id. AI turns keep writing 'user'/'ai' with a NULL author_id.
ALTER TABLE debate_turns DROP CONSTRAINT IF EXISTS debate_turns_role_check;
ALTER TABLE debate_turns
  ADD CONSTRAINT debate_turns_role_check CHECK (role IN ('user', 'ai', 'pro', 'con'));

ALTER TABLE debate_turns
  ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Additive RLS: participants get access alongside the existing owner -------
-- These are separate (permissive) policies, so they OR with the owner policies
-- from migration 002. Owners keep full access to their own debates unchanged.

-- debates: a participant may read and advance (UPDATE) a debate they joined.
DROP POLICY IF EXISTS "Participants read joined debates" ON debates;
CREATE POLICY "Participants read joined debates" ON debates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM debate_participants p
      WHERE p.debate_id = debates.id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants advance joined debates" ON debates;
CREATE POLICY "Participants advance joined debates" ON debates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM debate_participants p
      WHERE p.debate_id = debates.id AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM debate_participants p
      WHERE p.debate_id = debates.id AND p.user_id = auth.uid()
    )
  );

-- debate_turns: a participant may read and insert turns of a joined debate.
DROP POLICY IF EXISTS "Participants read joined turns" ON debate_turns;
CREATE POLICY "Participants read joined turns" ON debate_turns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM debate_participants p
      WHERE p.debate_id = debate_turns.debate_id AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Participants insert joined turns" ON debate_turns;
CREATE POLICY "Participants insert joined turns" ON debate_turns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM debate_participants p
      WHERE p.debate_id = debate_turns.debate_id AND p.user_id = auth.uid()
    )
  );

-- debate_participants: you may read only your OWN participant row. This policy
-- MUST NOT reference `debates` — the debates/turns policies above reference
-- debate_participants, so any back-reference here creates mutual recursion
-- (Postgres 42P17). The full roster, including the opponent's row, is read
-- through get_debate_participants() below (SECURITY DEFINER, bypasses RLS), so
-- own-row visibility here is all the participant policies above need.
DROP POLICY IF EXISTS "Read own or owned participant rows" ON debate_participants;
DROP POLICY IF EXISTS "Read own participant rows" ON debate_participants;
CREATE POLICY "Read own participant rows" ON debate_participants
  FOR SELECT
  USING (user_id = auth.uid());

-- 5. create_human_debate(config) ---------------------------------------------
-- Atomically creates a human debate + the owner's participant row and mints an
-- invite token. Human mode is free-to-play, so this deliberately skips the
-- monthly cap that create_debate_with_limit() enforces for AI debates.
CREATE OR REPLACE FUNCTION create_human_debate(p_config JSONB)
RETURNS TABLE (debate_id UUID, invite_token TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_side  TEXT := p_config->>'userSide';
  v_token TEXT;
  v_id    UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF (p_config->>'mode') IS DISTINCT FROM 'human' THEN
    RAISE EXCEPTION 'Not a human debate' USING ERRCODE = '22023';
  END IF;
  IF v_side NOT IN ('pro', 'con') THEN
    RAISE EXCEPTION 'Invalid side' USING ERRCODE = '22023';
  END IF;

  -- 32 hex chars (~122 bits) — unguessable enough for an invite link.
  v_token := replace(gen_random_uuid()::text, '-', '');

  -- Pro always opens, regardless of which side the creator took.
  INSERT INTO debates (user_id, config, current_stage, invite_token)
  VALUES (v_uid, p_config, 'opening_pro', v_token)
  RETURNING id INTO v_id;

  INSERT INTO debate_participants (debate_id, user_id, side)
  VALUES (v_id, v_uid, v_side);

  debate_id := v_id;
  invite_token := v_token;
  RETURN NEXT;
END;
$$;

-- 6. join_debate_via_invite(token) -------------------------------------------
-- The second player claims the open side. Idempotent for someone already in
-- the debate (including the owner). Serialized per-debate with an advisory
-- lock so two simultaneous joiners cannot both grab the last seat.
CREATE OR REPLACE FUNCTION join_debate_via_invite(p_token TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_debate debates%ROWTYPE;
  v_taken  TEXT[];
  v_open   TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_debate
  FROM debates
  WHERE invite_token = p_token AND archived_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid invite link' USING ERRCODE = 'P0002';
  END IF;

  IF (v_debate.config->>'mode') IS DISTINCT FROM 'human' THEN
    RAISE EXCEPTION 'Not a human debate' USING ERRCODE = '22023';
  END IF;

  -- Owner or an already-joined player: no-op, just return the id.
  IF v_debate.user_id = v_uid
     OR EXISTS (
       SELECT 1 FROM debate_participants
       WHERE debate_id = v_debate.id AND user_id = v_uid
     )
  THEN
    RETURN v_debate.id;
  END IF;

  -- Serialize concurrent joins for THIS debate only.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('debate_join:' || v_debate.id::text, 0)
  );

  SELECT array_agg(side) INTO v_taken
  FROM debate_participants
  WHERE debate_id = v_debate.id;

  IF v_taken @> ARRAY['pro', 'con'] THEN
    RAISE EXCEPTION 'This debate is already full' USING ERRCODE = '22023';
  END IF;

  -- The owner always holds exactly one side; the joiner takes the other.
  v_open := CASE WHEN v_taken @> ARRAY['pro'] THEN 'con' ELSE 'pro' END;

  INSERT INTO debate_participants (debate_id, user_id, side)
  VALUES (v_debate.id, v_uid, v_open);

  RETURN v_debate.id;
END;
$$;

-- 7. get_debate_participants(debate_id) --------------------------------------
-- Returns the full roster (both sides) to any participant or the owner. Lets a
-- player render the opponent without a recursive RLS SELECT policy.
CREATE OR REPLACE FUNCTION get_debate_participants(p_debate_id UUID)
RETURNS TABLE (user_id UUID, side TEXT, role TEXT, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  -- Caller must be the owner or a participant of the debate.
  IF NOT EXISTS (
    SELECT 1 FROM debates d WHERE d.id = p_debate_id AND d.user_id = v_uid
  ) AND NOT EXISTS (
    SELECT 1 FROM debate_participants p
    WHERE p.debate_id = p_debate_id AND p.user_id = v_uid
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.side, p.role, p.joined_at
  FROM debate_participants p
  WHERE p.debate_id = p_debate_id
  ORDER BY p.joined_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION create_human_debate(JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION join_debate_via_invite(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_debate_participants(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_human_debate(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION join_debate_via_invite(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_debate_participants(UUID) TO authenticated;
