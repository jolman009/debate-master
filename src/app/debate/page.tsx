import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { DebateCard, DebateSummary } from "@/components/debate/debate-card";
import { ProgressSummary } from "@/components/debate/progress-summary";

export const metadata = {
  title: "My Debates · Debate Master",
};

export default async function DebatesDashboard() {
  const supabase = createServerClient();

  // RLS scopes this to the signed-in user's own debates.
  const { data } = await supabase
    .from("debates")
    .select("id, config, current_stage, feedback, updated_at")
    .is("archived_at", null)
    .order("updated_at", { ascending: false });

  const debates = (data ?? []) as DebateSummary[];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stage-text">My Debates</h1>
          <p className="mt-0.5 text-sm text-stage-muted">
            {debates.length} {debates.length === 1 ? "debate" : "debates"}
          </p>
        </div>
        <Link href="/debate/new" className="btn-primary px-5 py-2.5">
          New Debate
        </Link>
      </div>

      {debates.length === 0 ? (
        <div className="debate-card py-12 text-center">
          <p className="text-stage-muted">
            You haven&apos;t started any debates yet.
          </p>
          <Link
            href="/debate/new"
            className="btn-primary mt-4 inline-block px-5 py-2.5"
          >
            Start your first debate
          </Link>
        </div>
      ) : (
        <>
          <ProgressSummary debates={debates} />
          <div className="space-y-3">
            {debates.map((debate) => (
              <DebateCard key={debate.id} debate={debate} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
