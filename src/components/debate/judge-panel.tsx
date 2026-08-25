"use client";

import { JudgeResult, JudgeSideScore, Side } from "@/lib/debate/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JudgePanelProps {
  judge: JudgeResult;
  // The viewer's side, so we can frame the result as "You won / You lost".
  viewerSide: Side | null;
  // Elo change for the viewer, when known.
  ratingDelta?: number | null;
}

export function JudgePanel({ judge, viewerSide, ratingDelta }: JudgePanelProps) {
  const { winner } = judge;
  const viewerResult =
    !viewerSide || winner === "draw"
      ? winner === "draw"
        ? "draw"
        : null
      : winner === viewerSide
      ? "win"
      : "loss";

  return (
    <section className="motion-panel space-y-6 border-y border-stage-border py-6">
      <Verdict
        winner={winner}
        viewerResult={viewerResult}
        ratingDelta={ratingDelta}
      />

      <div className="text-center max-w-2xl mx-auto">
        <Badge variant="warning" className="mb-3">
          AI-generated verdict and coaching
        </Badge>
        <p className="text-sm text-stage-muted">{judge.rationale}</p>
      </div>

      <div className="grid grid-cols-1 border-y border-stage-border sm:grid-cols-2">
        <SideCard
          side="pro"
          data={judge.pro}
          isWinner={winner === "pro"}
          isViewer={viewerSide === "pro"}
        />
        <SideCard
          side="con"
          data={judge.con}
          isWinner={winner === "con"}
          isViewer={viewerSide === "con"}
        />
      </div>
    </section>
  );
}

function Verdict({
  winner,
  viewerResult,
  ratingDelta,
}: {
  winner: Side | "draw";
  viewerResult: "win" | "loss" | "draw" | null;
  ratingDelta?: number | null;
}) {
  const headline =
    viewerResult === "win"
      ? "You win!"
      : viewerResult === "loss"
      ? "You lost"
      : viewerResult === "draw"
      ? "It's a draw"
      : winner === "draw"
      ? "It's a draw"
      : `${winner.toUpperCase()} wins`;

  const tone =
    viewerResult === "win"
      ? "text-stage-pro"
      : viewerResult === "loss"
      ? "text-stage-con"
      : "text-stage-accent";

  return (
    <div className="space-y-2 text-center">
      <p className="text-xs uppercase text-stage-muted">
        The Judge&apos;s Verdict
      </p>
      <h2 className={cn("text-3xl font-bold", tone)}>{headline}</h2>
      {winner !== "draw" && (
        <p className="text-sm text-stage-muted">
          {winner === "pro" ? "PRO" : "CON"} took the debate.
        </p>
      )}
      {typeof ratingDelta === "number" && (
        <p className="text-sm font-semibold">
          <span
            className={cn(
              "tabular-nums",
              ratingDelta > 0
                ? "text-stage-pro"
                : ratingDelta < 0
                ? "text-stage-con"
                : "text-stage-muted"
            )}
          >
            {ratingDelta > 0 ? "+" : ""}
            {Math.round(ratingDelta)} Elo
          </span>
        </p>
      )}
    </div>
  );
}

function SideCard({
  side,
  data,
  isWinner,
  isViewer,
}: {
  side: Side;
  data: JudgeSideScore;
  isWinner: boolean;
  isViewer: boolean;
}) {
  const sideColor = side === "pro" ? "text-stage-pro" : "text-stage-con";
  return (
    <div
      className={cn(
        "space-y-3 py-4 sm:px-4 sm:first:border-r sm:first:border-stage-border",
        isWinner
          ? "bg-stage-accent/5"
          : ""
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn("text-xs font-bold", sideColor)}>
            {side.toUpperCase()}
          </span>
          {isViewer && (
            <span className="text-xs uppercase text-stage-accent">
              you
            </span>
          )}
          {isWinner && (
            <span className="rounded-full bg-stage-accent px-2 py-0.5 text-xs font-semibold uppercase text-stage-on-accent">
              Winner
            </span>
          )}
        </div>
        <span className="shrink-0">
          <span className="tabular-nums text-2xl font-bold text-stage-accent">
            {data.score}
          </span>
          <span className="text-xs text-stage-muted">/10</span>
        </span>
      </div>

      <p className="text-xs text-stage-muted">{data.summary}</p>

      <div className="space-y-2">
        <ScoreBar label="Argument Strength" score={data.argumentStrength} />
        <ScoreBar label="Evidence Usage" score={data.evidenceUsage} />
        <ScoreBar label="Rebuttal Quality" score={data.rebuttalQuality} />
        <ScoreBar label="Rhetorical Skill" score={data.rhetoricalSkill} />
      </div>

      <div className="space-y-2 pt-1">
        <BulletList
          title="Strengths"
          items={data.strengths}
          className="text-stage-pro"
          marker="+"
        />
        <BulletList
          title="Could improve"
          items={data.improvements}
          className="text-stage-warning"
          marker="-"
        />
      </div>
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-stage-muted">{label}</span>
        <span className="tabular-nums font-semibold">{score}/10</span>
      </div>
      <div className="h-1.5 bg-stage-bg rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            score >= 7
              ? "bg-stage-pro"
              : score >= 4
              ? "bg-stage-warning"
              : "bg-stage-con"
          )}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );
}

function BulletList({
  title,
  items,
  className,
  marker,
}: {
  title: string;
  items: string[];
  className: string;
  marker: string;
}) {
  return (
    <div>
      <h4 className={cn("text-xs font-semibold mb-1", className)}>{title}</h4>
      <ul className="space-y-0.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-stage-muted flex gap-1.5">
            <span className={cn("shrink-0", className)}>{marker}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
