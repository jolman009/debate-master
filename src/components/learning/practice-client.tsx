"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CycleView, LearningResponse, RuntimeSession } from "@/lib/learning/runtime-types";

async function api(path: string, method = "GET", body?: unknown) {
  const r = await fetch(`/api/learning/${path}`, { method, cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = r.status === 204 ? {} : await r.json();
  if (!r.ok) throw new Error(data.error ?? "Practice is unavailable.");
  return data;
}
const panel = "rounded-xl border border-stage-border bg-stage-surface p-5 space-y-4";

function ResponseEditor({ session, onSubmitted }: { session: RuntimeSession; onSubmitted: () => Promise<void> }) {
  const [content, setContent] = useState(session.draft);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Draft saved");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const revision = useRef(session.draft_revision);
  const saved = useRef(session.draft);
  const saving = useRef<Promise<void> | null>(null);
  const requestId = useRef("");
  const save = useCallback(async (text: string) => {
    if (saving.current) await saving.current;
    if (saved.current === text) return;
    const work = (async () => {
      setMessage("Saving…");
      try {
        const result = await api(`sessions/${session.session_id}/draft`, "PUT", { content: text, revision: revision.current });
        revision.current = result.revision; saved.current = text; setMessage("Draft saved");
      } catch (e) {
        setConflict(true); setError(e instanceof Error ? e.message : "Draft could not be saved."); setMessage("Draft not saved");
        throw e;
      }
    })();
    saving.current = work;
    try { await work; } finally { if (saving.current === work) saving.current = null; }
  }, [session.session_id]);
  useEffect(() => {
    if (busy || conflict || content === saved.current) return;
    setMessage("Unsaved changes");
    const timer = setTimeout(() => { void save(content).catch(() => {}); }, 900);
    return () => clearTimeout(timer);
  }, [content, busy, conflict, save]);
  useEffect(() => {
    const protect = (e: BeforeUnloadEvent) => { if (content !== saved.current) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [content]);
  async function submit() {
    if (busy || conflict) return;
    setBusy(true); setError("");
    try {
      await save(content);
      requestId.current ||= crypto.randomUUID();
      const kind = session.exercise.kind === "reassessment" ? "reassessment" : session.state === "coached" ? "revision" : "initial";
      await api(`sessions/${session.session_id}/responses`, "POST", { content, revision: revision.current, kind, requestId: requestId.current });
      await onSubmitted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
      // Reload persisted state after a provider failure; the answer stays stored.
      await onSubmitted().catch(() => {});
    } finally { setBusy(false); }
  }
  return <div className={panel}>
    <label htmlFor="practice-response" className="block font-semibold">{session.state === "coached" ? "Your revised response" : "Your response"}</label>
    <textarea id="practice-response" className="w-full min-h-40 rounded-lg border border-stage-border bg-stage-bg p-3 text-stage-text" maxLength={4000} value={content} disabled={busy || conflict} onChange={e => setContent(e.target.value)} aria-describedby="draft-status" />
    <p id="draft-status" className="text-sm text-stage-muted" role="status">{busy ? "Your response is being evaluated…" : message} · {content.length}/4,000 characters</p>
    {error && <p role="alert" className="text-stage-warning">{error}</p>}
    {conflict && <p className="text-sm">Copy your response before refreshing to load the saved version.</p>}
    <button className="btn-primary" disabled={busy || conflict || !content.trim()} onClick={submit}>{busy ? "Evaluating…" : session.state === "coached" ? "Submit revision" : "Get focused feedback"}</button>
  </div>;
}

function Coaching({ response }: { response: LearningResponse }) {
  const a = response.assessment;
  if (!a) return null;
  return <section className={panel}>
    <h3 className="font-semibold">{response.kind === "initial" ? "First response" : response.kind === "revision" ? "Revised response" : "Reassessment"}: {a.status === "valid" ? `${a.score}/10 · coaching estimate` : "Insufficient evidence to score"}</h3>
    <blockquote className="border-l-2 border-stage-accent pl-3 whitespace-pre-wrap">{response.content}</blockquote>
    <p>{a.rationale}</p>
    <p><strong>Strength: </strong>{a.strength}</p>
    <p><strong>Next correction: </strong>{a.correction}</p>
    <p>{a.retryInstruction}</p>
    {a.excerpts.map((excerpt, i) => <p key={i} className="text-sm text-stage-muted">From your response: “{excerpt}”</p>)}
  </section>;
}

export function PracticeClient({ cycleId }: { cycleId: string }) {
  const [view, setView] = useState<CycleView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  const reassessmentRequest = useRef("");
  const load = useCallback(async () => { const data = await api(`cycles/${cycleId}`); setView(data); }, [cycleId]);
  useEffect(() => { void load().catch(e => setError(e.message)); }, [load]);
  const drill = view?.sessions.find(s => s.exercise.kind === "drill");
  const retest = view?.sessions.find(s => s.exercise.kind === "reassessment");
  const active = retest ?? drill;
  const responses = useMemo(() => view?.responses.filter(r => r.session_id === active?.session_id) ?? [], [view?.responses, active?.session_id]);
  const pending = responses.find(r => r.status !== "evaluated");
  const leaseLive = pending?.lease_until && Date.parse(pending.lease_until) > Date.now();
  useEffect(() => {
    if (!active || active.state !== "evaluating") return;
    const timer = setInterval(() => { tick(n => n + 1); void load().catch(() => {}); }, 4000);
    return () => clearInterval(timer);
  }, [active, load]);
  const viewed = useRef(new Set<string>());
  useEffect(() => {
    if (!active || !view?.enabled) return;
    const candidates: [string, string | undefined][] = [[active.session_id, undefined], ...responses.filter(r => r.assessment).map(r => [r.id, r.id] as [string, string])];
    for (const [key, responseId] of candidates) {
      if (viewed.current.has(key)) continue;
      viewed.current.add(key);
      void api(`sessions/${active.session_id}/view`, "POST", responseId ? { responseId } : {}).catch(() => viewed.current.delete(key));
    }
  }, [active, responses, view?.enabled]);
  async function action(operation: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true); setError("");
    try { await operation(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Please retry."); await load().catch(() => {}); }
    finally { setBusy(false); }
  }
  async function startReassessment() {
    reassessmentRequest.current ||= crypto.randomUUID();
    await action(() => api(`cycles/${cycleId}/reassessment`, "POST", { requestId: reassessmentRequest.current }));
  }
  const initial = responses.find(r => r.kind === "initial")?.assessment;
  const revised = responses.find(r => r.kind === "revision")?.assessment;
  const comparable = initial?.status === "valid" && revised?.status === "valid" &&
    ["model", "rubricVersion", "promptVersion", "templateVersion", "difficulty", "sessionFormat"].every(k => initial.provenance[k] === revised.provenance[k]);
  return <div className="mx-auto max-w-3xl px-4 py-8 space-y-6 text-stage-text">
    <Link href={view ? `/debate/${view.cycle.origin_debate_id}` : "/debate"} className="text-sm text-stage-accent">← Back to debate</Link>
    <header className="space-y-2"><p className="text-xs uppercase tracking-wide text-stage-muted">Focused practice · 3–5 minutes</p><h1 className="text-3xl font-bold">{active?.exercise.title ?? "Your practice cycle"}</h1></header>
    {error && <div role="alert" className={panel}><p>{error}</p><button className="btn-secondary" onClick={() => { setError(""); void load().catch(e => setError(e.message)); }}>Refresh saved practice</button><Link href="/login" className="ml-3 underline">Sign in</Link></div>}
    {!view && !error && <p role="status">Loading your saved practice…</p>}
    {view && !view.enabled && <p role="status" className={panel}>Practice is paused. You can still read your saved work.</p>}
    {active && <>
      <section className={panel}><h2 className="text-lg font-semibold">{active.exercise.kind === "drill" ? "Your challenge" : "A new challenge for the same skill"}</h2>
        <p>{active.exercise.context}</p>
        {active.exercise.references.map((ref, i) => <div key={`${ref.turnId}-${i}`}><p className="text-xs text-stage-muted">{ref.role === "user" ? "Your transcript" : "Opposing argument"}</p><blockquote className="border-l-2 border-stage-accent pl-3 whitespace-pre-wrap">{ref.excerpt}</blockquote></div>)}
        <p>{active.exercise.instructions}</p>
        {active.exercise.kind === "drill" && <ul className="list-disc pl-5 text-sm text-stage-muted">{active.exercise.checks.map(c => <li key={c}>{c}</li>)}</ul>}
      </section>
      {responses.filter(r => r.assessment).map(r => <Coaching key={r.id} response={r} />)}
      {comparable && <p className={panel}>Within this exercise: {initial.score}/10 → {revised.score}/10 ({revised.score! - initial.score! > 0 ? "+" : ""}{revised.score! - initial.score!} points). This describes this revision, not general skill transfer.</p>}
      {view?.enabled && ["ready", "coached"].includes(active.state) && <ResponseEditor key={`${active.session_id}:${active.state}`} session={active} onSubmitted={load} />}
      {pending && <div className={panel}><p role="status">{leaseLive ? "The coach is evaluating your saved response…" : "Your answer is saved. Its evaluation needs another attempt."}</p><blockquote className="whitespace-pre-wrap">{pending.content}</blockquote>
        {view?.enabled && !leaseLive && pending.attempts < 3 && <button className="btn-primary" disabled={busy} onClick={() => action(() => api(`sessions/${active.session_id}/responses`, "POST", { requestId: pending.request_id, kind: pending.kind, content: pending.content, revision: active.draft_revision }))}>{busy ? "Evaluating…" : "Retry saved evaluation"}</button>}
        {pending.attempts >= 3 && !leaseLive && <p>Three attempts failed. Your answer is preserved; please contact support through <Link href="/feedback" className="underline">Feedback</Link>.</p>}
      </div>}
      {drill?.state === "completed" && !retest && <section className={panel}><h2 className="font-semibold">Drill completed</h2><p>Now try a parallel challenge without coaching hints. Completion and improvement are separate outcomes.</p><button className="btn-primary" disabled={busy || !view?.enabled} onClick={startReassessment}>{busy ? "Opening…" : "Start linked reassessment"}</button></section>}
      {retest?.state === "completed" && <section className={panel}><h2 className="text-xl font-semibold">Practice cycle completed</h2><p>You finished a drill, revision, and linked reassessment. This is a record of practice, not proof of transferable improvement.</p><details><summary className="cursor-pointer text-stage-accent">Review your earlier drill</summary><div className="mt-4 space-y-4">{view?.responses.filter(r => r.session_id === drill?.session_id && r.assessment).map(r => <Coaching key={r.id} response={r} />)}</div></details></section>}
    </>}
  </div>;
}
