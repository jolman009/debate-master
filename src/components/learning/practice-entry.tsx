"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function PracticeEntry({ sessionId, children }: { sessionId?: string; children: ReactNode }) {
  const router = useRouter();
  const requestId = useRef("");
  const [offer, setOffer] = useState<{ available: boolean; cycleId?: string; title?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setOffer(null);
    requestId.current = "";
    if (!sessionId) return;
    const abort = new AbortController();
    fetch(`/api/learning/cycles?debateId=${encodeURIComponent(sessionId)}`, { signal: abort.signal })
      .then(async r => { if (r.ok) setOffer(await r.json()); }).catch(() => {});
    return () => abort.abort();
  }, [sessionId]);
  if (!offer?.available) return <>{children}</>;
  async function start() {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (offer?.cycleId) { router.push(`/practice/${offer.cycleId}`); return; }
      requestId.current ||= crypto.randomUUID();
      const r = await fetch("/api/learning/cycles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ debateId: sessionId, requestId: requestId.current }) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      router.push(`/practice/${data.cycleId}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Practice is unavailable."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <button className="btn-primary text-xs" disabled={busy} onClick={start}>{busy ? "Opening practice…" : offer.cycleId ? "Resume your practice" : "Practice this weakness"}</button>
    {offer.title && <p className="text-xs text-stage-muted">{offer.title} · about 3–5 minutes</p>}
    {error && <p role="alert" className="text-sm text-stage-warning">{error}</p>}
  </div>;
}
