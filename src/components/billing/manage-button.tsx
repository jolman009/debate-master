"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ManageButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) throw new Error(data.error || "Could not open portal");
      window.location.href = data.url;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div>
      <Button variant="secondary" onClick={handleClick} disabled={loading}>
        {loading ? "Redirecting…" : "Manage subscription"}
      </Button>
      {error && <p className="mt-2 text-sm text-stage-con">{error}</p>}
    </div>
  );
}
