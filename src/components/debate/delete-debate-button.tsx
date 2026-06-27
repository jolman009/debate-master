"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Soft-deletes (archives) a debate, then refreshes the dashboard. */
export function DeleteDebateButton({ debateId }: { debateId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!window.confirm("Remove this debate from your dashboard?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/debate/${debateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      router.refresh();
    } catch {
      setBusy(false);
      window.alert("Could not remove the debate. Please try again.");
    }
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      aria-label="Remove debate"
      title="Remove debate"
      className="shrink-0 rounded-lg p-2 text-stage-muted transition-colors hover:bg-stage-bg hover:text-stage-con disabled:opacity-50"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden
      >
        <path
          d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
