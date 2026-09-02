import Image from "next/image";
import Link from "next/link";
import { PersonaAvatar } from "@/components/debate/persona-avatar";
import { FREE_DEBATE_LIMIT } from "@/lib/billing/tier";
import { getAllPersonas } from "@/lib/debate/personas";
import { isTwa } from "@/lib/platform/twa-server";

const ROUNDS = [
  {
    number: "01",
    title: "Set the motion",
    body: "Choose a focused question, take a side, and set the level of challenge.",
  },
  {
    number: "02",
    title: "Make the case",
    body: "Move through openings, rebuttals, cross-examination, and closing statements.",
  },
  {
    number: "03",
    title: "Study the tape",
    body: "Review AI-generated coaching grounded in the moments that shaped the debate.",
  },
];

export default function Home({
  searchParams,
}: {
  searchParams?: { account_deleted?: string };
}) {
  const personas = getAllPersonas();
  const inTwa = isTwa();

  return (
    <div className="overflow-hidden">
      {searchParams?.account_deleted === "1" && (
        <div className="bg-stage-surface border-b border-stage-border py-3 px-4 text-center text-xs sm:text-sm font-medium text-stage-text">
          ✓ Your account, debates, and personal data have been permanently deleted.
        </div>
      )}
      <section className="hero-stage relative isolate flex min-h-[31rem] items-end overflow-hidden bg-[#08090d] text-white sm:min-h-[34rem] lg:min-h-[38rem]">
        <Image
          src="/images/debate-stage-hero.png"
          alt="An empty debate chamber with two illuminated lecterns"
          fill
          priority
          sizes="100vw"
          className="stage-depth -z-20 object-cover object-[64%_center] sm:object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(5,6,10,0.96)_0%,rgba(5,6,10,0.78)_36%,rgba(5,6,10,0.12)_72%),linear-gradient(0deg,rgba(5,6,10,0.8)_0%,transparent_48%)]"
        />

        <div className="mx-auto w-full max-w-6xl px-4 pb-14 pt-24 sm:px-8 sm:pb-20 lg:px-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            <div className="max-w-xl">
              <div className="mb-5 flex items-center gap-3.5">
                <div className="relative flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-black/60 shadow-xl backdrop-blur-md transition-transform hover:scale-105">
                  <Image
                    src="/brand/debate-master-crest-dark.png"
                    alt="Debate Master Emblem"
                    width={40}
                    height={36}
                    className="drop-shadow-[0_0_12px_rgba(184,141,76,0.4)]"
                    priority
                  />
                </div>
                <div className="border-l-2 border-stage-accent pl-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/90">
                    Debate Master
                  </p>
                  <p className="text-xs text-white/60">Structured debate practice</p>
                </div>
              </div>

              <h1 className="motion-hero-title font-editorial text-5xl font-semibold leading-[1.02] text-white sm:text-7xl">
                Debate Master
              </h1>
              <p className="motion-hero-copy mt-5 max-w-lg text-lg leading-7 text-white/80 sm:text-xl sm:leading-8">
                Build sharper arguments under pressure, then see exactly where
                your case held and where it gave way.
              </p>
              <div className="motion-hero-actions mt-8 flex flex-wrap items-center gap-5">
                <Link href="/debate/new" className="btn-primary px-7 py-3 text-base">
                  Start a debate
                </Link>
                {!inTwa && (
                  <Link
                    href="/pricing"
                    className="inline-flex min-h-11 items-center text-sm font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors hover:decoration-stage-accent"
                  >
                    View plans
                  </Link>
                )}
              </div>
            </div>

            {/* Desktop Hero Showcase Medallion */}
            <div className="hidden lg:flex items-center justify-center">
              <div className="group relative flex flex-col items-center rounded-3xl border border-white/10 bg-black/45 p-8 shadow-2xl backdrop-blur-md transition-all duration-300 hover:border-stage-accent/30 hover:bg-black/55">
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-b from-stage-accent/20 to-transparent opacity-40 blur-xl transition-opacity group-hover:opacity-75" />
                <Image
                  src="/brand/debate-master-crest-dark.png"
                  alt="Debate Master Logo"
                  width={210}
                  height={189}
                  className="relative drop-shadow-[0_4px_24px_rgba(184,141,76,0.35)] transition-transform duration-300 group-hover:scale-105"
                  priority
                />
                <div className="relative mt-5 text-center">
                  <p className="font-editorial text-xl font-semibold tracking-wide text-white">
                    Debate<span className="text-stage-accent">Master</span>
                  </p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-widest text-white/60">
                    The AI Sparring Arena
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:px-10">
        <div className="max-w-md">
          <p className="text-sm font-semibold uppercase text-stage-accent">
            The format
          </p>
          <h2 className="font-editorial mt-3 text-4xl font-semibold leading-tight text-stage-text">
            Practice the argument, not the interface.
          </h2>
          <p className="mt-5 text-base leading-6 text-stage-muted">
            Each debate follows a clear competitive structure, so attention
            stays on reasoning, evidence, and response.
          </p>
        </div>

        <ol className="border-t border-stage-border">
          {ROUNDS.map((round) => (
            <li
              key={round.number}
              className="editorial-row grid gap-3 border-b border-stage-border py-7 sm:grid-cols-[3rem_1fr] sm:gap-5"
            >
              <span className="tabular-nums text-sm font-semibold text-stage-accent">
                {round.number}
              </span>
              <div>
                <h3 className="text-lg font-semibold text-stage-text">
                  {round.title}
                </h3>
                <p className="mt-2 max-w-xl text-base leading-6 text-stage-muted">
                  {round.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-stage-border bg-stage-surface">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-8 sm:py-28 lg:grid-cols-2 lg:items-center lg:px-10">
          <div>
            <p className="text-sm font-semibold uppercase text-stage-accent">
              Evidence-based coaching
            </p>
            <h2 className="font-editorial mt-3 max-w-lg text-4xl font-semibold leading-tight text-stage-text">
              Feedback points back to the exchange.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-6 text-stage-muted">
              AI-generated scores are presented as coaching estimates, with
              transcript evidence and a focused recommendation for the next
              round.
            </p>
            <Link
              href="/debate/new"
              className="mt-7 inline-flex min-h-11 items-center text-sm font-semibold text-stage-text underline decoration-stage-accent/60 underline-offset-4 transition-colors hover:text-stage-accent"
            >
              Put an argument on the record
            </Link>
          </div>

          <figure className="border-l-2 border-stage-accent pl-5 sm:pl-8">
            <blockquote className="font-editorial text-2xl leading-9 text-stage-text sm:text-3xl sm:leading-10">
              “You answered the objection directly, but the conclusion reached
              beyond the evidence you established.”
            </blockquote>
            <figcaption className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-stage-border pt-4 text-sm text-stage-muted">
              <span className="font-semibold text-stage-text">
                AI-generated coaching
              </span>
              <span>Rebuttal evidence</span>
              <span className="tabular-nums">7.8 / 10 estimate</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8 sm:py-28 lg:px-10">
        <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase text-stage-accent">
              The opponent room
            </p>
            <h2 className="font-editorial mt-3 text-4xl font-semibold leading-tight text-stage-text">
              Pressure-test your case from another point of view.
            </h2>
          </div>
          <p className="max-w-xl text-base leading-6 text-stage-muted lg:justify-self-end">
            Every AI persona is visibly labeled and brings a distinct rhetorical
            style. Choose the kind of resistance your argument needs.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 border-y border-stage-border sm:grid-cols-3 lg:grid-cols-6">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="editorial-row flex min-w-0 flex-col items-center gap-3 px-3 py-6 text-center"
            >
              <PersonaAvatar persona={persona} size="md" showName={false} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-stage-text">
                  {persona.displayName}
                </p>
                <p className="mt-1 text-sm text-stage-muted">AI persona</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-stage-border bg-stage-surface/30">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-7 px-4 py-16 sm:px-8 sm:py-20 md:flex-row md:items-center md:justify-between lg:px-10">
          <div className="flex items-center gap-5 sm:gap-6">
            <div className="relative hidden shrink-0 rounded-2xl border border-stage-border bg-stage-bg p-3 shadow-sm sm:flex">
              <Image
                src="/brand/debate-master-crest.png"
                alt="Debate Master Logo"
                width={54}
                height={48}
                className="dark:hidden"
              />
              <Image
                src="/brand/debate-master-crest-dark.png"
                alt="Debate Master Logo"
                width={54}
                height={48}
                className="hidden dark:block drop-shadow-[0_0_12px_rgba(184,141,76,0.3)]"
              />
            </div>
            <div>
              <h2 className="font-editorial text-4xl font-semibold leading-tight text-stage-text">
                Take the lectern.
              </h2>
              <p className="mt-3 max-w-xl text-base leading-6 text-stage-muted">
                Start with {FREE_DEBATE_LIMIT} debates each month. Choose a motion
                and begin in under a minute.
              </p>
            </div>
          </div>
          <Link href="/debate/new" className="btn-primary shrink-0 px-7 py-3 text-base">
            Start a debate
          </Link>
        </div>
      </section>
    </div>
  );
}
