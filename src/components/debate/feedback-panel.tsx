"use client";

import { useState } from "react";
import Link from "next/link";
import {
  DebateConfig,
  DebateFeedback,
  DebateFeedbackV2,
  FeedbackCoachingClaim,
  FeedbackEvidenceReference,
  FeedbackRubricItem,
  Persona,
} from "@/lib/debate/types";
import { adaptFeedback } from "@/lib/debate/feedback";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getStageLabel } from "@/lib/debate/state-machine";

interface FeedbackPanelProps {
  feedback: DebateFeedback;
  config?: DebateConfig | null;
  persona?: Persona | null;
}

type Usefulness = "helpful" | "not_helpful" | "reported" | null;

const RUBRIC_LABELS: Record<keyof DebateFeedbackV2["rubric"], string> = {
  argumentStrength: "Argument Strength",
  evidenceUsage: "Evidence Usage",
  rebuttalQuality: "Rebuttal Quality",
  rhetoricalSkill: "Rhetorical Skill",
};

export function FeedbackPanel({ feedback, config, persona }: FeedbackPanelProps) {
  const adapted = adaptFeedback(feedback);
  const [usefulness, setUsefulness] = useState<Usefulness>(null);

  const handleUsefulness = async (rating: "helpful" | "not_helpful" | "reported") => {
    setUsefulness(rating);
    try {
      await fetch("/api/feedback/usefulness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usefulness: rating,
          feedbackVersion: feedback.version ?? 1,
          overallScore: adapted.overallScore,
        }),
      });
    } catch {}
  };

  const rematchMotion = config?.topic || "";
  const rematchPersona = config?.personaId || persona?.id || "";
  const rematchSide = config?.userSide || "pro";
  const rematchDifficulty = config?.difficulty || "intermediate";
  const rematchHref = `/debate/new?motion=${encodeURIComponent(
    rematchMotion
  )}&persona=${encodeURIComponent(rematchPersona)}&side=${encodeURIComponent(
    rematchSide
  )}&difficulty=${encodeURIComponent(rematchDifficulty)}`;

  const handleDownload = () => {
    const md = generateFeedbackMarkdown(adapted, config, persona);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = (config?.topic || "debate-coaching")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .slice(0, 40)
      .replace(/^-|-$/g, "");
    a.href = url;
    a.download = `coaching-notes-${slug || "feedback"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="motion-panel space-y-6 rounded-lg border border-stage-border bg-stage-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="warning">AI-generated coaching</Badge>
          {feedback.version !== 2 && <Badge>Legacy feedback</Badge>}
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 text-xs"
          aria-label="Download Coaching Notes as Markdown"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-stage-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Download notes
        </Button>
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
        <div className="mt-4 flex flex-wrap items-center gap-3">
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
          {config && (
            <Link href={rematchHref} className="btn-secondary">
              Rematch
            </Link>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points="7 10 12 15 17 10" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="12" y1="15" x2="12" y2="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Download notes (.md)
          </Button>
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
            onClick={() => handleUsefulness("helpful")}
          >
            Helpful
          </UsefulnessButton>
          <UsefulnessButton
            active={usefulness === "not_helpful"}
            onClick={() => handleUsefulness("not_helpful")}
          >
            Not helpful
          </UsefulnessButton>
          <UsefulnessButton
            active={usefulness === "reported"}
            onClick={() => handleUsefulness("reported")}
          >
            Report
          </UsefulnessButton>
        </div>
      </div>
      {usefulness && (
        <p role="status" aria-live="polite" className="motion-status text-sm text-stage-muted">
          Thanks. Your feedback was recorded.
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

function generateFeedbackMarkdown(
  adapted: DebateFeedbackV2,
  config?: DebateConfig | null,
  persona?: Persona | null
): string {
  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const topic = config?.topic || "Debate Practice";
  const opponent = persona?.displayName || "AI Persona";
  const side = (config?.userSide || "pro").toUpperCase();

  let md = `# Debate Master — Coaching Notes\n\n`;
  md += `**Date:** ${date}  \n`;
  md += `**Motion:** ${topic}  \n`;
  md += `**Matchup:** ${side} vs ${opponent}  \n`;
  md += `**Overall Score:** ${adapted.overallScore}/10 (Coaching Estimate)\n\n`;
  md += `## Summary\n\n${adapted.summary}\n\n`;

  md += `## Key Takeaways\n\n`;
  md += `### Strongest Moment: ${adapted.strongestMoment.title}\n`;
  md += `${adapted.strongestMoment.detail}\n\n`;
  if (adapted.strongestMoment.evidence && adapted.strongestMoment.evidence.length > 0) {
    md += `*Supporting Evidence:*\n`;
    for (const ev of adapted.strongestMoment.evidence) {
      md += `> "${ev.excerpt}" (${getStageLabel(ev.stage)})\n\n`;
    }
  }

  md += `### Priority Improvement: ${adapted.priorityImprovement.title}\n`;
  md += `${adapted.priorityImprovement.detail}\n\n`;
  if (adapted.priorityImprovement.evidence && adapted.priorityImprovement.evidence.length > 0) {
    md += `*Supporting Evidence:*\n`;
    for (const ev of adapted.priorityImprovement.evidence) {
      md += `> "${ev.excerpt}" (${getStageLabel(ev.stage)})\n\n`;
    }
  }

  md += `## Rubric Breakdown\n\n`;
  for (const [key, item] of Object.entries(adapted.rubric)) {
    const label = RUBRIC_LABELS[key as keyof DebateFeedbackV2["rubric"]] || key;
    md += `### ${label}: ${item.score}/10\n`;
    md += `${item.rationale}\n\n`;
    if (item.evidence && item.evidence.length > 0) {
      md += `*Evidence:*\n`;
      for (const ev of item.evidence) {
        md += `> "${ev.excerpt}" (${getStageLabel(ev.stage)})\n\n`;
      }
    }
  }

  md += `## Next Practice Recommendation\n\n`;
  md += `- **Focus:** ${adapted.practiceRecommendation.focus}\n`;
  md += `- **Suggested Motion:** ${adapted.practiceRecommendation.motion}\n`;
  md += `- **Difficulty:** ${adapted.practiceRecommendation.difficulty}\n`;
  if (adapted.practiceRecommendation.rationale) {
    md += `- **Rationale:** ${adapted.practiceRecommendation.rationale}\n`;
  }
  md += `\n---\n*Generated by Debate Master. Scores and feedback are simulated coaching estimates.*  \n`;

  return md;
}
