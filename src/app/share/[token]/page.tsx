import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getPersona } from "@/lib/debate/personas";
import {
  DebateConfig,
  DebateFeedback,
  DebateStage,
  PersonaId,
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

  const persona = getPersona(debate.config.personaId as PersonaId);

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
          className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full"
          style={{
            background: `linear-gradient(135deg, ${persona.theme.from}, ${persona.theme.to})`,
          }}
        >
          <Image
            src={persona.avatarUrl}
            alt={persona.displayName}
            fill
            sizes="48px"
            className="object-cover"
          />
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
