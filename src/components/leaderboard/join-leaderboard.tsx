"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface JoinLeaderboardProps {
  initialDisplayName: string;
  initialOptIn: boolean;
}

const inputClass =
  "w-full rounded-lg border border-stage-border bg-stage-bg px-3 py-2 text-sm text-stage-text outline-none focus:border-stage-accent";

export function JoinLeaderboard({
  initialDisplayName,
  initialOptIn,
}: JoinLeaderboardProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [optIn, setOptIn] = useState(initialOptIn);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, optIn }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="debate-card p-4">
      <h2 className="text-sm font-semibold text-stage-text">
        {initialOptIn ? "Your leaderboard profile" : "Join the leaderboard"}
      </h2>
      <p className="mt-0.5 text-xs text-stage-muted">
        Choose a public display name. Your email is never shown.
      </p>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          className={inputClass}
          value={displayName}
          maxLength={30}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Display name"
        />
        <label className="flex shrink-0 items-center gap-2 text-sm text-stage-muted">
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
          />
          Show me on the leaderboard
        </label>
        <Button onClick={handleSave} disabled={saving} className="shrink-0">
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>

      {error && <p className="mt-2 text-sm text-stage-con">{error}</p>}
      {saved && !error && (
        <p className="mt-2 text-sm text-stage-accent">Saved.</p>
      )}
    </div>
  );
}
