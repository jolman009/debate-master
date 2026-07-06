-- Migration 009: Atomic debate creation with monthly-cap enforcement.
--
-- Fixes a TOCTOU race in POST /api/debate. The previous flow was:
--   1. SELECT COUNT(*) of debates this month for user X
--   2. If under FREE_DEBATE_LIMIT, INSERT a new debate
-- Two concurrent requests from a free-tier user near the cap could both
-- read the same count, both pass the check, and both insert -- letting
-- the user exceed the cap.
--
-- This RPC takes a per-user transaction-scoped advisory lock, so concurrent
-- create calls for the same user serialize. Only one holder at a time can
-- run the count check, meaning at most `p_free_limit` debates land per user
-- per month even under bursty traffic. Callers on other rows are unaffected
-- (the lock is scoped to the user's id via a hash).
--
-- Return shape: one row with (debate_id UUID, over_limit BOOLEAN).
--
-- Callers pass p_free_limit so the number lives in application code rather
-- than the DB. Pass a negative value (e.g. -1) for premium users to skip
-- the cap entirely.

CREATE OR REPLACE FUNCTION create_debate_with_limit(
  p_user_id UUID,
  p_config JSONB,
  p_free_limit INT,
  p_month_start TIMESTAMPTZ
) RETURNS TABLE (debate_id UUID, over_limit BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INT;
  v_new_id UUID;
BEGIN
  -- Only the signed-in user can create for themselves. SECURITY DEFINER
  -- bypasses RLS on the INSERT, so this check is the auth boundary.
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  -- Per-user advisory lock, released when this transaction ends. Serializes
  -- concurrent create-debate calls for THIS user only.
  PERFORM pg_advisory_xact_lock(
    hashtextextended('debate_create:' || p_user_id::text, 0)
  );

  IF p_free_limit >= 0 THEN
    SELECT COUNT(*) INTO v_count
    FROM debates
    WHERE user_id = p_user_id
      AND created_at >= p_month_start;

    IF v_count >= p_free_limit THEN
      debate_id := NULL;
      over_limit := TRUE;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  INSERT INTO debates (user_id, config, current_stage)
  VALUES (p_user_id, p_config, 'opening_user')
  RETURNING id INTO v_new_id;

  debate_id := v_new_id;
  over_limit := FALSE;
  RETURN NEXT;
END;
$$;

-- Only signed-in users can call the function; the auth.uid() check inside
-- prevents them from acting on behalf of anyone else.
REVOKE ALL ON FUNCTION create_debate_with_limit(UUID, JSONB, INT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_debate_with_limit(UUID, JSONB, INT, TIMESTAMPTZ) TO authenticated;
