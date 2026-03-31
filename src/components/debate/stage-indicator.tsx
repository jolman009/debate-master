"use client";

import { cn } from "@/lib/utils";
import { DebateConfig, DebateStage } from "@/lib/debate/types";
import { getVisibleStages, getStageLabel } from "@/lib/debate/state-machine";

interface StageIndicatorProps {
  config: DebateConfig;
  currentStage: DebateStage;
}

export function StageIndicator({ config, currentStage }: StageIndicatorProps) {
  const stages = getVisibleStages(config);
  const currentIdx = stages.indexOf(currentStage);

  // Group stages for a cleaner display
  const groups = [
    { label: "Opening", stages: stages.filter((s) => s.startsWith("opening")) },
    { label: "Rebuttal", stages: stages.filter((s) => s.startsWith("rebuttal")) },
    ...(config.crossExamEnabled
      ? [{ label: "Cross-Exam", stages: stages.filter((s) => s.startsWith("cross_exam")) }]
      : []),
    { label: "Closing", stages: stages.filter((s) => s.startsWith("closing")) },
    { label: "Feedback", stages: stages.filter((s) => s === "feedback") },
  ];

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {groups.map((group, gi) => {
        const groupStageIndices = group.stages.map((s) => stages.indexOf(s));
        const isActive = groupStageIndices.some((i) => i === currentIdx);
        const isComplete = groupStageIndices.every((i) => i < currentIdx);

        return (
          <div key={gi} className="flex items-center gap-1">
            {gi > 0 && (
              <div
                className={cn(
                  "w-6 h-px",
                  isComplete ? "bg-stage-accent" : "bg-stage-border"
                )}
              />
            )}
            <div
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                isActive && "bg-stage-accent text-white",
                isComplete && "bg-stage-accent/20 text-stage-accent",
                !isActive && !isComplete && "bg-stage-surface text-stage-muted"
              )}
            >
              {group.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}
