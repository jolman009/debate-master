import Link from "next/link";
import { createServerClient } from "@/lib/supabase/server";
import { PERSONA_COLUMNS, rowToPersona, PersonaRow } from "@/lib/debate/content";
import { PersonaAvatar } from "@/components/debate/persona-avatar";
import { Badge } from "@/components/ui/badge";
import { DeletePersonaButton } from "@/components/personas/delete-persona-button";

export const metadata = {
  title: "My Personas · Debate Master",
};

export default async function PersonasPage() {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data } = user
    ? await supabase
        .from("personas")
        .select(PERSONA_COLUMNS)
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
    : { data: [] };

  const personas = ((data ?? []) as PersonaRow[]).map(rowToPersona);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stage-text">My Personas</h1>
          <p className="mt-0.5 text-sm text-stage-muted">
            {personas.length} custom{" "}
            {personas.length === 1 ? "persona" : "personas"}
          </p>
        </div>
        <Link href="/personas/new" className="btn-primary px-5 py-2.5">
          Create persona
        </Link>
      </div>

      {personas.length === 0 ? (
        <div className="debate-card py-12 text-center">
          <p className="text-stage-muted">
            You haven&apos;t created any custom personas yet.
          </p>
          <Link
            href="/personas/new"
            className="btn-primary mt-4 inline-block px-5 py-2.5"
          >
            Create your first persona
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="debate-card flex items-center gap-3 p-4"
            >
              <div className="min-w-0 flex-1">
                <PersonaAvatar persona={persona} size="md" />
              </div>
              {persona.ideology && (
                <Badge variant="accent" className="hidden text-xs sm:inline-flex">
                  {persona.ideology}
                </Badge>
              )}
              <DeletePersonaButton slug={persona.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
