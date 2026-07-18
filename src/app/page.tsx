import Link from "next/link";
import { getAllPersonas } from "@/lib/debate/personas";
import { PersonaAvatar } from "@/components/debate/persona-avatar";
import { FREE_DEBATE_LIMIT } from "@/lib/billing/tier";
import { isTwa } from "@/lib/platform/twa-server";

const STEPS = [
  {
    n: 1,
    title: "Pick a topic",
    body: "Choose from curated topic packs or bring your own motion.",
  },
  {
    n: 2,
    title: "Choose your opponent",
    body: "Face one of six distinct AI personas — or design your own.",
  },
  {
    n: 3,
    title: "Debate & get scored",
    body: "Trade opening, rebuttals, cross-exam, and closing — then get coached.",
  },
];

const FEATURES = [
  {
    icon: "🎭",
    title: "Six distinct personas",
    body: "Each argues with its own worldview, rhetoric, and voice.",
  },
  {
    icon: "🗣️",
    title: "An immersive stage",
    body: "Audio-reactive avatars and realistic voices bring the debate to life.",
  },
  {
    icon: "📊",
    title: "Coaching feedback",
    body: "Scored on argument, evidence, rebuttal, and rhetoric — with tips.",
  },
  {
    icon: "✨",
    title: "Custom personas",
    body: "Build an opponent with its own style, ideology, voice, and theme.",
  },
  {
    icon: "🏆",
    title: "Leaderboard",
    body: "Climb a performance ranking weighted by debate difficulty.",
  },
  {
    icon: "📚",
    title: "Topic packs",
    body: "Curated and seasonal collections, from tech & AI to ethics.",
  },
];

export default function Home() {
  const personas = getAllPersonas();
  // Play policy: no purchase/steering surfaces inside the Android app.
  const inTwa = isTwa();

  return (
    <div className="mx-auto max-w-5xl px-4">
      {/* Hero */}
      <section className="relative flex flex-col items-center py-20 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-72 max-w-2xl rounded-full bg-stage-accent/15 blur-3xl"
        />
        <span className="mb-5 rounded-full border border-stage-border bg-stage-surface px-3 py-1 text-xs font-medium text-stage-muted">
          AI-powered debate practice
        </span>
        <h1 className="max-w-3xl bg-gradient-to-r from-stage-accent to-purple-400 bg-clip-text text-5xl font-bold leading-tight text-transparent sm:text-6xl">
          Out-argue the AI. Sharpen your mind.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-stage-muted">
          Step onto a virtual stage and go head-to-head with AI debate
          personas in structured, turn-based debates — then get scored and
          coached on your performance.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/debate/new" className="btn-primary text-lg px-8 py-3">
            Start a Debate
          </Link>
          {!inTwa && (
            <Link
              href="/pricing"
              className="rounded-lg border border-stage-border px-8 py-3 text-lg font-medium text-stage-text transition-colors hover:border-stage-accent"
            >
              See Pricing
            </Link>
          )}
        </div>

        {/* Persona lineup */}
        <div className="mt-14 w-full">
          <p className="mb-4 text-xs uppercase tracking-wider text-stage-muted">
            Your opponents
          </p>
          <div className="flex flex-wrap items-start justify-center gap-x-6 gap-y-5">
            {personas.map((p) => (
              <div
                key={p.id}
                className="flex w-20 flex-col items-center gap-2 text-center"
              >
                <PersonaAvatar persona={p} size="md" showName={false} />
                <span className="text-xs font-medium leading-tight text-stage-text">
                  {p.displayName}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16">
        <h2 className="text-center text-2xl font-bold text-stage-text">
          How it works
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-stage-accent text-lg font-bold text-white">
                {s.n}
              </div>
              <h3 className="mt-3 font-semibold text-stage-text">{s.title}</h3>
              <p className="mt-1 text-sm text-stage-muted">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-16">
        <h2 className="text-center text-2xl font-bold text-stage-text">
          Everything you need to get better
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="debate-card p-5 transition-colors duration-200 hover:border-stage-accent/40"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-stage-accent/10 text-xl">
                {f.icon}
              </div>
              <h3 className="mt-3 font-semibold text-stage-text">{f.title}</h3>
              <p className="mt-1 text-sm text-stage-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing teaser — omitted in the Play app (no selling/steering). */}
      {!inTwa && (
        <section className="py-16">
          <div className="debate-card flex flex-col items-center gap-4 p-8 text-center sm:flex-row sm:justify-between sm:text-left">
            <div>
              <h2 className="text-xl font-bold text-stage-text">
                Start free, upgrade when you&apos;re hooked
              </h2>
              <p className="mt-1 text-sm text-stage-muted">
                {FREE_DEBATE_LIMIT} debates a month on the house. Go Premium for
                realistic voices and unlimited debates.
              </p>
            </div>
            <Link
              href="/pricing"
              className="btn-primary shrink-0 px-6 py-2.5"
            >
              View plans
            </Link>
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="py-20">
        <div className="debate-card flex flex-col items-center bg-gradient-to-br from-stage-accent/10 to-purple-500/5 p-12 text-center">
          <h2 className="text-3xl font-bold text-stage-text">
            Ready to step onto the stage?
          </h2>
          <p className="mt-3 max-w-md text-stage-muted">
            Pick a topic, choose an opponent, and start arguing in under a
            minute.
          </p>
          <Link
            href="/debate/new"
            className="btn-primary mt-6 text-lg px-8 py-3"
          >
            Start a Debate
          </Link>
        </div>
      </section>
    </div>
  );
}
