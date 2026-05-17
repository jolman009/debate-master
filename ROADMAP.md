# Debate Master — Phased Implementation Plan

A phased roadmap to take Debate Master from a working prototype to a
production-ready, marketable product. Effort tags: **S** = <1 day,
**M** = 1–3 days, **L** = 1 week+.

---

## Status snapshot (2026-05-16)

**Stack:** Next.js 14.2.21 (App Router) · React 18 · TypeScript · Tailwind ·
Anthropic Claude (streaming) · Supabase (Postgres).

**Working today:**
- Full turn-based debate engine (opening → rebuttal ×1–2 → optional
  cross-exam → closing → feedback) with a server-driven state machine.
- Claude streaming responses over SSE, 6 personas with distinct styles.
- ElevenLabs TTS via a server-side proxy (`/api/tts`) with browser
  `SpeechSynthesis` fallback — **complete**.
- Themed persona avatars, audio-reactive live stage, light/dark mode.
- Resizable transcript overlay; stage indicator with sub-stage progress.

**Not yet built (gates a public launch):** authentication, row-level
security, rate limiting, input caps, error monitoring, tests/CI.

---

## Phase 1 — Production Hardening 🔒 *(launch blockers)*

The app is currently fully open: any visitor can read or inject turns into
any debate by ID, and every AI/TTS endpoint is callable without limits.
None of Phase 2–4 should ship publicly until this is done.

- [ ] **Authentication** — add Supabase Auth (email/OAuth). Migrate
  `src/lib/supabase/*` to `@supabase/ssr` for cookie-based sessions in
  route handlers. **M**
- [ ] **Ownership in the schema** — add `user_id uuid references
  auth.users` to `debates`; backfill/migrate. **S**
- [ ] **Row Level Security** — `ENABLE ROW LEVEL SECURITY` on `debates`
  and `debate_turns`; policies so a user only sees/writes their own
  debates (`auth.uid() = user_id`). **M**
- [ ] **Server key correctness** — server routes use the service-role key
  (or the user's JWT) instead of the anon key, so writes still work once
  RLS is on. **S**
- [ ] **Rate limiting** — wrap `/api/debate/[id]/turn`, `/feedback`, and
  `/api/tts` with per-user/IP limits (`@upstash/ratelimit` + Upstash
  Redis works on Vercel). **M**
- [ ] **Input validation** — cap `content` length on turn submission
  (e.g. 8–10k chars) and topic length on create; reject oversized
  payloads before they reach Claude. **S**
- [ ] **Error monitoring** — add Sentry (client + server), a React error
  boundary, and stop leaking raw error messages to the SSE client. **M**
- [ ] **Surface stream/turn errors in the UI** — `useStreamingResponse`
  currently swallows `parsed.error`; show a retry affordance when a turn
  or feedback request fails. **S**
- [ ] **Streaming route limits** — set an explicit serverless function
  timeout/`maxDuration` for the turn route so hung streams fail cleanly. **S**
- [ ] **Update the Claude model** — `turn` and `feedback` routes hardcode
  `claude-sonnet-4-20250514`; move the model ID to one constant and
  bump to the current Sonnet (`claude-sonnet-4-6`). **S**

## Phase 2 — User Accounts & Debate History 📚 *(core product)*

Once users exist, give them a reason to come back.

- [ ] **"My Debates" dashboard** — list past debates with topic, persona,
  outcome/score, date; resume in-progress ones. **M**
- [ ] **Profile & progress** — aggregate stats: debates completed,
  average scores per dimension, score trend over time. **M**
- [ ] **Feedback persistence & comparison** — keep feedback history so a
  user can see improvement across debates (the score is already stored
  per debate; surface it). **S**
- [ ] **Shareable read-only debate links** — a public, signed,
  view-only URL for a finished debate (good for organic growth). **M**
- [ ] **Data hygiene** — soft-delete (`archived_at`), and a retention
  decision for abandoned debates. **S**

## Phase 3 — Immersive Stage Experience 🎭 *(the differentiator)*

This is the product vision: evolve from a text tool into a multimedia
debate stage. Build on the existing `live-stage` + audio-reactive bars.

- [ ] **Speaking/thinking avatar pose variants** — `Persona` already has
  `avatarUrlSpeaking`/`avatarUrlThinking` fields wired; generate the pose
  art and drop into `public/personas/`. **S**
- [ ] **Animated avatars** — mouth open/close keyed to `isSpeaking` and
  amplitude; later, lip-sync (viseme/phoneme) for a bigger lift. **L**
- [ ] **Audio polish** — crossfade between streamed sentences, pre-warm
  TTS for the next turn, "stage" ambience. **M**
- [ ] **Persona voice tuning** — verify each `elevenLabsVoiceId` matches
  the persona's character; expose a voice preview in the setup screen. **S**

## Phase 4 — Growth & Marketability 🚀

- [ ] **Leaderboards & ELO** — rate users (and personas) by debate
  performance; weekly boards. **M**
- [ ] **Custom & community personas** — let users define a persona
  (style, ideology, voice) from a guided form. **L**
- [ ] **Topic packs** — curated/seasonal topic collections beyond the
  current 12 hardcoded topics; move topics to the database. **M**
- [ ] **Human-vs-human debates** — realtime two-player mode with the AI
  as judge/moderator. **L**
- [ ] **PWA / mobile** — installable, offline-aware shell. **M**
- [ ] **Monetization** — free tier (browser TTS) vs premium tier
  (ElevenLabs voices, unlimited debates, history); Stripe billing. **L**

## Cross-cutting / tech debt

- [ ] **Tests** — Vitest for `state-machine`, `prompt-builder`,
  SSE parsing; Playwright for one happy-path debate. Add a `test` script. **M**
- [ ] **CI** — GitHub Actions: typecheck, lint, test on PRs. **S**
- [ ] **Configure ESLint** — `next lint` currently prompts for setup;
  commit a config. **S**
- [ ] **Move hardcoded content to data** — personas, topics, and stage
  instructions are in code; database-backed content enables Phase 4. **M**
- [ ] **Deployment config** — `vercel.json` / function settings,
  documented env vars, production Supabase project. **S**

---

## Suggested sequencing

1. **Phase 1** in full — non-negotiable before any public/shared link.
2. **Phase 2** dashboard + history — turns one-shot demos into a product.
3. **Phase 3** incrementally — pose variants first (cheap, high impact),
   animation later.
4. **Phase 4** once retention is proven.

Run the **tests + CI** items alongside Phase 1 so hardening work is
protected from regressions.
