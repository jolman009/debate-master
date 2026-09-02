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
import { Tier } from "@/lib/billing/tier";
import { trackEvent } from "@/lib/analytics";

interface FeedbackPanelProps {
  feedback: DebateFeedback;
  config?: DebateConfig | null;
  persona?: Persona | null;
  tier?: Tier;
}

type Usefulness = "helpful" | "not_helpful" | "reported" | null;

const RUBRIC_LABELS: Record<keyof DebateFeedbackV2["rubric"], string> = {
  argumentStrength: "Argument Strength",
  evidenceUsage: "Evidence Usage",
  rebuttalQuality: "Rebuttal Quality",
  rhetoricalSkill: "Rhetorical Skill",
};

export function FeedbackPanel({
  feedback,
  config,
  persona,
  tier = "free",
}: FeedbackPanelProps) {
  const adapted = adaptFeedback(feedback);
  const [usefulness, setUsefulness] = useState<Usefulness>(null);
  const isPremium = tier === "premium";

  const handleUsefulness = async (rating: "helpful" | "not_helpful" | "reported") => {
    setUsefulness(rating);
    if (rating === "reported") {
      trackEvent("feedback_reported", {
        score: adapted.overallScore,
        version: feedback.version ?? 1,
      });
    } else {
      trackEvent("feedback_usefulness_rated", {
        usefulness: rating,
        score: adapted.overallScore,
        version: feedback.version ?? 1,
      });
    }
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
    if (!isPremium) return;
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
          <Badge variant="warning">AI Coach</Badge>
          {isPremium ? (
            <span className="rounded bg-stage-accent/15 px-2 py-0.5 text-xs font-semibold text-stage-accent border border-stage-accent/30">
              Pro Analysis
            </span>
          ) : (
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 text-xs text-stage-muted hover:text-stage-accent transition-colors"
            >
              <span>Free Overview</span>
              <span className="rounded bg-stage-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-stage-accent">
                Upgrade
              </span>
            </Link>
          )}
          {feedback.version !== 2 && <Badge>Legacy format</Badge>}
        </div>
        {isPremium ? (
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
        ) : (
          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 text-xs text-stage-muted hover:text-stage-accent border border-stage-border hover:border-stage-accent/40 rounded px-2.5 py-1 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-stage-accent"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Download notes (.md)
          </Link>
        )}
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
          isPremium={isPremium}
        />
        <CoachingClaimCard
          eyebrow="Priority improvement"
          claim={adapted.priorityImprovement}
          tone="warning"
          isPremium={isPremium}
        />
      </div>

      <div className="border-y border-stage-border bg-stage-bg py-5 px-3 sm:px-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-stage-text">
            Targeted Practice Drill
          </p>
          <span className="rounded bg-stage-surface-raised px-2 py-0.5 text-[11px] font-medium text-stage-accent border border-stage-border">
            AI Drill Generator
          </span>
        </div>

        {/* Independent field rationales */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="rounded-lg border border-stage-border/80 bg-stage-surface p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-stage-warning">
              Focus Weakness
            </span>
            <p className="text-xs font-semibold text-stage-text">
              {adapted.practiceRecommendation.focus}
            </p>
            <p className="text-[11px] text-stage-muted">
              Targeted based on your priority improvement area and rubric scoring.
            </p>
          </div>

          <div className="rounded-lg border border-stage-border/80 bg-stage-surface p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-stage-accent">
              Suggested Motion
            </span>
            <p className="text-xs font-semibold text-stage-text line-clamp-2">
              {adapted.practiceRecommendation.motion}
            </p>
            <p className="text-[11px] text-stage-muted">
              Chosen to provide clear opportunities to exercise this specific argument dynamic.
            </p>
          </div>

          <div className="rounded-lg border border-stage-border/80 bg-stage-surface p-3 space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-stage-pro">
              Difficulty Tier
            </span>
            <p className="text-xs font-semibold text-stage-text capitalize">
              {adapted.practiceRecommendation.difficulty}
            </p>
            <p className="text-[11px] text-stage-muted">
              Calibrated to match your {adapted.overallScore}/10 estimated performance level.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 pt-1">
          {isPremium ? (
            <Link
              href={`/debate/new?motion=${encodeURIComponent(
                adapted.practiceRecommendation.motion
              )}&difficulty=${encodeURIComponent(
                adapted.practiceRecommendation.difficulty
              )}&goal=${encodeURIComponent(adapted.practiceRecommendation.focus)}`}
              onClick={() =>
                trackEvent("practice_started", {
                  focus: adapted.practiceRecommendation.focus,
                  motion: adapted.practiceRecommendation.motion,
                  difficulty: adapted.practiceRecommendation.difficulty,
                })
              }
              className="btn-primary text-xs"
            >
              Start Targeted Practice Drill
            </Link>
          ) : (
            <Link
              href="/pricing"
              className="btn-secondary text-xs inline-flex items-center gap-2"
            >
              <span>Practice drill generator</span>
              <span className="text-[10px] uppercase font-bold text-stage-accent bg-stage-accent/15 px-1.5 py-0.5 rounded">
                Pro
              </span>
            </Link>
          )}
          {config && (
            <Link
              href={rematchHref}
              onClick={() =>
                trackEvent("debate_rematch", {
                  motion: rematchMotion,
                  personaId: rematchPersona,
                })
              }
              className="btn-secondary text-xs"
            >
              Rematch
            </Link>
          )}
          {isPremium && (
            <Button
              type="button"
              variant="secondary"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 text-xs"
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
          )}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Rubric details</h3>
          {!isPremium && (
            <Link
              href="/pricing"
              className="text-xs text-stage-accent hover:underline flex items-center gap-1"
            >
              Unlock deep rationale & citations →
            </Link>
          )}
        </div>
        <div>
          {Object.entries(adapted.rubric).map(([key, item]) => (
            <RubricRow
              key={key}
              label={RUBRIC_LABELS[key as keyof DebateFeedbackV2["rubric"]]}
              item={item}
              isPremium={isPremium}
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
  isPremium = false,
}: {
  eyebrow: string;
  claim: FeedbackCoachingClaim;
  tone: "pro" | "warning";
  isPremium?: boolean;
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
      {isPremium ? (
        <EvidenceList evidence={claim.evidence} />
      ) : (
        claim.evidence && claim.evidence.length > 0 && (
          <div className="mt-3 flex items-center justify-between gap-2 border-l-2 border-stage-accent/40 bg-stage-bg/50 px-2.5 py-1.5 text-xs text-stage-muted rounded-r">
            <span>
              Citing transcript in <strong>{getStageLabel(claim.evidence[0].stage)}</strong>
            </span>
            <Link
              href="/pricing"
              className="text-stage-accent hover:underline text-[11px] font-semibold whitespace-nowrap"
            >
              View quote (Pro) →
            </Link>
          </div>
        )
      )}
    </article>
  );
}

function RubricRow({
  label,
  item,
  isPremium = false,
}: {
  label: string;
  item: FeedbackRubricItem;
  isPremium?: boolean;
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
        {isPremium ? (
          <EvidenceList evidence={item.evidence} compact />
        ) : (
          item.evidence && item.evidence.length > 0 && (
            <div className="mt-3 rounded border border-stage-accent/25 bg-stage-accent/5 p-2.5 text-xs flex flex-wrap items-center justify-between gap-2">
              <span className="text-stage-text">
                🔒 {item.evidence.length} validated transcript {item.evidence.length === 1 ? "excerpt citation" : "excerpt citations"} available on <strong>Pro Coach</strong>.
              </span>
              <Link
                href="/pricing"
                className="font-semibold text-stage-accent hover:underline whitespace-nowrap"
              >
                Upgrade to Pro →
              </Link>
            </div>
          )
        )}
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
