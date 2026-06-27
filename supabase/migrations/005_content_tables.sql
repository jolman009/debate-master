-- Phase 4 (Milestone 1): database-backed content
--
-- Run this in the Supabase SQL Editor after 004_share_links.sql.
--
-- Moves debate content into the database so it can be extended at runtime:
--   * topics + topic_packs  — fully DB-backed (built-ins seeded below);
--     enables curated/seasonal topic packs.
--   * personas              — table for user-created ("custom") personas;
--     built-in personas still live in code for now and are merged in by
--     the app's content layer. Custom personas are owner-scoped via RLS.
--
-- The app falls back to its in-code defaults if this migration has not been
-- applied yet, so deploying the code before running this is safe.

-- ----------------------------------------------------------------------------
-- topic_packs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS topic_packs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE topic_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Topic packs are readable by everyone"
  ON topic_packs FOR SELECT USING (true);

-- ----------------------------------------------------------------------------
-- topics
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS topics (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  title       TEXT NOT NULL,
  motion      TEXT NOT NULL,
  category    TEXT NOT NULL,
  difficulty  TEXT NOT NULL CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  pack_id     UUID REFERENCES topic_packs(id) ON DELETE SET NULL,
  is_public   BOOLEAN NOT NULL DEFAULT true,
  owner_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE topics ENABLE ROW LEVEL SECURITY;

-- Built-in (owner_id IS NULL) and public topics are readable by anyone;
-- private topics only by their owner.
CREATE POLICY "Read public or own topics"
  ON topics FOR SELECT
  USING (owner_id IS NULL OR is_public OR auth.uid() = owner_id);

CREATE POLICY "Insert own topics"
  ON topics FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Update own topics"
  ON topics FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Delete own topics"
  ON topics FOR DELETE USING (auth.uid() = owner_id);

CREATE INDEX IF NOT EXISTS idx_topics_pack ON topics(pack_id, sort_order ASC);

-- ----------------------------------------------------------------------------
-- personas (for user-created custom personas; built-ins remain in code)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS personas (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL UNIQUE,
  display_name        TEXT NOT NULL,
  tagline             TEXT NOT NULL DEFAULT '',
  ideology            TEXT NOT NULL DEFAULT '',
  system_prompt       TEXT NOT NULL,
  avatar_url          TEXT,
  avatar_url_speaking TEXT,
  avatar_url_thinking TEXT,
  voice_config        JSONB NOT NULL DEFAULT '{}'::jsonb,
  theme               JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public           BOOLEAN NOT NULL DEFAULT false,
  owner_id            UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read public or own personas"
  ON personas FOR SELECT
  USING (owner_id IS NULL OR is_public OR auth.uid() = owner_id);

CREATE POLICY "Insert own personas"
  ON personas FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Update own personas"
  ON personas FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Delete own personas"
  ON personas FOR DELETE USING (auth.uid() = owner_id);

-- ----------------------------------------------------------------------------
-- Seed: Core topic pack + the original curated topics
-- ----------------------------------------------------------------------------
INSERT INTO topic_packs (slug, name, description, sort_order) VALUES
  ('core', 'Core Topics', 'The original curated debate topics.', 0)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO topics (slug, title, motion, category, difficulty, pack_id, sort_order)
SELECT v.slug, v.title, v.motion, v.category, v.difficulty,
       (SELECT id FROM topic_packs WHERE slug = 'core'), v.sort_order
FROM (VALUES
  ('ubi', 'Universal Basic Income', 'This house believes that governments should provide a universal basic income to all citizens.', 'economics', 'intermediate', 0),
  ('free-speech', 'Free Speech Absolutism', 'This house believes that free speech protections should extend to all forms of expression without exception.', 'politics', 'advanced', 1),
  ('ai-regulation', 'AI Regulation', 'This house believes that artificial intelligence development should be heavily regulated by governments.', 'technology', 'intermediate', 2),
  ('gun-control', 'Gun Control', 'This house believes that the United States should implement significantly stricter gun control legislation.', 'politics', 'intermediate', 3),
  ('drug-legalization', 'Drug Legalization', 'This house believes that all recreational drugs should be decriminalized.', 'social', 'intermediate', 4),
  ('capital-punishment', 'Capital Punishment', 'This house believes that the death penalty is never morally justified.', 'philosophy', 'beginner', 5),
  ('wealth-tax', 'Wealth Taxation', 'This house believes that billionaires should be taxed at significantly higher rates.', 'economics', 'beginner', 6),
  ('social-media', 'Social Media Censorship', 'This house believes that social media companies should actively moderate political content.', 'technology', 'beginner', 7),
  ('climate-policy', 'Climate Change Policy', 'This house believes that governments should mandate aggressive carbon reduction even at significant economic cost.', 'politics', 'advanced', 8),
  ('immigration', 'Immigration Policy', 'This house believes that nations should adopt more open immigration policies.', 'politics', 'intermediate', 9),
  ('crypto', 'Cryptocurrency', 'This house believes that cryptocurrency should replace traditional banking systems.', 'economics', 'intermediate', 10),
  ('college-worth', 'College Education', 'This house believes that a traditional four-year college degree is no longer worth the cost for most people.', 'social', 'beginner', 11)
) AS v(slug, title, motion, category, difficulty, sort_order)
ON CONFLICT (slug) DO NOTHING;
