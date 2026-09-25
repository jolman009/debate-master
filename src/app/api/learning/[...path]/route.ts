import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { learningEnabled } from "@/lib/learning/flags";
import { databaseResult, LearningError, openCycle, ownedRuntime, readCycle, recommendation, submitResponse } from "@/lib/learning/service";
import type { ResponseKind } from "@/lib/learning/runtime-types";
import { reportError } from "@/lib/observability";

export const maxDuration = 60;
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const integer = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
type Context = { params: { path: string[] } };
async function handler(request: Request, { params: { path } }: Context) {
  try {
    const auth = createServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) throw new LearningError("Sign in to practice.", 401);
    const write = request.method !== "GET";
    if (write && !learningEnabled(user.id)) throw new LearningError("Practice is paused. Your saved work is still available.", 503);
    if (write) {
      const limit = await checkRateLimit("ai", user.id);
      if (!limit.success) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    }
    if (!write && path.length === 1 && path[0] === "cycles" && !learningEnabled(user.id)) return NextResponse.json({ available: false });
    const db = createServiceClient();
    let body: Record<string, unknown> = {};
    if (write) {
      const text = await request.text();
      if (text.length > 12000) throw new LearningError("Request is too large.", 413);
      try { body = JSON.parse(text); } catch { throw new LearningError("Invalid request."); }
      if (!body || typeof body !== "object" || Array.isArray(body)) throw new LearningError("Invalid request.");
    }
    const keys = (...allowed: string[]) => { if (Object.keys(body).some(k => !allowed.includes(k))) throw new LearningError("Unexpected request fields."); };
    const id = path[1];
    if (path[0] === "cycles" && path.length === 1) {
      if (!write) {
        const debateId = new URL(request.url).searchParams.get("debateId");
        if (!uuid(debateId)) throw new LearningError("Expected debate ID.");
        const r = await recommendation(db, user.id, debateId);
        return NextResponse.json({ available: Boolean(r.existingCycleId || r.recommendation), cycleId: r.existingCycleId,
          title: r.recommendation?.exercise.title, competency: r.recommendation?.exercise.competency });
      }
      keys("debateId", "requestId");
      if (request.method !== "POST" || !uuid(body.debateId) || !uuid(body.requestId)) throw new LearningError("Expected debate and request IDs.");
      return NextResponse.json({ cycleId: await openCycle(db, user.id, body.debateId, body.requestId) });
    }
    if (!uuid(id)) throw new LearningError("Practice not found.", 404);
    if (path[0] === "cycles" && path.length === 2 && !write) return NextResponse.json(await readCycle(db, user.id, id));
    if (path[0] === "cycles" && path[2] === "reassessment" && path.length === 3 && request.method === "POST") {
      keys("requestId");
      if (!uuid(body.requestId)) throw new LearningError("Expected request ID.");
      const cycle = await readCycle(db, user.id, id);
      if (!cycle.enabled) throw new LearningError("This exercise is paused for review.", 503);
      const sessionId = databaseResult(await db.rpc("learning_reassess", { p_user_id: user.id, p_loop_id: id, p_request_id: body.requestId }));
      return NextResponse.json({ sessionId });
    }
    if (path[0] === "sessions" && path.length === 3 && write) {
      await ownedRuntime(db, user.id, id);
      if (path[2] === "draft" && request.method === "PUT") {
        keys("content", "revision");
        if (typeof body.content !== "string" || body.content.length > 4000 || !integer(body.revision)) throw new LearningError("Expected a draft up to 4,000 characters and its revision.");
        const revision = databaseResult(await db.rpc("learning_save_draft", { p_user_id: user.id, p_session_id: id, p_content: body.content, p_revision: body.revision }));
        return NextResponse.json({ revision });
      }
      if (path[2] === "responses" && request.method === "POST") {
        keys("content", "revision", "requestId", "kind");
        if (typeof body.content !== "string" || !body.content.trim() || body.content.length > 4000 || !integer(body.revision) || !uuid(body.requestId) || !["initial", "revision", "reassessment"].includes(String(body.kind))) throw new LearningError("Expected a response up to 4,000 characters, kind, revision and request ID.");
        const result = await submitResponse(db, user.id, id, { content: body.content, revision: body.revision, requestId: body.requestId, kind: body.kind as ResponseKind });
        return NextResponse.json(result, { status: result.pending ? 202 : 200 });
      }
      if (path[2] === "view" && request.method === "POST") {
        keys("responseId");
        if (body.responseId !== undefined && !uuid(body.responseId)) throw new LearningError("Invalid response ID.");
        databaseResult(await db.rpc("learning_view", { p_user_id: user.id, p_session_id: id, p_response_id: body.responseId ?? null }));
        return new Response(null, { status: 204 });
      }
    }
    throw new LearningError("Practice endpoint not found.", 404);
  } catch (error) {
    if (error instanceof LearningError) return NextResponse.json({ error: error.message }, { status: error.status });
    reportError(new Error("Learning request failed"), { route: "learning", method: request.method });
    return NextResponse.json({ error: "Practice is unavailable. Your saved work is preserved." }, { status: 500 });
  }
}
async function route(request: Request, context: Context) {
  const response = await handler(request, context);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const GET = route;
export const POST = route;
export const PUT = route;
