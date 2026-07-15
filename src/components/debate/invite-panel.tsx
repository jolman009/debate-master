"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Side } from "@/lib/debate/types";

interface InvitePanelProps {
  inviteToken: string | null;
  viewerSide: Side | null;
}

// Shown to the debate creator while the opponent's seat is empty. Only the
// owner receives an invite_token from the API, so the invitee (who somehow
// reopened this while still waiting) just sees a neutral waiting message.
export function InvitePanel({ inviteToken, viewerSide }: InvitePanelProps) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (inviteToken) {
      setUrl(`${window.location.origin}/debate/join/${inviteToken}`);
    }
  }, [inviteToken]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked — the input is selectable as a fallback.
    }
  }

  const sideLabel = viewerSide === "pro" ? "PRO" : viewerSide === "con" ? "CON" : null;

  return (
    <div className="debate-card text-center py-6 space-y-3">
      <div className="flex items-center justify-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-stage-accent animate-pulse" />
        <p className="text-sm font-semibold text-stage-accent">
          Waiting for your opponent to join
        </p>
      </div>

      {sideLabel && (
        <p className="text-xs text-stage-muted">
          You&apos;re arguing{" "}
          <span
            className={
              viewerSide === "pro" ? "text-stage-pro font-semibold" : "text-stage-con font-semibold"
            }
          >
            {sideLabel}
          </span>
          . Send this link to whoever you want to debate.
        </p>
      )}

      {inviteToken ? (
        <div className="flex items-center gap-2 max-w-md mx-auto">
          <input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 min-w-0 rounded-lg border border-stage-border bg-stage-bg px-3 py-2 text-xs text-stage-text"
          />
          <Button size="sm" onClick={copy} className="shrink-0">
            {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-stage-muted">
          Hang tight — the debate will begin as soon as they arrive.
        </p>
      )}
    </div>
  );
}
