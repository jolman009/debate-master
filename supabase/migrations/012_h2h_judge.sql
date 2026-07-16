-- Migration 012: Two-sided AI judge + ranked Elo leaderboard (Phase D).
--
-- Run this in the Supabase SQL Editor after 011_h2h_realtime.sql.
--
-- Human debates end at the neutral `judge` stage. A judge verdict scores both
-- sides, declares a winner, and moves both players' Elo ratings.
--
-- Additive by design — the shipped AI leaderboard is untouched:
--  * The verdict is stored in `debates.judge_result`, NOT `feedback`. The
--    existing get_leaderboard() filters on `feedback IS NOT NULL`, so human
--    debates are naturally excluded from the Practice board with no change to
--    that function.
--  * Ranked (human-vs-human) standings live in a separate
--    get_ranked_leaderboard(), aggregated from debate_participants.
--
-- Elo: everyone starts at 1200, K=32. Ratings are computed INSIDE
-- apply_judge_result() (never passed in by the caller) and the whole verdict is
-- applied in one transaction under a per-debate advisory lock, so a double
-- submit can't double-count a result.

-- 1. Verdict storage ----------------------------------------------------------
ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS judge_result JSONB;

ALTER TABLE debate_participants
  ADD COLUMN IF NOT EXISTS score        NUMERIC,
  ADD COLUMN IF NOT EXISTS result       TEXT,
  ADD COLUMN IF NOT EXISTS rating_delta NUMERIC;

ALTER TABLE debate_participants DROP CONSTRAINT IF EXISTS debate_participants_result_check;
ALTER TABLE debate_participants
  ADD CONSTRAINT debate_participants_result_check
  CHECK (result IS NULL OR result IN ('win', 'loss', 'draw'));

-- 2. Elo rating on profiles ---------------------------------------------------
-- profiles rows may not exist yet for a given user (they're created on
-- leaderboard opt-in or by the billing webhook), so apply_judge_result()
-- upserts them before rating.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS elo_rating NUMERIC NOT NULL DEFAULT 1200;

-- Standard Elo. p_score is 1 = win, 0.5 = draw, 0 = loss.
CREATE OR REPLACE FUNCTION elo_new_rating(
  p_rating   NUMERIC,
  p_opponent NUMERIC,
  p_score    NUMERIC,
  p_k        NUMERIC DEFAULT 32
) RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT round(
    p_rating + p_k * (
      p_score - (1.0 / (1.0 + power(10.0, (p_opponent - p_rating) / 400.0)))
    )
  );
$$;

-- 3. apply_judge_result -------------------------------------------------------
-- Atomically records the verdict: writes judge_result, completes the debate,
-- stamps each participant's score/result/rating_delta, and moves both Elos.
-- Either participant may call it; it refuses to run twice.
CREATE OR REPLACE FUNCTION apply_judge_result(p_debate_id UUID, p_judge JSONB)
RETURNS TABLE (pro_delta NUMERIC, con_delta NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_debate     debates%ROWTYPE;
  v_winner     TEXT := p_judge->>'winner';
  v_pro_user   UUID;
  v_con_user   UUID;
  v_pro_rating NUMERIC;
  v_con_rating NUMERIC;
  v_pro_points NUMERIC;
  v_pro_new    NUMERIC;
  v_con_new    NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  -- Serialize verdict application for THIS debate.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('debate_judge:' || p_debate_id::text, 0)
  );

  SELECT * INTO v_debate FROM debates WHERE id = p_debate_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Debate not found' USING ERRCODE = 'P0002';
  END IF;

  IF (v_debate.config->>'mode') IS DISTINCT FROM 'human' THEN
    RAISE EXCEPTION 'Not a human debate' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM debate_participants
    WHERE debate_id = p_debate_id AND user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Not a participant' USING ERRCODE = '42501';
  END IF;

  -- Idempotency guard: a verdict is applied exactly once (it moves Elo).
  IF v_debate.judge_result IS NOT NULL THEN
    RAISE EXCEPTION 'This debate has already been judged' USING ERRCODE = '22023';
  END IF;

  IF v_winner IS NULL OR v_winner NOT IN ('pro', 'con', 'draw') THEN
    RAISE EXCEPTION 'Invalid winner' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_pro_user FROM debate_participants
    WHERE debate_id = p_debate_id AND side = 'pro';
  SELECT user_id INTO v_con_user FROM debate_participants
    WHERE debate_id = p_debate_id AND side = 'con';

  IF v_pro_user IS NULL OR v_con_user IS NULL THEN
    RAISE EXCEPTION 'Debate does not have two players' USING ERRCODE = '22023';
  END IF;

  -- Make sure both players have a profile row to hold their rating.
  INSERT INTO profiles (user_id) VALUES (v_pro_user) ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO profiles (user_id) VALUES (v_con_user) ON CONFLICT (user_id) DO NOTHING;

  SELECT elo_rating INTO v_pro_rating FROM profiles WHERE user_id = v_pro_user;
  SELECT elo_rating INTO v_con_rating FROM profiles WHERE user_id = v_con_user;

  v_pro_points := CASE v_winner
                    WHEN 'pro' THEN 1.0
                    WHEN 'draw' THEN 0.5
                    ELSE 0.0
                  END;

  v_pro_new := elo_new_rating(v_pro_rating, v_con_rating, v_pro_points);
  v_con_new := elo_new_rating(v_con_rating, v_pro_rating, 1.0 - v_pro_points);

  UPDATE profiles SET elo_rating = v_pro_new, updated_at = now()
    WHERE user_id = v_pro_user;
  UPDATE profiles SET elo_rating = v_con_new, updated_at = now()
    WHERE user_id = v_con_user;

  UPDATE debate_participants SET
    score        = (p_judge->'pro'->>'score')::numeric,
    result       = CASE v_winner WHEN 'pro' THEN 'win' WHEN 'draw' THEN 'draw' ELSE 'loss' END,
    rating_delta = v_pro_new - v_pro_rating
  WHERE debate_id = p_debate_id AND side = 'pro';

  UPDATE debate_participants SET
    score        = (p_judge->'con'->>'score')::numeric,
    result       = CASE v_winner WHEN 'con' THEN 'win' WHEN 'draw' THEN 'draw' ELSE 'loss' END,
    rating_delta = v_con_new - v_con_rating
  WHERE debate_id = p_debate_id AND side = 'con';

  UPDATE debates SET
    judge_result  = p_judge,
    current_stage = 'complete',
    updated_at    = now()
  WHERE id = p_debate_id;

  pro_delta := v_pro_new - v_pro_rating;
  con_delta := v_con_new - v_con_rating;
  RETURN NEXT;
