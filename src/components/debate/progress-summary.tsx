import { DebateFeedback } from "@/lib/debate/types";
import { DebateSummary } from "./debate-card";

type NumericDimension =
  | "argumentStrength"
  | "evidenceUsage"
  | "rebuttalQuality"
  | "rhetoricalSkill";

const DIMENSIONS: { key: NumericDimension; label: string }[] = [
  { key: "argumentStrength", label: "Argument" },
  { key: "evidenceUsage", label: "Evidence" },
  { key: "rebuttalQuality", label: "Rebuttal" },
  { key: "rhetoricalSkill", label: "Rhetoric" },
];

const avg = (nums: number[]) =>
  nums.reduce((a, b) => a + b, 0) / nums.length;

/**
 * Aggregate progress across a user's scored debates, shown atop the
 * dashboard. Renders nothing until there is at least one debate with
 * feedback. `debates` is expected newest-first.
 */
export function ProgressSummary({ debates }: { debates: DebateSummary[] }) {
  const scored = debates
    .map((d) => d.feedback)
    .filter((f): f is DebateFeedback => f != null);

  if (scored.length === 0) return null;

  const overall = scored.map((f) => f.overallScore);
  const average = avg(overall);
  const best = Math.max(...overall);
  const delta = scored[0].overallScore - scored[scored.length - 1].overallScore;

  return (
    <div className="debate-card mb-6 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-stage-muted">
        Your Progress
      </h2>

      <div className="mt-3 grid grid-cols-3 gap-4">
        <Stat label="Completed" value={String(scored.length)} />
        <Stat label="Avg score" value={average.toFixed(1)} suffix="/10" />
        <Stat label="Best" value={String(best)} suffix="/10" />
      </div>

      {scored.length >= 2 && (
        <p className="mt-3 text-xs text-stage-muted">
          <span
            className={
              delta > 0
                ? "text-stage-pro"
                : delta < 0
                ? "text-stage-con"
                : ""
            }
          >
            {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : "■ "}
            {delta !== 0 ? delta : "No change"}
          </span>{" "}
          {delta !== 0 && "since your first debate"}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {DIMENSIONS.map(({ key, label }) => {
          const val = avg(scored.map((f) => f[key]));
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-xs text-stage-muted">
                {label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stage-border">
                <div
                  className="h-full rounded-full bg-stage-accent"
                  style={{ width: `${(val / 10) * 100}%` }}
                />
              </div>
              <span className="w-8 shrink-0 text-right text-xs font-medium text-stage-text">
                {val.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  suffix,
}: {
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-2xl font-bold text-stage-text">
        {value}
        {suffix && (
          <span className="text-sm font-medium text-stage-muted">
            {suffix}
          </span>
        )}
      </p>
      <p className="text-xs text-stage-muted">{label}</p>
    </div>
  );
}
