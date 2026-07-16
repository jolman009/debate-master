import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { JoinLeaderboard } from "@/components/leaderboard/join-leaderboard";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Leaderboard · Debate Master",
};

interface PracticeRow {
  user_id: string;
  display_name: string;
  rating: number;
  debates_completed: number;
  avg_score: number;
  best_score: number;
}

interface RankedRow {
  user_id: string;
  display_name: string;
  elo_rating: number;
  wins: number;
  losses: number;
  draws: number;
  matches: number;
}

type Tab = "practice" | "ranked";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  // Two boards, because the numbers measure different things: Practice rates
  // how well you argued against an AI persona; Ranked is head-to-head Elo.
  const tab: Tab = searchParams.tab === "ranked" ? "ranked" : "practice";

  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: boardData } = await supabase.rpc(
    tab === "ranked" ? "get_ranked_leaderboard" : "get_leaderboard",
    { max_rows: 50 }
  );

  let profile: { display_name: string | null; leaderboard_opt_in: boolean } | null =
    null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("display_name, leaderboard_opt_in")
      .eq("user_id", user.id)
      .maybeSingle();
    profile = data;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-stage-text">Leaderboard</h1>
        <p className="mt-0.5 text-sm text-stage-muted">
          {tab === "ranked"
            ? "Head-to-head Elo. Everyone starts at 1200 — beat a stronger opponent, gain more."
            : "Ranked by performance points — your debate scores weighted by difficulty (advanced ×1.5, intermediate ×1.25, beginner ×1)."}
        </p>
      </div>

      <div className="mb-5 flex gap-1 rounded-lg border border-stage-border p-1 w-fit">
        <TabLink tab="practice" active={tab === "practice"} label="Practice" />
        <TabLink tab="ranked" active={tab === "ranked"} label="Ranked" />
      </div>

      {user ? (
        <div className="my-5">
          <JoinLeaderboard
            initialDisplayName={profile?.display_name ?? ""}
            initialOptIn={profile?.leaderboard_opt_in ?? false}
          />
        </div>
      ) : (
        <div className="debate-card my-5 p-4 text-sm text-stage-muted">
          <Link href="/login" className="text-stage-accent hover:underline">
            Sign in
          </Link>{" "}
          to set a display name and join the leaderboard.
        </div>
      )}

      {tab === "ranked" ? (
        <RankedBoard
          rows={(boardData ?? []) as RankedRow[]}
          currentUserId={user?.id}
        />
      ) : (
        <PracticeBoard
          rows={(boardData ?? []) as PracticeRow[]}
          currentUserId={user?.id}
        />
      )}
    </div>
  );
}

function TabLink({
  tab,
  active,
  label,
}: {
  tab: Tab;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={`/leaderboard?tab=${tab}`}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-stage-accent text-white"
          : "text-stage-muted hover:text-stage-text"
      )}
    >
      {label}
    </Link>
  );
}

function EmptyBoard({ message }: { message: string }) {
  return (
    <div className="debate-card py-12 text-center text-sm text-stage-muted">
      {message}
    </div>
  );
}

function RankedBoard({
  rows,
  currentUserId,
}: {
  rows: RankedRow[];
  currentUserId?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyBoard message="No ranked matches yet. Challenge a friend to a debate and opt in to be the first!" />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-stage-border">
      <table className="w-full text-sm">
        <thead className="bg-stage-surface text-xs uppercase tracking-wider text-stage-muted">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">#</th>
            <th className="px-4 py-2.5 text-left font-medium">Debater</th>
            <th className="px-4 py-2.5 text-right font-medium">Elo</th>
            <th className="px-4 py-2.5 text-right font-medium">W-L-D</th>
            <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
              Matches
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isMe = currentUserId === row.user_id;
            return (
              <tr
                key={row.user_id}
                className={cn(
                  "border-t border-stage-border",
                  isMe && "bg-stage-accent/10"
                )}
              >
                <td className="px-4 py-2.5 text-stage-muted">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-stage-text">
                  {row.display_name}
                  {isMe && (
                    <span className="ml-2 text-xs text-stage-accent">you</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-stage-accent">
                  {row.elo_rating}
                </td>
                <td className="px-4 py-2.5 text-right text-stage-muted tabular-nums">
                  <span className="text-stage-pro">{row.wins}</span>
                  {"-"}
                  <span className="text-stage-con">{row.losses}</span>
                  {"-"}
                  <span>{row.draws}</span>
                </td>
                <td className="hidden px-4 py-2.5 text-right text-stage-muted sm:table-cell">
                  {row.matches}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PracticeBoard({
  rows,
  currentUserId,
}: {
  rows: PracticeRow[];
  currentUserId?: string;
}) {
  if (rows.length === 0) {
    return (
      <EmptyBoard message="No ranked debaters yet. Complete a debate and opt in to be the first!" />
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-stage-border">
      <table className="w-full text-sm">
        <thead className="bg-stage-surface text-xs uppercase tracking-wider text-stage-muted">
          <tr>
            <th className="px-4 py-2.5 text-left font-medium">#</th>
            <th className="px-4 py-2.5 text-left font-medium">Debater</th>
            <th className="px-4 py-2.5 text-right font-medium">Rating</th>
            <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
              Debates
            </th>
            <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">
              Avg
            </th>
            <th className="px-4 py-2.5 text-right font-medium">Best</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isMe = currentUserId === row.user_id;
            return (
              <tr
                key={row.user_id}
                className={cn(
                  "border-t border-stage-border",
                  isMe && "bg-stage-accent/10"
                )}
              >
                <td className="px-4 py-2.5 text-stage-muted">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-stage-text">
                  {row.display_name}
                  {isMe && (
                    <span className="ml-2 text-xs text-stage-accent">you</span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-right font-bold text-stage-accent">
                  {row.rating}
                </td>
                <td className="hidden px-4 py-2.5 text-right text-stage-muted sm:table-cell">
                  {row.debates_completed}
                </td>
                <td className="hidden px-4 py-2.5 text-right text-stage-muted sm:table-cell">
                  {row.avg_score}
                </td>
                <td className="px-4 py-2.5 text-right text-stage-muted">
                  {row.best_score}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
