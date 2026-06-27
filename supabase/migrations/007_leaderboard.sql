-- Phase 4 (Milestone 4): leaderboard
--
-- Run this in the Supabase SQL Editor after 006_topic_packs_seed.sql.
--
-- Adds opt-in public profiles and a SECURITY DEFINER leaderboard function.
-- RLS keeps debates/profiles private; the function aggregates across users
-- and exposes ONLY display_name + derived stats for users who opted in.
-- No emails or debate content are exposed.

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  user_id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name       TEXT,
  leaderboard_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile"
  ON profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- get_leaderboard: weighted performance rating across opted-in users.
--
-- rating = sum(overallScore * difficulty weight) over completed debates.
-- Difficulty weights: beginner 1.0, intermediate 1.25, advanced 1.5.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_leaderboard(max_rows INT DEFAULT 50)
RETURNS TABLE (
  user_id           UUID,
  display_name      TEXT,
  rating            NUMERIC,
  debates_completed BIGINT,
  avg_score         NUMERIC,
  best_score        NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.display_name,
    round(sum(
      (d.feedback->>'overallScore')::numeric
      * CASE d.config->>'difficulty'
          WHEN 'advanced' THEN 1.5
          WHEN 'intermediate' THEN 1.25
          ELSE 1.0
        END
    ))::numeric AS rating,
    count(*) AS debates_completed,
    round(avg((d.feedback->>'overallScore')::numeric), 1) AS avg_score,
    max((d.feedback->>'overallScore')::numeric) AS best_score
  FROM debates d
  JOIN profiles p ON p.user_id = d.user_id
  WHERE p.leaderboard_opt_in = true
    AND p.display_name IS NOT NULL
    AND d.archived_at IS NULL
    AND d.feedback IS NOT NULL
    AND (d.feedback->>'overallScore') IS NOT NULL
  GROUP BY p.user_id, p.display_name
  ORDER BY rating DESC, debates_completed DESC
  LIMIT max_rows;
$$;

GRANT EXECUTE ON FUNCTION get_leaderboard(INT) TO anon, authenticated;
