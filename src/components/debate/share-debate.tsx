"use client";

import { useState } from "react";

interface ShareDebateProps {
  debateId: string;
  initialShareToken: string | null;
}

/**
 * Owner control for read-only debate sharing: generates a public
 * /share/<token> link, copies it, and revokes it.
 */
export function ShareDebate({ debateId, initialShareToken }: ShareDebateProps) {
  const [shareToken, setShareToken] = useState<string | null>(
    initialShareToken
  );
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl =
    shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/share/${shareToken}`
      : "";

  async function enable() {
    setBusy(true);
    try {
      const res = await fetch(`/api/debate/${debateId}/share`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("share failed");
      const data = await res.json();
      setShareToken(data.shareToken);
    } catch {
      window.alert("Could not create a share link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (
      !window.confirm("Stop sharing this debate? The link will stop working.")
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/debate/${debateId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("revoke failed");
      setShareToken(null);
      setCopied(false);
    } catch {
      window.alert("Could not revoke the share link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the field is selectable as a fallback.
    }
  }

  if (!shareToken) {
    return (
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="btn-secondary px-4 py-2 text-sm disabled:opacity-50"
      >
        {busy ? "Creating link…" : "Share this debate"}
      </button>
    );
  }

  return (
    <div className="debate-card w-full max-w-md p-3">
      <p className="text-xs font-medium text-stage-muted">
        Anyone with this link can view this debate (read-only).
      </p>
      <div className="mt-2 flex items-center gap-2">
        <input
          readOnly
          value={shareUrl}
          onFocusCapture={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-stage-border bg-stage-bg px-2 py-1.5 text-xs text-stage-text"
        />
        <button
          type="button"
          onClick={copy}
          className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <button
        type="button"
        onClick={revoke}
        disabled={busy}
        className="mt-2 text-xs text-stage-muted transition-colors hover:text-stage-con disabled:opacity-50"
      >
        Stop sharing
      </button>
    </div>
  );
}
