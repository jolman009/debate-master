import Link from "next/link";
import Image from "next/image";
import { getStageLabel } from "@/lib/debate/state-machine";
import {
  DebateConfig,
  DebateFeedback,
  DebateStage,
  Persona,
} from "@/lib/debate/types";
import { DeleteDebateButton } from "./delete-debate-button";

export interface DebateSummary {
  id: string;
  config: DebateConfig;
  current_stage: DebateStage;
  feedback: DebateFeedback | null;
  updated_at: string;
}

const dateFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** A single row in the "My Debates" dashboard. Links through to resume/view. */
export function DebateCard({
  debate,
  persona,
}: {
  debate: DebateSummary;
  persona: Persona;
}) {
  const { config, current_stage, feedback, updated_at } = debate;
  const isComplete = current_stage === "complete";
  const awaitingFeedback = current_stage === "feedback" && !feedback;

  return (
    <div className="debate-card flex items-center gap-3 p-4 transition-colors hover:border-stage-accent">
      <Link
        href={`/debate/${debate.id}`}
        className="flex min-w-0 flex-1 items-center gap-4 transition-opacity hover:opacity-80"
      >
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

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-stage-text">
            {config.topic}
          </p>
          <p className="mt-0.5 truncate text-xs text-stage-muted">
            vs {persona.displayName} · {config.userSide.toUpperCase()} ·{" "}
            {dateFmt.format(new Date(updated_at))}
          </p>
        </div>

        <div className="shrink-0 text-right">
          {feedback ? (
            <span className="text-sm font-bold text-stage-accent">
              {feedback.overallScore}/10
            </span>
          ) : (
            <span className="text-xs font-medium text-stage-muted">
              {awaitingFeedback ? "Awaiting feedback" : "In progress"}
            </span>
          )}
          <p className="mt-0.5 text-[11px] text-stage-muted">
            {isComplete ? "Complete" : getStageLabel(current_stage)}
          </p>
        </div>
      </Link>

      <DeleteDebateButton debateId={debate.id} />
    </div>
  );
}
