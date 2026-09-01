import { DebateStage } from "@/components/debate/debate-stage";
import { createServerClient } from "@/lib/supabase/server";
import { getPersonaBySlug } from "@/lib/debate/content";
import { FALLBACK_PERSONA } from "@/lib/debate/personas";
import { DebateConfig } from "@/lib/debate/types";
import { getTierForUser } from "@/lib/billing/tier-server";
import { Tier } from "@/lib/billing/tier";

interface DebatePageProps {
  params: { debateId: string };
}

export default async function DebatePage({ params }: DebatePageProps) {
  // Resolve the opponent persona server-side (handles custom personas that
  // aren't in code). DebateStage still streams live debate data client-side.
  const supabase = createServerClient();
  const [debateRes, userRes] = await Promise.all([
    supabase.from("debates").select("config").eq("id", params.debateId).maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const config = debateRes.data?.config as DebateConfig | undefined;
  const persona = config
    ? (await getPersonaBySlug(config.personaId)) ?? FALLBACK_PERSONA
    : FALLBACK_PERSONA;

  const user = userRes.data?.user;
  const tier: Tier = user ? await getTierForUser(supabase, user.id) : "free";

  return <DebateStage debateId={params.debateId} persona={persona} tier={tier} />;
}
