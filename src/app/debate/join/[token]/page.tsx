import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";

// Invitees land here from a shared invite link. `/debate/*` is already gated by
// middleware, so a signed-out visitor is bounced to /login and returned here
// after auth — new users sign up in that flow and are never blocked.
export default async function JoinDebatePage({
  params,
}: {
  params: { token: string };
}) {
  const supabase = createServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/debate/join/${params.token}`);
  }

  const { data: debateId, error } = await supabase.rpc(
    "join_debate_via_invite",
    { p_token: params.token }
  );

  if (!error && debateId) {
    redirect(`/debate/${debateId}`);
  }

  const message = error?.message || "This invite link is invalid or expired.";

  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center space-y-4">
      <h1 className="text-2xl font-bold">Couldn&apos;t join this debate</h1>
      <p className="text-stage-muted text-sm">{message}</p>
      <Link
        href="/debate"
        className="inline-block text-sm font-medium text-stage-accent hover:underline"
      >
        ← Back to your debates
      </Link>
    </div>
  );
}
