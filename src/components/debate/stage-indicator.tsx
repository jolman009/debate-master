"use client";

import { cn } from "@/lib/utils";
import { DebateConfig, DebateStage } from "@/lib/debate/types";
import { getVisibleStages } from "@/lib/debate/state-machine";

interface StageIndicatorProps {
  config: DebateConfig;
  currentStage: DebateStage;
}

export function StageIndicator({ config, currentStage }: StageIndicatorProps) {
  const stages = getVisibleStages(config);
  // For "complete" (not in stages), treat as past the end so every group is done.
  const currentIdx =
    currentStage === "complete" ? stages.length : stages.indexOf(currentStage);

  const groups = [
    { label: "Opening", stages: stages.filter((s) => s.startsWith("opening")) },
    { label: "Rebuttal", stages: stages.filter((s) => s.startsWith("rebuttal")) },
    ...(config.crossExamEnabled
      ? [
          {
            label: "Cross-Exam",
            stages: stages.filter((s) => s.startsWith("cross_exam")),
          },
        ]
      : []),
    { label: "Closing", stages: stages.filter((s) => s.startsWith("closing")) },
    {
      // Human mode ends with a neutral judge verdict; AI mode with feedback.
      label: config.mode === "human" ? "Verdict" : "Feedback",
      stages: stages.filter((s) => s === "feedback" || s === "judge"),
    },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {groups.map((group, gi) => {
        const groupIndices = group.stages.map((s) => stages.indexOf(s));
        const isActive = groupIndices.some((i) => i === currentIdx);
        const isComplete = groupIndices.every((i) => i < currentIdx);

        // How many sub-stages have been finished within this group.
        const completedInGroup = groupIndices.filter((i) => i < currentIdx).length;

        return (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 && (
              <div
                className={cn(
                  "w-6 h-px transition-colors",
                  isComplete || isActive ? "bg-stage-accent" : "bg-stage-border"
                )}
              />
            )}
            <div
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                isActive && "bg-stage-accent text-white",
                isComplete && "bg-stage-accent/20 text-stage-accent",
                !isActive && !isComplete && "bg-stage-surface text-stage-muted"
              )}
            >
              <span>{group.label}</span>
              {group.stages.length > 1 && (
                <ProgressDots
                  total={group.stages.length}
                  filled={completedInGroup}
                  isActive={isActive}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressDots({
  total,
  filled,
  isActive,
}: {
  total: number;
  filled: number;
  isActive: boolean;
}) {
  return (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {Array.from({ length: total }).map((_, i) => {
        const isFilled = i < filled;
        const isCurrent = isActive && i === filled;
        return (
          <span
            key={i}
            className={cn(
              "block w-1.5 h-1.5 rounded-full transition-colors",
              isFilled
                ? "bg-current"
                : isCurrent
                ? "bg-current/60 animate-pulse"
                : isActive
                ? "bg-current/25"
                : "bg-current/20"
            )}
          />
        );
      })}
    </span>
  );
}
