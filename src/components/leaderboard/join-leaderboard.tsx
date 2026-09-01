"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { compressAvatarImage } from "@/lib/utils/image";

interface JoinLeaderboardProps {
  initialDisplayName: string;
  initialOptIn: boolean;
  initialAvatarUrl?: string | null;
}

const inputClass =
  "min-h-11 w-full rounded-lg border border-stage-border bg-stage-bg px-3 py-2 text-sm text-stage-text outline-none focus:border-stage-accent";

export function JoinLeaderboard({
  initialDisplayName,
  initialOptIn,
  initialAvatarUrl,
}: JoinLeaderboardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displayNameId = useId();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [optIn, setOptIn] = useState(initialOptIn);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const dataUrl = await compressAvatarImage(file, 256, 0.85);
      setAvatarUrl(dataUrl);
      if (typeof window !== "undefined") {
        localStorage.setItem("debate_user_avatar", dataUrl);
      }
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: dataUrl }),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setUploading(true);
    setError(null);
    try {
      setAvatarUrl(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("debate_user_avatar");
      }
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, optIn, avatarUrl }),
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
        Choose a public display name and avatar. Your email is never shown.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          aria-label="Upload profile image"
          onChange={handleAvatarChange}
          className="sr-only"
        />
        <div
          role="button"
          tabIndex={0}
          title="Click to upload profile photo"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className="relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-stage-border bg-stage-surface transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-stage-accent"
        >
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Profile avatar"
              fill
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-6 w-6 text-stage-muted"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-7 8-7s8 3 8 7v1H4v-1z" />
            </svg>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-stage-accent hover:underline text-left"
          >
            {avatarUrl ? "Change photo" : "Upload photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="text-xs text-stage-muted hover:text-stage-con hover:underline text-left"
            >
              Remove photo
            </button>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <label htmlFor={displayNameId} className="sr-only">
            Public display name
          </label>
          <input
            id={displayNameId}
            className={inputClass}
            value={displayName}
            maxLength={30}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
          />
        </div>
        <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm text-stage-muted">
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

      {error && <p role="alert" className="mt-2 text-sm text-stage-con">{error}</p>}
      {saved && !error && (
        <p role="status" aria-live="polite" className="mt-2 text-sm text-stage-accent">
          Saved.
        </p>
      )}
    </div>
  );
}
