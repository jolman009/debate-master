"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  purchasePlaySubscription,
  restorePlaySubscription,
  PLAY_SKUS,
} from "@/lib/billing/play-billing";

interface PlayUpgradeButtonProps {
  interval: "month" | "year";
  label?: string;
  className?: string;
}

export function PlayUpgradeButton({
  interval,
  label,
  className = "btn-primary w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2",
}: PlayUpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  const handleRestore = async () => {
    setRestoring(true);
    setErrorMsg(null);
    try {
      const result = await restorePlaySubscription();
      if (result.success) {
        router.refresh();
        window.location.href = "/pricing?status=success";
      } else {
        setErrorMsg(result.error || "Unable to restore your Google Play purchase.");
      }
    } finally {
      setRestoring(false);
    }
  };

  const handlePurchase = async () => {
    setLoading(true);
    setErrorMsg(null);

    const sku = interval === "year" ? PLAY_SKUS.yearly : PLAY_SKUS.monthly;

    try {
      const res = await purchasePlaySubscription(sku);
      if (res.success) {
        router.refresh();
        window.location.href = "/pricing?status=success";
      } else {
        if (res.error && res.error !== "Payment was cancelled.") {
          setErrorMsg(res.error);
        }
      }
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Failed to start Google Play purchase.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <button
        type="button"
        onClick={handlePurchase}
        disabled={loading || restoring}
        className={className}
      >
        {loading ? (
          <>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
            <span>Connecting to Google Play…</span>
          </>
        ) : (
          <>
            <span>{label || `Subscribe with Google Play — ${interval === "year" ? "$69.99/yr" : "$9.99/mo"}`}</span>
          </>
        )}
      </button>

      <button
        type="button"
        onClick={handleRestore}
        disabled={loading || restoring}
        className="w-full text-center text-sm text-sky-300 underline underline-offset-4 disabled:opacity-50"
      >
        {restoring ? "Restoring purchase…" : "Restore Google Play purchase"}
      </button>

      {errorMsg && (
        <p className="text-center text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded p-1.5">
          {errorMsg}
        </p>
      )}
    </div>
  );
}
