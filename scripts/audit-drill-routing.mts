/**
 * G1-2.1 routing audit: for real staging debates with v2 feedback, report
 * which drill families each debate can route to and, if not, why.
 * Read-only and content-free: prints debate ids and statuses, never transcript
 * text or excerpts.
 *
 *   STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx --yes tsx scripts/audit-drill-routing.mts [--limit 50] [--out report.json]
 *   add --detail to also print each competency's cited-quote shape, e.g.
 *   "user@rebuttal_user_1 (turn 4)" (speaker, stage and turn position only).
 *   npx --yes tsx scripts/audit-drill-routing.mts --input export.json   (offline: {debates:[{id,feedback}],turns:[{id,debate_id,role,content}]})
 *
 * Approved templates come from LEARNING_APPROVED_TEMPLATES, or all v2 templates.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { diagnoseRouting } from "@/lib/learning/recommendation";
import { DRILL_TEMPLATES } from "@/lib/learning/drill-templates";
import type { DebateFeedbackV2, DebateTurn } from "@/lib/debate/types";

type Row = { id: string; feedback: DebateFeedbackV2 | null };
type TurnRow = DebateTurn & { debate_id: string };
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const limit = Number(arg("--limit") ?? 50);

async function load(): Promise<{ debates: Row[]; turns: TurnRow[] }> {
  const input = arg("--input");
  if (input) return JSON.parse(readFileSync(input, "utf8"));
  const url = process.env.STAGING_SUPABASE_URL, key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  if (url !== "https://twtsdothnlfvbczzpdaj.supabase.co" || !key) throw new Error("Known staging URL and service key required");
  const db = createClient(url, key, { auth: { persistSession: false } });
  const debates = await db.from("debates").select("id,feedback").not("feedback", "is", null)
    .order("created_at", { ascending: false }).limit(limit);
  if (debates.error) throw new Error(`Debates query failed: ${debates.error.code}`);
  const ids = (debates.data as Row[]).map(d => d.id);
  const turns = ids.length ? await db.from("debate_turns").select("id,debate_id,role,stage,content").in("debate_id", ids).order("created_at") : { data: [], error: null };
  if (turns.error) throw new Error(`Turns query failed: ${turns.error.code}`);
  return { debates: debates.data as Row[], turns: turns.data as TurnRow[] };
}

const { debates, turns } = await load();
const approved = (process.env.LEARNING_APPROVED_TEMPLATES ?? "").split(",").map(s => s.trim()).filter(Boolean);
const versions = approved.length ? approved : Object.values(DRILL_TEMPLATES).map(t => t.version);
const results = debates.map(d => {
  const own = turns.filter(t => t.debate_id === d.id);
  if (!d.feedback || d.feedback.version !== 2) return { debateId: d.id, routable: false, reason: "not_v2_feedback", families: {} };
  const r = diagnoseRouting(d.feedback, own, versions);
  const shape = process.argv.includes("--detail") ? Object.fromEntries(
    Object.entries(d.feedback.rubric ?? {}).map(([k, item]) => [k, (item?.evidence ?? []).map(e => {
      const i = own.findIndex(t => t.id === e.turnId);
      return i < 0 ? "unknown turn" : `${own[i].role}@${own[i].stage ?? "?"} (turn ${i + 1})`;
    })])) : undefined;
  return { debateId: d.id, routable: r.routable, reason: r.routable ? undefined : "invalid_assessment_or_rubric",
    families: Object.fromEntries(r.families.map(f => [f.family, f.status])), ...(shape ? { citedQuotes: shape, promptVersion: d.feedback.assessment?.promptVersion,
      rebuttalAiQuotes: d.feedback.assessment?.rebuttalAiQuotes ?? "not recorded" } : {}) };
});
const totals: Record<string, Record<string, number>> = {};
for (const r of results) for (const [family, status] of Object.entries(r.families)) {
  totals[family] ??= {}; totals[family][status as string] = (totals[family][status as string] ?? 0) + 1;
}
const report = { checkedAt: new Date().toISOString(), approvedTemplates: versions, debatesChecked: results.length,
  routableDebates: results.filter(r => r.routable).length, totals, debates: results,
  note: "Statuses only. 'eligible' means the prerequisites hold; it does not judge drill quality." };
const out = arg("--out"); if (out) writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
