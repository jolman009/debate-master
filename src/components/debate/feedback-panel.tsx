"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DebateFeedback,
  DebateFeedbackV2,
  FeedbackCoachingClaim,
  FeedbackEvidenceReference,
  FeedbackRubricItem,
} from "@/lib/debate/types";
import { adaptFeedback } from "@/lib/debate/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStageLabel } from "@/lib/debate/state-machine";

interface FeedbackPanelProps {
  feedback: DebateFeedback;
}

type Usefulness = "helpful" | "not_helpful" | "reported" | null;

const RUBRIC_LABELS: Record<keyof DebateFeedbackV2["rubric"], string> = {
  argumentStrength: "Argument Strength",
  evidenceUsage: "Evidence Usage",
  rebuttalQuality: "Rebuttal Quality",
  rhetoricalSkill: "Rhetorical Skill",
};

export function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  const adapted = adaptFeedback(feedback);
  const [usefulness, setUsefulness] = useState<Usefulness>(null);

  return (
    <section className="motion-panel space-y-6 rounded-lg border border-stage-border bg-stage-surface p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="warning">AI-generated coaching</Badge>
        {feedback.version !== 2 && <Badge>Legacy feedback</Badge>}
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex h-24 w-24 flex-col items-center justify-center border-y border-stage-border bg-stage-bg">
          <span className="tabular-nums text-4xl font-bold text-stage-accent">
            {adapted.overallScore}
          </span>
          <span className="text-xs text-stage-muted">/10 estimate</span>
        </div>
        <div>
          <h2 className="font-editorial text-3xl font-semibold">Coaching Notes</h2>
          <p className="mt-2 text-sm text-stage-muted">{adapted.summary}</p>
          <p className="mt-2 text-xs text-stage-muted">
            Scores are coaching estimates generated from this debate, not
            objective judgments.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 border-y border-stage-border lg:grid-cols-2">
        <CoachingClaimCard
          eyebrow="Strongest moment"
          claim={adapted.strongestMoment}
          tone="pro"
        />
        <CoachingClaimCard
          eyebrow="Priority improvement"
          claim={adapted.priorityImprovement}
          tone="warning"
        />
      </div>

      <div className="border-y border-stage-border bg-stage-bg py-4 sm:px-4">
        <p className="text-sm font-semibold text-stage-text">
          Practice this weakness
        </p>
        <p className="mt-1 text-sm text-stage-muted">
          {adapted.practiceRecommendation.focus}
        </p>
        <p className="mt-2 text-xs text-stage-muted">
          Suggested motion: {adapted.practiceRecommendation.motion}
        </p>
        <div className="mt-4">
          <Link
            href={`/debate/new?motion=${encodeURIComponent(
              adapted.practiceRecommendation.motion
            )}&difficulty=${encodeURIComponent(
              adapted.practiceRecommendation.difficulty
            )}&goal=${encodeURIComponent(adapted.practiceRecommendation.focus)}`}
            className="btn-secondary"
          >
            Practice this weakness
          </Link>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Rubric details</h3>
        <div>
          {Object.entries(adapted.rubric).map(([key, item]) => (
            <RubricRow
              key={key}
              label={RUBRIC_LABELS[key as keyof DebateFeedbackV2["rubric"]]}
              item={item}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stage-border pt-4">
        <p className="text-xs text-stage-muted">
          Report only sends a usefulness signal; debate text is not attached.
        </p>
        <div className="flex flex-wrap gap-2">
          <UsefulnessButton
            active={usefulness === "helpful"}
            onClick={() => setUsefulness("helpful")}
          >
            Helpful
          </UsefulnessButton>
          <UsefulnessButton
            active={usefulness === "not_helpful"}
            onClick={() => setUsefulness("not_helpful")}
          >
            Not helpful
          </UsefulnessButton>
          <UsefulnessButton
            active={usefulness === "reported"}
            onClick={() => setUsefulness("reported")}
          >
            Report
          </UsefulnessButton>
        </div>
      </div>
      {usefulness && (
        <p role="status" aria-live="polite" className="motion-status text-sm text-stage-muted">
          Thanks. Your feedback was recorded locally for this session.
        </p>
      )}
    </section>
  );
}

function CoachingClaimCard({
  eyebrow,
  claim,
  tone,
}: {
  eyebrow: string;
  claim: FeedbackCoachingClaim;
  tone: "pro" | "warning";
}) {
  return (
    <article className="py-5 lg:px-5 lg:first:border-r lg:first:border-stage-border">
      <p
        className={cn(
          "text-xs font-semibold uppercase",
          tone === "pro" ? "text-stage-pro" : "text-stage-warning"
        )}
      >
        {eyebrow}
      </p>
      <h3 className="mt-2 text-lg font-semibold text-stage-text">
        {claim.title}
      </h3>
      <p className="mt-2 text-sm text-stage-muted">{claim.detail}</p>
      <EvidenceList evidence={claim.evidence} />
    </article>
  );
}

function RubricRow({
  label,
  item,
}: {
  label: string;
  item: FeedbackRubricItem;
}) {
  return (
    <details className="border-t border-stage-border bg-stage-bg px-1 py-4 last:border-b sm:px-4">
      <summary className="min-h-11 cursor-pointer py-2">
        <span className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-stage-text">{label}</span>
          <span className="tabular-nums text-sm font-semibold text-stage-accent">
            {item.score}/10
          </span>
        </span>
      </summary>
      <div className="details-content">
        <p className="mt-3 text-sm text-stage-muted">{item.rationale}</p>
        <EvidenceList evidence={item.evidence} compact />
      </div>
    </details>
  );
}

function EvidenceList({
  evidence,
  compact = false,
}: {
  evidence: FeedbackEvidenceReference[];
  compact?: boolean;
}) {
  if (evidence.length === 0) {
    return (
      <p className="mt-3 text-xs text-stage-muted">
        No validated transcript excerpt attached.
      </p>
    );
  }

  return (
    <div className={cn("mt-4 space-y-2", compact && "mt-3")}>
      {evidence.map((item) => (
        <blockquote
          key={`${item.turnId}-${item.excerpt}`}
          className="border-l-2 border-stage-accent/50 pl-3 text-xs text-stage-muted"
        >
          <p className="font-medium text-stage-text">
            {getStageLabel(item.stage)}
          </p>
          <p className="mt-1">{item.excerpt}</p>
        </blockquote>
      ))}
    </div>
  );
}

function UsefulnessButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "primary" : "secondary"}
      size="sm"
      onClick={onClick}
      aria-pressed={active}
    >
      {children}
    </Button>
  );
}
