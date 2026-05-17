-- Phase 1: ownership + Row Level Security
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- It adds debate ownership and locks both tables down so a user can only
-- ever read or write their own debates.
--
-- NOTE: any debates created before this migration have a NULL user_id and
-- become inaccessible (no policy matches them). Delete that test data if you
-- want a clean slate:  DELETE FROM debates WHERE user_id IS NULL;

-- 1. Ownership column ---------------------------------------------------------
ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_debates_user_id ON debates(user_id);

-- 2. Enable Row Level Security ------------------------------------------------
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_turns ENABLE ROW LEVEL SECURITY;

-- 3. Policies: debates — owner-only for all operations ------------------------
DROP POLICY IF EXISTS "Users manage own debates" ON debates;
CREATE POLICY "Users manage own debates" ON debates
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Policies: debate_turns — access turns of debates you own -----------------
DROP POLICY IF EXISTS "Users read own debate turns" ON debate_turns;
CREATE POLICY "Users read own debate turns" ON debate_turns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM debates d
      WHERE d.id = debate_turns.debate_id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users insert own debate turns" ON debate_turns;
CREATE POLICY "Users insert own debate turns" ON debate_turns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM debates d
      WHERE d.id = debate_turns.debate_id AND d.user_id = auth.uid()
    )
  );
