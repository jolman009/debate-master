import { expect, test } from "@playwright/test";
import { DRILL_TEMPLATES, type DrillFamily } from "../src/lib/learning/drill-templates";
import type { CycleView, LearningResponse } from "../src/lib/learning/runtime-types";

test.use({ serviceWorkers: "block" });

// UI integration fixtures only: hosted auth/RLS, concurrency and actual model
// output are covered separately. No inference, billing or telemetry calls.
for (const family of Object.keys(DRILL_TEMPLATES) as DrillFamily[]) {
  test(`${family}: saved draft, revision and linked reassessment`, async ({ page, baseURL }, testInfo) => {
    const t = DRILL_TEMPLATES[family];
    const cycleId = "60000000-0000-0000-0000-000000000001";
    const exercise = { family, templateVersion: t.version, title: t.title, competency: t.competency,
      difficulty: "beginner" as const, instructions: t.instructions, context: "Synthetic practice context.",
      references: [{ turnId: "source", role: "user" as const, excerpt: "An original learner claim." }],
      checks: t.checks, rubricVersion: "debate-anchors-1", promptVersion: "targeted-coach-1", model: "fixture", kind: "drill" as const };
    const view: CycleView = {
      cycle: { id: cycleId, user_id: "owner", origin_debate_id: "debate", cited_turn_id: "source", target_competency: t.competency, request_id: "request", created_at: "2026-09-25" },
      sessions: [{ session_id: "drill", loop_id: cycleId, exercise, state: "ready", draft: "", draft_revision: 0 }],
      responses: [], enabled: true,
    };
    let failureInjected = false;
    const errors: string[] = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.route("**/*", async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith("/monitoring")) return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
      if (url.origin !== new URL(baseURL!).origin) return route.abort();
      if (!url.pathname.startsWith("/api/learning/")) return route.continue();
      const req = route.request();
      const respond = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (req.method() === "GET") return respond(view);
      const body = req.postDataJSON();
      if (url.pathname.endsWith("/view")) return route.fulfill({ status: 204 });
      if (url.pathname.endsWith("/reassessment")) {
        view.sessions.push({ session_id: "retest", loop_id: cycleId, exercise: { ...exercise, kind: "reassessment", title: `Reassessment: ${t.title}`, context: t.retest, references: [] }, state: "ready", draft: "", draft_revision: 0 });
        return respond({ sessionId: "retest" });
      }
      const session = view.sessions.find(s => url.pathname.includes(`/${s.session_id}/`))!;
      if (url.pathname.endsWith("/draft")) {
        if (body.revision !== session.draft_revision) return respond({ error: "Draft changed" }, 409);
        session.draft = body.content; session.draft_revision++;
        return respond({ revision: session.draft_revision });
      }
      if (url.pathname.endsWith("/responses")) {
        let response = view.responses.find(r => r.session_id === session.session_id && r.kind === body.kind);
        if (!response) {
          response = { id: `response-${view.responses.length}`, session_id: session.session_id, request_id: body.requestId, kind: body.kind, content: body.content, status: "pending", assessment: null, attempts: 0, lease_until: null } as LearningResponse;
          view.responses.push(response);
        }
        // Exercise recovery for the first family while keeping the saved text.
        if (family === "counterargument" && !failureInjected) {
          failureInjected = true; response.status = "failed"; response.attempts++;
          session.state = "failed"; return respond({ error: "Synthetic provider failure; answer saved." }, 502);
        }
        response.status = "evaluated"; response.attempts++;
        response.assessment = { status: "valid", score: body.kind === "initial" ? 5 : 7,
          rationale: "The response addresses the task.", strength: "Clear reasoning.", correction: "Explain the assumption.",
          retryInstruction: "Add one limit.", excerpts: [body.content], provenance: { model: "fixture", sessionFormat: session.exercise.kind } };
        session.state = body.kind === "initial" ? "coached" : "completed";
        session.draft = ""; session.draft_revision++;
        return respond({ pending: false });
      }
      return respond({ error: "Unexpected endpoint" }, 404);
    });
    await page.goto(`/practice/${cycleId}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: t.title, exact: true })).toBeVisible();
    await page.getByLabel("Your response", { exact: true }).fill("My first answer.");
    await expect.poll(() => view.sessions[0].draft).toBe("My first answer.");
    await expect(page.locator("#draft-status")).toContainText("Draft saved");
    await page.screenshot({ path: testInfo.outputPath("practice.png"), fullPage: true });
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel("Your response", { exact: true })).toHaveValue("My first answer.");
    await page.getByRole("button", { name: "Get focused feedback" }).click();
    if (family === "counterargument") await page.getByRole("button", { name: "Retry saved evaluation" }).click();
    await expect(page.getByLabel("Your revised response")).toBeVisible();
    await page.getByLabel("Your revised response").fill("My revised answer includes a limit.");
    await page.getByRole("button", { name: "Submit revision" }).click();
    await expect(page.getByRole("heading", { name: "Drill completed" })).toBeVisible();
    await expect(page.getByText(/Within this exercise:/)).toContainText("+2 points");
    await page.getByRole("button", { name: "Start linked reassessment" }).click();
    await expect(page.getByRole("heading", { name: `Reassessment: ${t.title}`, exact: true })).toBeVisible();
    await page.getByLabel("Your response", { exact: true }).fill("My answer to the new challenge.");
    await page.getByRole("button", { name: "Get focused feedback" }).click();
    await expect(page.getByRole("heading", { name: "Practice cycle completed" })).toBeVisible();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Practice cycle completed" })).toBeVisible();
    expect(view.responses).toHaveLength(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}
