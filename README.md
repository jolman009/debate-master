# Debate Master

AI-powered debate platform where you sharpen your rhetorical skills against AI personas in structured, turn-based debates.

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- An [Anthropic API key](https://console.anthropic.com)

## Setup

1. **Install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

```bash
cp .env.local.example .env.local
```

Edit `.env.local` with your credentials:

```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

3. **Set up the database:**

Run every migration in `supabase/migrations/` **in numeric order** (001 →
004) in your Supabase SQL Editor (Dashboard > SQL Editor > New query).
Later migrations add ownership + RLS (002), soft-delete (003), and
shareable links (004); skipping them will break auth and sharing.

The initial schema (`001_initial_schema.sql`) is:

```sql
CREATE TABLE debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config JSONB NOT NULL,
  current_stage TEXT NOT NULL DEFAULT 'setup',
  feedback JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE debate_turns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'ai')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_turns_debate_id ON debate_turns(debate_id, created_at ASC);
```

4. **Start the dev server:**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.local.example` for the full, commented list. Summary:

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | ✅ | Claude API for debate turns and feedback |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon/publishable key |
| `ELEVENLABS_API_KEY` | — | Premium TTS voices; falls back to browser speech if unset |
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | — | Rate limiting; **both** required to enforce, otherwise no-op |
| `SENTRY_DSN` | — | Error monitoring; logs to console only if unset |
| `STRIPE_SECRET_KEY` + `STRIPE_PRICE_ID` | — | Enable the Premium tier (voices + unlimited debates); **both** required, otherwise billing is inert and nothing is gated |
| `STRIPE_WEBHOOK_SECRET` | — | Verify Stripe webhooks (subscription status sync) |
| `SUPABASE_SERVICE_ROLE_KEY` | — | Used **only** by the Stripe webhook to write subscription status (no user session) |
| `NEXT_PUBLIC_APP_URL` | — | Base URL for Stripe Checkout/Portal redirects (defaults to request origin) |

Optional integrations are inert until their keys are set — the app runs
fine with only the three required vars.

## Development

```bash
npm run dev        # start the dev server
npm run lint       # ESLint (next/core-web-vitals)
npm run typecheck  # tsc --noEmit
npm test           # run the Vitest unit suite
npm run test:watch # Vitest in watch mode
npm run build      # production build
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, and tests on every
push and pull request to `main`. Deployment targets Vercel (`vercel.json`);
the streaming routes set `maxDuration = 60` via route segment config.

## How to Use

1. Click **Start a Debate** on the landing page
2. **Pick a topic** from the curated list or enter your own
3. **Choose an AI opponent** — 6 personas with distinct debate styles
4. **Configure settings** — your side (Pro/Con), difficulty, rebuttal rounds, cross-examination toggle
5. Click **Step Onto the Stage** to begin
6. The debate follows this flow:
   - **Opening Statements** — you go first, then the AI responds
   - **Rebuttal Rounds** (1-2 cycles) — counter each other's arguments
   - **Cross-Examination** (optional) — AI asks probing questions, you answer
   - **Closing Statements** — final arguments from both sides
   - **Feedback** — get AI-generated scores and coaching on your performance

## AI Personas

| Persona | Style |
|---------|-------|
| **Destiny** | Utilitarian, data-driven, calls out logical fallacies |
| **Andrew Wilson** | Conservative Christian, Scripture-anchored, polite but firm |
| **Candace Owens** | Conservative populist, appeals to common sense |
| **Ben Shapiro** | Fast-talking, hypothetical framing, logic-focused |
| **Michael Knowles** | Traditionalist, natural law, rhetorical flourish |
| **Dave Smith** | Libertarian comedian, anti-government, uses humor |

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **Anthropic Claude API** (streaming responses)
- **Supabase** (PostgreSQL)
- **Vitest** (unit tests) · **GitHub Actions** (CI)
