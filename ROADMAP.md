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

## Phase 1 — Production Hardening 🔒 ✅ *(complete)*

The app was fully open: any visitor could read or inject turns into any
debate by ID, and every AI/TTS endpoint was callable without limits.
None of Phase 2–4 should ship publicly until this is done.

- [x] **Authentication** — Supabase Auth (email + password) via
  `@supabase/ssr` cookie-based sessions; `/login` page, `/auth/confirm`
  route, header auth menu. **M**
- [x] **Ownership in the schema** — `debates.user_id` added in migration
  `
  _auth_and_rls.sql`. **S**
- [x] **Row Level Security** — RLS enabled on `debates` and
  `debate_turns` with owner-only policies (`auth.uid() = user_id`). **M**
- [x] **Server key correctness** — server routes use the cookie-based
  user client, so they run as the signed-in user and RLS applies (no
  service-role key, no RLS bypass). **S**
- [x] **Rate limiting** — per-user/IP sliding-window limits on the AI
  turn, feedback, and TTS routes via `@upstash/ratelimit`; gated behind
  env vars (no-op until Upstash keys are set). **M**
- [x] **Input validation** — turn content capped at 10k chars; topic and
  motion length capped on create. **S**
- [x] **Error monitoring** — `reportError` seam + Sentry (activates when
  `SENTRY_DSN` is set), `global-error.tsx` boundary, and the turn route
  no longer leaks raw error detail to the SSE client. **M**
- [x] **Surface stream/turn errors in the UI** — `useStreamingResponse`
  exposes `streamError`; debate stage shows a dismissible banner with a
  Retry action, and the AI auto-trigger is guarded against retry loops. **S**
- [x] **Streaming route limits** — `maxDuration = 60` set on the turn
  and feedback routes. **S**
- [x] **Update the Claude model** — centralized in `CLAUDE_MODEL` and
  bumped to `claude-sonnet-4-6`. **S**

**Manual setup required** (Supabase dashboard):
1. Run `supabase/migrations/002_auth_and_rls.sql` in the SQL Editor.
2. Auth → Providers → Email: optionally turn **off** "Confirm email" for
   a frictionless pre-launch signup (the `/auth/confirm` route supports
   it being on).
3. Delete pre-auth test debates: `DELETE FROM debates WHERE user_id IS NULL;`

## Phase 2 — User Accounts & Debate History 📚 ✅ *(complete)*

Once users exist, give them a reason to come back.

- [x] **"My Debates" dashboard** — `/debate` lists past debates with
  topic, persona, score, and date; cards link through to resume/review. **M**
- [x] **Profile & progress** — `ProgressSummary` atop the dashboard:
  completion count, average/best score, per-dimension averages. **M**
- [x] **Feedback persistence & comparison** — progress summary shows the
  score trend vs the user's first debate. **S**
- [x] **Shareable read-only debate links** — opt-in opaque share token +
  `SECURITY DEFINER` functions (migration 004); public `/share/[token]`
  page shows the transcript + feedback scores read-only. **M**
- [x] **Data hygiene** — soft-delete via `archived_at` (migration 003);
  archived debates leave the dashboard but are recoverable. **S**

## Phase 3 — Immersive Stage Experience 🎭 *(done — only persona voice-id tuning, a human-judgement task, remains)*

This is the product vision: evolve from a text tool into a multimedia
debate stage. Build on the existing `live-stage` + audio-reactive bars.

- [x] **Animated avatars** — procedural amplitude-driven "talking" motion
  (jaw-drop stretch + lift) on the live-stage avatar; reads as speaking
  without new art. True viseme lip-sync still needs rigged assets. **L**
- [x] **Audio polish** — streamed sentences batched to ~150 chars before
  TTS for fewer, smoother clips; audio elements preload eagerly. **M**
- [x] **Voice preview in setup** — each persona card plays a sample line
  in its ElevenLabs voice (browser-speech fallback). **S**
- [x] **Speaking/thinking pose-variant art** — `<id>-speaking.png` /
  `<id>-thinking.png` for all 6 personas in `public/personas/`, derived
  locally from the base art (speaking = brighter/warmer/saturated,
  thinking = dimmed/desaturated/cool + vignette) and wired via
  `avatarUrlSpeaking`/`avatarUrlThinking` in `personas.ts`. **S**
- [ ] **Persona voice-id verification** — listen to each persona's
  `elevenLabsVoiceId` (now easy via the preview button) and adjust to
  taste. Human-judgement task. **S**

## Phase 4 — Growth & Marketability 🚀

- [ ] **Leaderboards & ELO** — rate users (and personas) by debate
  performance; weekly boards. **M**
- [x] **Custom personas** — guided form (`/personas/new`) to define a
  persona (name, style/worldview, ideology, voice, theme); owner-scoped
  via RLS, with locked fictional-framing + safety rules in the assembled
  prompt. Manage at `/personas`. Community/public *sharing* of personas
  is still a follow-up. **L**
- [x] **Topic packs** — DB-backed topics + curated packs (Core, Future &
  Technology, Ethics & Society) with pack-browsing UI (migrations 005/006). **M**
- [ ] **Human-vs-human debates** — realtime two-player mode with the AI
  as judge/moderator. **L**
- [ ] **PWA / mobile** — installable, offline-aware shell. **M**
- [ ] **Monetization** — free tier (browser TTS) vs premium tier
  (ElevenLabs voices, unlimited debates, history); Stripe billing. **L**

## Cross-cutting / tech debt

- [x] **Tests** — Vitest unit suite (32 tests) for `state-machine`,
  `prompt-builder`, and SSE parsing (parser extracted to `src/lib/sse.ts`
  for testability); `test`/`test:watch`/`typecheck` scripts added.
  Playwright happy-path e2e still pending. **M**
- [x] **CI** — GitHub Actions (`.github/workflows/ci.yml`): lint +
  typecheck + test on push/PR to `main`. **S**
- [x] **Configure ESLint** — `.eslintrc.json` (`next/core-web-vitals`);
  `eslint` + `eslint-config-next` installed, `next lint` no longer
  prompts. **S**
- [x] **Move hardcoded content to data** — topics fully DB-backed; personas
  resolved through a DB-backed content layer (`content.ts`) that merges
  built-ins with user-created custom personas, with in-code fallback.
  Stage instructions remain in code by design (tightly coupled to the state
  machine). **M**
- [x] **Deployment config** — `vercel.json` added; required vs optional
  env vars, dev scripts, and migration order documented in the README.
  Streaming routes set `maxDuration = 60` via route segment config.
  (Production Supabase project still a manual setup step.) **S**

---

## Suggested sequencing

1. **Phase 1** in full — non-negotiable before any public/shared link.
2. **Phase 2** dashboard + history — turns one-shot demos into a product.
3. **Phase 3** incrementally — pose variants first (cheap, high impact),
   animation later.
4. **Phase 4** once retention is proven.

Run the **tests + CI** items alongside Phase 1 so hardening work is
protected from regressions.