END;
$$;

-- 4. get_ranked_leaderboard ---------------------------------------------------
-- Human-vs-human standings for opted-in users. Mirrors get_leaderboard's
-- privacy posture: display_name + derived stats only, never emails or content.
CREATE OR REPLACE FUNCTION get_ranked_leaderboard(max_rows INT DEFAULT 50)
RETURNS TABLE (
  user_id      UUID,
  display_name TEXT,
  elo_rating   NUMERIC,
  wins         BIGINT,
  losses       BIGINT,
  draws        BIGINT,
  matches      BIGINT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    round(p.elo_rating) AS elo_rating,
    count(*) FILTER (WHERE dp.result = 'win')  AS wins,
    count(*) FILTER (WHERE dp.result = 'loss') AS losses,
    count(*) FILTER (WHERE dp.result = 'draw') AS draws,
    count(*) AS matches
  FROM debate_participants dp
  JOIN profiles p ON p.user_id = dp.user_id
  JOIN debates d ON d.id = dp.debate_id
  WHERE p.leaderboard_opt_in = true
    AND p.display_name IS NOT NULL
    AND dp.result IS NOT NULL
    AND d.archived_at IS NULL
  GROUP BY p.user_id, p.display_name, p.elo_rating
  ORDER BY p.elo_rating DESC, matches DESC
  LIMIT max_rows;
$$;

-- 5. Widen get_debate_participants with the outcome columns -------------------
-- Same contract/authorisation as migration 010 (owner or participant only),
-- plus each player's judged score/result/rating_delta so the UI can show "you
-- won, +21 Elo". The return type changes, so it must be dropped first.
DROP FUNCTION IF EXISTS get_debate_participants(UUID);
CREATE OR REPLACE FUNCTION get_debate_participants(p_debate_id UUID)
RETURNS TABLE (
  user_id      UUID,
  side         TEXT,
  role         TEXT,
  joined_at    TIMESTAMPTZ,
  score        NUMERIC,
  result       TEXT,
  rating_delta NUMERIC
)
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

  IF NOT EXISTS (
    SELECT 1 FROM debates d WHERE d.id = p_debate_id AND d.user_id = v_uid
  ) AND NOT EXISTS (
    SELECT 1 FROM debate_participants p
    WHERE p.debate_id = p_debate_id AND p.user_id = v_uid
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.user_id, p.side, p.role, p.joined_at, p.score, p.result, p.rating_delta
  FROM debate_participants p
  WHERE p.debate_id = p_debate_id
  ORDER BY p.joined_at ASC;
END;
$$;

REVOKE ALL ON FUNCTION apply_judge_result(UUID, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_debate_participants(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apply_judge_result(UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_debate_participants(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ranked_leaderboard(INT) TO anon, authenticated;
