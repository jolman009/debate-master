"use client";

import { DebateFeedback } from "@/lib/debate/types";
import { cn } from "@/lib/utils";

interface FeedbackPanelProps {
  feedback: DebateFeedback;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-stage-muted">{label}</span>
        <span className="font-semibold">{score}/10</span>
      </div>
      <div className="h-2 bg-stage-bg rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            score >= 7 ? "bg-stage-pro" : score >= 4 ? "bg-yellow-500" : "bg-stage-con"
          )}
          style={{ width: `${score * 10}%` }}
        />
      </div>
    </div>
  );
}

export function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  return (
    <div className="debate-card space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-1">Debate Feedback</h2>
        <div className="flex items-center justify-center gap-2">
          <span className="text-4xl font-bold text-stage-accent">
            {feedback.overallScore}
          </span>
          <span className="text-stage-muted text-lg">/10</span>
        </div>
      </div>

      <p className="text-sm text-stage-muted text-center">{feedback.summary}</p>

      <div className="space-y-3">
        <ScoreBar label="Argument Strength" score={feedback.argumentStrength} />
        <ScoreBar label="Evidence Usage" score={feedback.evidenceUsage} />
        <ScoreBar label="Rebuttal Quality" score={feedback.rebuttalQuality} />
        <ScoreBar label="Rhetorical Skill" score={feedback.rhetoricalSkill} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold text-stage-pro text-sm mb-2">
            Strengths
          </h3>
          <ul className="space-y-1">
            {feedback.strengths.map((s, i) => (
              <li key={i} className="text-sm text-stage-muted flex gap-2">
                <span className="text-stage-pro shrink-0">+</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="font-semibold text-yellow-500 text-sm mb-2">
            Areas for Improvement
          </h3>
          <ul className="space-y-1">
            {feedback.improvements.map((s, i) => (
              <li key={i} className="text-sm text-stage-muted flex gap-2">
                <span className="text-yellow-500 shrink-0">-</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
