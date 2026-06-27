-- Phase 4 (Milestone 2): curated topic packs
--
-- Run this in the Supabase SQL Editor after 005_content_tables.sql.
--
-- Adds two curated topic collections (beyond the original "Core" pack) and
-- fresh topics for each. Idempotent: re-running is a no-op.

INSERT INTO topic_packs (slug, name, description, sort_order) VALUES
  ('future-tech', 'Future & Technology', 'Debates on AI, automation, and the world we are building.', 1),
  ('ethics-society', 'Ethics & Society', 'Moral dilemmas and the rules we live by.', 2)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO topics (slug, title, motion, category, difficulty, pack_id, sort_order)
SELECT v.slug, v.title, v.motion, v.category, v.difficulty,
       (SELECT id FROM topic_packs WHERE slug = v.pack_slug), v.sort_order
FROM (VALUES
  -- Future & Technology
  ('ai-art-copyright', 'AI Art & Copyright', 'This house believes that AI-generated art should not receive copyright protection.', 'technology', 'intermediate', 'future-tech', 0),
  ('autonomous-weapons', 'Autonomous Weapons', 'This house would ban the development of fully autonomous weapons systems.', 'politics', 'advanced', 'future-tech', 1),
  ('smartphone-age-limit', 'Smartphones for Kids', 'This house would ban smartphone ownership for children under sixteen.', 'social', 'beginner', 'future-tech', 2),
  ('four-day-week', 'Four-Day Work Week', 'This house believes that the standard work week should be four days.', 'economics', 'beginner', 'future-tech', 3),
  -- Ethics & Society
  ('mandatory-voting', 'Mandatory Voting', 'This house believes that voting in national elections should be mandatory.', 'politics', 'beginner', 'ethics-society', 0),
  ('organ-optout', 'Organ Donation Opt-Out', 'This house believes that organ donation should be opt-out by default.', 'social', 'intermediate', 'ethics-society', 1),
  ('animal-testing', 'Animal Testing', 'This house would ban all animal testing for cosmetic products.', 'philosophy', 'beginner', 'ethics-society', 2),
  ('space-vs-poverty', 'Space vs. Poverty', 'This house believes that funding space exploration is unjustifiable while extreme poverty exists on Earth.', 'philosophy', 'advanced', 'ethics-society', 3)
) AS v(slug, title, motion, category, difficulty, pack_slug, sort_order)
ON CONFLICT (slug) DO NOTHING;
