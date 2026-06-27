import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { JoinLeaderboard } from "@/components/leaderboard/join-leaderboard";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "Leaderboard · Debate Master",
};

interface LeaderboardRow {
  user_id: string;
  display_name: string;
  rating: number;
  debates_completed: number;
  avg_score: number;
  best_score: number;
}

export default async function LeaderboardPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: boardData } = await supabase.rpc("get_leaderboard", {
    max_rows: 50,
  });
  const board = (boardData ?? []) as LeaderboardRow[];

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
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-stage-text">Leaderboard</h1>
        <p className="mt-0.5 text-sm text-stage-muted">
          Ranked by performance points — your debate scores weighted by
          difficulty (advanced ×1.5, intermediate ×1.25, beginner ×1).
        </p>
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

      {board.length === 0 ? (
        <div className="debate-card py-12 text-center text-sm text-stage-muted">
          No ranked debaters yet. Complete a debate and opt in to be the first!
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-stage-border">
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
              {board.map((row, i) => {
                const isMe = user?.id === row.user_id;
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
      )}
    </div>
  );
}
