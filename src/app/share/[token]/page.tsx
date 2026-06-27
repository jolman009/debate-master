import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getPersonaBySlug } from "@/lib/debate/content";
import { FALLBACK_PERSONA } from "@/lib/debate/personas";
import {
  DebateConfig,
  DebateFeedback,
  DebateStage,
} from "@/lib/debate/types";
import { TurnDisplay } from "@/components/debate/turn-display";
import { FeedbackPanel } from "@/components/debate/feedback-panel";

export const metadata = {
  title: "Shared Debate · Debate Master",
};

interface SharedDebate {
  id: string;
  config: DebateConfig;
  current_stage: DebateStage;
  feedback: DebateFeedback | null;
  created_at: string;
}

interface SharedTurn {
  id: string;
  stage: DebateStage;
  role: "user" | "ai";
  content: string;
  created_at: string;
}

export default async function SharedDebatePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createServerClient();

  // Public read goes through the SECURITY DEFINER function — RLS still
  // hides the row from a direct query.
  const { data: debateRows } = await supabase.rpc("get_shared_debate", {
    token: params.token,
  });
  const debate = (debateRows?.[0] ?? null) as SharedDebate | null;
  if (!debate) notFound();

  const { data: turnRows } = await supabase.rpc("get_shared_debate_turns", {
    token: params.token,
  });
  const turns = (turnRows ?? []) as SharedTurn[];

  // A private custom persona isn't readable to anonymous viewers; fall back
  // to a neutral opponent so the shared transcript still renders.
  const persona =
    (await getPersonaBySlug(debate.config.personaId)) ?? FALLBACK_PERSONA;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-xs uppercase tracking-wider text-stage-muted">
          Shared debate · read-only
        </span>
        <Link href="/" className="text-xs text-stage-accent hover:underline">
          Try Debate Master →
        </Link>
      </div>

      <div className="debate-card mb-4 flex items-center gap-4 p-4">
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full font-bold text-white"
          style={{
            background: `linear-gradient(135deg, ${persona.theme.from}, ${persona.theme.to})`,
          }}
        >
          {persona.avatarUrl ? (
            <Image
              src={persona.avatarUrl}
              alt={persona.displayName}
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <span>{persona.displayName[0]}</span>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-stage-text">
            {debate.config.topic}
          </p>
          <p className="mt-0.5 text-xs text-stage-muted">
            {debate.config.userSide.toUpperCase()} vs {persona.displayName}
          </p>
        </div>
      </div>

      {turns.length === 0 ? (
        <p className="debate-card py-10 text-center text-sm text-stage-muted">
          This debate has no turns yet.
        </p>
      ) : (
        <div className="space-y-4">
          {turns.map((turn) => (
            <TurnDisplay
              key={turn.id}
              turn={{ ...turn, debate_id: debate.id }}
              personaName={persona.displayName}
            />
          ))}
        </div>
      )}

      {debate.feedback && (
        <div className="mt-6">
          <FeedbackPanel feedback={debate.feedback} />
        </div>
      )}
    </div>
  );
}
