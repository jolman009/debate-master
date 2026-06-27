import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { reportError } from "@/lib/observability";
import {
  buildCustomSystemPrompt,
  validateCustomPersonaInput,
  slugifyPersonaName,
  CustomPersonaInput,
} from "@/lib/debate/custom-persona";

export async function POST(req: Request) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Partial<CustomPersonaInput>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const validation = validateCustomPersonaInput(body);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const input: CustomPersonaInput = {
    displayName: body.displayName!.trim(),
    tagline: (body.tagline ?? "").trim(),
    ideology: (body.ideology ?? "").trim(),
    worldview: body.worldview!.trim(),
    voiceId: body.voiceId || undefined,
    pitch: body.pitch ?? 1,
    rate: body.rate ?? 1,
    theme: body.theme!,
  };

  const slug = `${slugifyPersonaName(input.displayName)}-${crypto
    .randomUUID()
    .slice(0, 6)}`;

  const { data, error } = await supabase
    .from("personas")
    .insert({
      slug,
      display_name: input.displayName,
      tagline: input.tagline,
      ideology: input.ideology,
      system_prompt: buildCustomSystemPrompt(input),
      voice_config: {
        pitch: input.pitch,
        rate: input.rate,
        voicePrefs: [],
        elevenLabsVoiceId: input.voiceId,
      },
      theme: input.theme,
      is_public: false,
      owner_id: user.id,
    })
    .select("slug")
    .single();

  if (error || !data) {
    reportError(error, { route: "POST /api/personas", userId: user.id });
    return NextResponse.json(
      { error: "Could not create persona" },
      { status: 500 }
    );
  }

  return NextResponse.json({ slug: data.slug }, { status: 201 });
}
