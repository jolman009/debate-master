// Server-side data access for debate content (topics, packs, personas).
//
// Content is read from Supabase when available and falls back to the in-code
// defaults (personas.ts / topics.ts) when the tables are missing or a query
// fails — so the app keeps working before migration 005 is applied, matching
// the optional-infra pattern used for rate limiting and Sentry.
//
// SERVER ONLY: this imports the cookie-based Supabase client. Import it from
// server components and route handlers, then pass results to client
// components as props.

import { createServerClient } from "@/lib/supabase/server";
import { Persona, PersonaId, Topic, TopicPack, Difficulty } from "./types";
import { getAllPersonas } from "./personas";
import { CURATED_TOPICS } from "./topics";

interface TopicRow {
  slug: string;
  title: string;
  motion: string;
  category: string;
  difficulty: string;
}

interface TopicPackRow {
  id: string;
  name: string;
  description: string | null;
}

interface PersonaRow {
  slug: string;
  display_name: string;
  tagline: string | null;
  ideology: string | null;
  system_prompt: string;
  avatar_url: string | null;
  avatar_url_speaking: string | null;
  avatar_url_thinking: string | null;
  voice_config: Persona["voiceConfig"] | null;
  theme: Persona["theme"] | null;
}

function rowToTopic(r: TopicRow): Topic {
  return {
    id: r.slug,
    title: r.title,
    motion: r.motion,
    category: r.category,
    difficulty: r.difficulty as Difficulty,
  };
}

function rowToPersona(r: PersonaRow): Persona {
  return {
    id: r.slug as PersonaId,
    displayName: r.display_name,
    tagline: r.tagline ?? "",
    ideology: r.ideology ?? "",
    systemPrompt: r.system_prompt,
    avatarUrl: r.avatar_url ?? "",
    avatarUrlSpeaking: r.avatar_url_speaking ?? undefined,
    avatarUrlThinking: r.avatar_url_thinking ?? undefined,
    voiceConfig: r.voice_config ?? { pitch: 1, rate: 1, voicePrefs: [] },
    theme: r.theme ?? { from: "#64748b", to: "#334155", glow: "rgba(100,116,139,0.5)" },
  };
}

/** All selectable topics, DB-backed with an in-code fallback. */
export async function getTopics(): Promise<Topic[]> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("topics")
      .select("slug, title, motion, category, difficulty")
      .order("sort_order", { ascending: true });
    if (error || !data || data.length === 0) return CURATED_TOPICS;
    return (data as TopicRow[]).map(rowToTopic);
  } catch {
    return CURATED_TOPICS;
  }
}

/** Curated topic packs (empty if none / not migrated yet). */
export async function getTopicPacks(): Promise<TopicPack[]> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("topic_packs")
      .select("id, name, description")
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return (data as TopicPackRow[]).map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description ?? "",
    }));
  } catch {
    return [];
  }
}

/**
 * All selectable personas: the in-code built-ins plus any user-created
 * (custom) personas from the DB. Built-ins win on slug collision. Falls back
 * to built-ins only if the personas table is missing or the query fails.
 */
export async function getPersonas(): Promise<Persona[]> {
  const builtIns = getAllPersonas();
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("personas")
      .select(
        "slug, display_name, tagline, ideology, system_prompt, avatar_url, avatar_url_speaking, avatar_url_thinking, voice_config, theme"
      )
      .not("owner_id", "is", null);
    if (error || !data) return builtIns;
    const builtInSlugs = new Set(builtIns.map((p) => p.id));
    const custom = (data as PersonaRow[])
      .map(rowToPersona)
      .filter((p) => !builtInSlugs.has(p.id));
    return [...builtIns, ...custom];
  } catch {
    return builtIns;
  }
}
