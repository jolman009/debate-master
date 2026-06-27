import { DebateStage } from "@/components/debate/debate-stage";
import { createServerClient } from "@/lib/supabase/server";
import { getPersonaBySlug } from "@/lib/debate/content";
import { FALLBACK_PERSONA } from "@/lib/debate/personas";
import { DebateConfig } from "@/lib/debate/types";

interface DebatePageProps {
  params: { debateId: string };
}

export default async function DebatePage({ params }: DebatePageProps) {
  // Resolve the opponent persona server-side (handles custom personas that
  // aren't in code). DebateStage still streams live debate data client-side.
  const supabase = createServerClient();
  const { data } = await supabase
    .from("debates")
    .select("config")
    .eq("id", params.debateId)
    .maybeSingle();
  const config = data?.config as DebateConfig | undefined;
  const persona = config
    ? (await getPersonaBySlug(config.personaId)) ?? FALLBACK_PERSONA
    : FALLBACK_PERSONA;

  return <DebateStage debateId={params.debateId} persona={persona} />;
}
