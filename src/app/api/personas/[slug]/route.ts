import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function DELETE(
  _req: Request,
  { params }: { params: { slug: string } }
) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // RLS already restricts deletes to the owner; scoping by owner_id too keeps
  // the intent explicit and avoids deleting built-ins (owner_id IS NULL).
  const { error } = await supabase
    .from("personas")
    .delete()
    .eq("slug", params.slug)
    .eq("owner_id", user.id);

  if (error) {
    return NextResponse.json({ error: "Could not delete persona" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
