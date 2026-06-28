"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function UpgradeButton({ label = "Upgrade to Premium" }: { label?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Could not start checkout");
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div>
      <Button onClick={handleClick} disabled={loading}>
        {loading ? "Redirecting…" : label}
      </Button>
      {error && <p className="mt-2 text-sm text-stage-con">{error}</p>}
    </div>
  );
}
