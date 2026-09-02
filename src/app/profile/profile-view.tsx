"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface ProfileViewProps {
  user: {
    id: string;
    email: string;
    displayName: string;
    optIn: boolean;
    avatarUrl: string | null;
    isPremium: boolean;
  };
  counts: {
    debates: number;
    personas: number;
  };
  inTwa: boolean;
}

export function ProfileView({ user, counts, inTwa }: ProfileViewProps) {
  const router = useRouter();

  // Profile Form State
  const [displayName, setDisplayName] = useState(user.displayName);
  const [optIn, setOptIn] = useState(user.optIn);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Deletion Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          optIn,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save profile.");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText.trim().toUpperCase() !== "DELETE") {
      setDeleteError("Please type DELETE exactly to confirm.");
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete account.");
      }

      // Clear local storage and session items
      if (typeof window !== "undefined") {
        localStorage.removeItem("debate_user_avatar");
        localStorage.removeItem("debate_active_persona");
      }

      // Redirect home with deleted flag
      window.location.href = "/?account_deleted=1";
    } catch (err) {
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete account. Please contact support@debatemaster.app"
      );
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12 space-y-8">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stage-border pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-stage-muted">
            <Link href="/debate" className="hover:text-stage-accent transition-colors">
              ← Dashboard
            </Link>
            <span>/</span>
            <span className="text-stage-text">Account Settings</span>
          </div>
          <h1 className="font-editorial text-3xl font-bold tracking-tight text-stage-text">
            Account & Data Controls
          </h1>
          <p className="text-sm text-stage-muted">
            Manage your display settings, data ownership, and account lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stage-surface border border-stage-border">
            <Image
              src="/brand/debate-master-crest.png"
              alt="Debate Master"
              width={26}
              height={23}
              className="h-6 w-auto object-contain dark:hidden"
            />
            <Image
              src="/brand/debate-master-crest-dark.png"
              alt="Debate Master"
              width={26}
              height={23}
              className="hidden h-6 w-auto object-contain dark:block drop-shadow-[0_0_8px_rgba(184,141,76,0.35)]"
            />
          </div>
          <div>
            <span className="inline-block rounded-full bg-stage-accent/15 px-2.5 py-0.5 text-xs font-semibold text-stage-accent border border-stage-accent/30">
              {user.isPremium ? "Premium Member" : "Standard Plan"}
            </span>
          </div>
        </div>
      </div>

      {/* Profile & Display Name Card */}
      <div className="rounded-2xl border border-stage-border bg-stage-surface/70 p-6 sm:p-7 shadow-sm space-y-5">
        <div className="border-b border-stage-border/60 pb-4">
          <h2 className="text-lg font-semibold text-stage-text">Profile Information</h2>
          <p className="text-xs text-stage-muted">
            This information identifies your sparring sessions and leaderboard standing.
          </p>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-5">
          {saveSuccess && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-400">
              ✓ Profile changes saved successfully!
            </div>
          )}
          {saveError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
              {saveError}
            </div>
          )}

          {/* Email (Read-only) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
              Email Address
            </label>
            <input
              type="email"
              disabled
              value={user.email}
              className="w-full rounded-xl border border-stage-border bg-stage-surface-raised/50 px-3.5 py-2.5 text-sm text-stage-muted cursor-not-allowed"
            />
            <p className="text-[11px] text-stage-muted">
              Managed via Supabase secure authentication.
            </p>
          </div>

          {/* Display Name */}
          <div className="space-y-1.5">
            <label htmlFor="displayName" className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              maxLength={30}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Socrates"
              className="w-full rounded-xl border border-stage-border bg-stage-bg px-3.5 py-2.5 text-sm text-stage-text placeholder-stage-muted/50 focus:border-stage-accent focus:outline-none focus:ring-1 focus:ring-stage-accent transition-colors"
            />
            <p className="text-[11px] text-stage-muted">
              Your public name on the community leaderboard (up to 30 characters).
            </p>
          </div>

          {/* Leaderboard Opt-In Toggle */}
          <div className="flex items-start justify-between gap-4 rounded-xl border border-stage-border bg-stage-surface/50 p-4">
            <div className="space-y-0.5">
              <label htmlFor="leaderboardOptIn" className="text-sm font-medium text-stage-text cursor-pointer">
                Appear on Leaderboard
              </label>
              <p className="text-xs text-stage-muted">
                Allow your wins, win rates, and debate scores to rank publicly against other players.
              </p>
            </div>
            <input
              id="leaderboardOptIn"
              type="checkbox"
              checked={optIn}
              onChange={(e) => setOptIn(e.target.checked)}
              className="h-5 w-5 rounded border-stage-border text-stage-accent focus:ring-stage-accent cursor-pointer"
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving Changes..." : "Save Profile"}
            </Button>
          </div>
        </form>
      </div>

      {/* Data Inventory & Ownership Card */}
      <div className="rounded-2xl border border-stage-border bg-stage-surface/70 p-6 sm:p-7 shadow-sm space-y-4">
        <div className="border-b border-stage-border/60 pb-3">
          <h2 className="text-lg font-semibold text-stage-text">Your Data Inventory</h2>
          <p className="text-xs text-stage-muted">
            In accordance with Google Play and global privacy standards, you retain full ownership of your data.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-stage-border bg-stage-surface/50 p-4 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
              Debates Completed
            </span>
            <p className="text-2xl font-bold text-stage-text font-editorial">
              {counts.debates}
            </p>
            <p className="text-[11px] text-stage-muted">
              Stored rounds, turns, and AI coaching rubric evaluations.
            </p>
          </div>

          <div className="rounded-xl border border-stage-border bg-stage-surface/50 p-4 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
              Custom Personas
            </span>
            <p className="text-2xl font-bold text-stage-text font-editorial">
              {counts.personas}
            </p>
            <p className="text-[11px] text-stage-muted">
              Custom intellectual sparring opponents you designed.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-stage-muted pt-2">
          <span>Need help with data privacy?</span>
          <Link href="/feedback" className="text-stage-accent hover:underline">
            Contact Support & Feedback →
          </Link>
        </div>
      </div>

      {/* Danger Zone: Account Deletion (Google Play Required) */}
      <div className="rounded-2xl border border-red-500/30 bg-red-950/10 p-6 sm:p-7 shadow-sm space-y-4">
        <div className="flex items-start justify-between gap-4 border-b border-red-500/20 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-red-400 text-lg">⚠️</span>
              <h2 className="text-lg font-bold text-red-400 font-editorial">
                Danger Zone: Account Deletion
              </h2>
            </div>
            <p className="text-xs text-stage-muted max-w-lg">
              Permanently delete your account and erase all associated debate data. This satisfies Google Play data safety regulations and cannot be reversed.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <ul className="text-xs text-stage-muted space-y-1.5 list-disc pl-5">
            <li>All your past debates, turn logs, and coaching scorecards will be permanently erased.</li>
            <li>All custom created AI personas will be deleted.</li>
            <li>Your leaderboard history, statistics, and display name will be removed.</li>
            <li>Your login authentication session will be revoked immediately.</li>
          </ul>

          <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <p className="text-[11px] text-stage-muted">
              Want to take a break instead? You can simply sign out without deleting your progress.
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDeleteConfirmText("");
                setDeleteError(null);
                setShowDeleteModal(true);
              }}
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 hover:border-red-500 shrink-0"
            >
              Delete Account & Data
            </Button>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-red-500/40 bg-stage-bg p-6 space-y-5 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 border border-red-500/30 text-xl text-red-400">
                ⚠️
              </div>
              <div>
                <h3 id="delete-dialog-title" className="text-lg font-bold text-stage-text font-editorial">
                  Confirm Permanent Deletion
                </h3>
                <p className="text-xs text-red-400">
                  This action is irreversible. All data will be lost.
                </p>
              </div>
            </div>

            <p className="text-xs text-stage-muted leading-relaxed">
              To verify that you wish to permanently delete your account, debate history, and custom personas, type <strong className="font-mono text-red-400">DELETE</strong> below:
            </p>

            {deleteError && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                {deleteError}
              </div>
            )}

            <input
              type="text"
              autoFocus
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Type DELETE to confirm"
              className="w-full rounded-xl border border-red-500/30 bg-stage-surface/80 p-3 font-mono text-sm text-stage-text placeholder-stage-muted/50 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
            />

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText.trim().toUpperCase() !== "DELETE"}
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                {deleting ? "Erasing Data..." : "Permanently Delete Account"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
