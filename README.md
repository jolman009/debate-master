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

Run the migration SQL in your Supabase SQL Editor (Dashboard > SQL Editor > New query):

```sql
-- Paste contents of supabase/migrations/001_initial_schema.sql
```

Or copy-paste directly:

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
