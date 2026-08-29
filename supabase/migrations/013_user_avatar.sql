-- Phase 5: user profile avatar support
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;
