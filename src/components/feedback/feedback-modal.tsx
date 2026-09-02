"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { isTwaClient } from "@/lib/platform/twa";

export type FeedbackCategory = "bug" | "feature" | "debate_quality" | "general";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  defaultCategory?: FeedbackCategory;
}

const CATEGORIES: { id: FeedbackCategory; label: string; icon: string; desc: string }[] = [
  { id: "bug", label: "Bug Report", icon: "🐞", desc: "Something isn't working as expected" },
  { id: "feature", label: "Feature Idea", icon: "💡", desc: "Suggest a feature or rule format" },
  { id: "debate_quality", label: "Debate & AI", icon: "⚖️", desc: "Opponent argumentation or judge scores" },
  { id: "general", label: "General Feedback", icon: "💬", desc: "Thoughts, suggestions, or comments" },
];

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Great", "Exceptional"];

export function FeedbackModal({ open, onClose, defaultCategory = "general" }: FeedbackModalProps) {
  const [category, setCategory] = useState<FeedbackCategory>(defaultCategory);
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (open) {
      setError(null);
      setSubmitted(false);
      setCategory(defaultCategory);
    }
  }, [open, defaultCategory]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && open) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (message.trim().length < 5) {
      setError("Please provide at least 5 characters of feedback.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          message: message.trim(),
          rating: rating ?? undefined,
          email: email.trim() || undefined,
          metadata: {
            platform: isTwaClient() ? "twa" : "web",
            url: typeof window !== "undefined" ? window.location.pathname : undefined,
            userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit feedback.");
      }

      setSubmitted(true);
      setMessage("");
      setRating(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-modal-title"
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-stage-border bg-stage-bg p-5 sm:p-7 shadow-2xl shadow-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-stage-border">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-stage-surface border border-stage-border">
              <Image
                src="/brand/debate-master-crest.png"
                alt="Debate Master"
                width={28}
                height={25}
                className="h-6 w-auto object-contain dark:hidden"
              />
              <Image
                src="/brand/debate-master-crest-dark.png"
                alt="Debate Master"
                width={28}
                height={25}
                className="hidden h-6 w-auto object-contain dark:block"
              />
            </div>
            <div>
              <h2 id="feedback-modal-title" className="font-editorial text-xl font-bold text-stage-text">
                Share Your Feedback
              </h2>
              <p className="text-xs text-stage-muted">
                Help us refine Debate Master coaches, judges, and features.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-1.5 text-stage-muted hover:bg-stage-surface hover:text-stage-text transition-colors"
          >
            ✕
          </button>
        </div>

        {submitted ? (
          <div className="py-8 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-2xl text-emerald-400">
              ✓
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-stage-text">Thank You!</h3>
              <p className="text-sm text-stage-muted max-w-sm mx-auto">
                Your feedback has been received and directly helps improve Debate Master.
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={onClose} className="w-full sm:w-auto px-8">
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-xs text-red-400">
                {error}
              </div>
            )}

            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
                Category
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((cat) => {
                  const active = category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategory(cat.id)}
                      className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                        active
                          ? "border-stage-accent bg-stage-accent/10 text-stage-text shadow-sm"
                          : "border-stage-border bg-stage-surface/60 text-stage-muted hover:border-stage-border-hover hover:text-stage-text"
                      }`}
                    >
                      <span className="text-sm mb-0.5">
                        <span className="mr-1.5">{cat.icon}</span>
                        <strong className="font-medium">{cat.label}</strong>
                      </span>
                      <span className="text-[11px] text-stage-muted line-clamp-1">
                        {cat.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Rating Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
                  Overall Experience (Optional)
                </label>
                {rating && (
                  <span className="text-xs font-medium text-stage-accent">
                    {RATING_LABELS[rating]}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => {
                  const filled = rating !== null && star <= rating;
                  return (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star === rating ? null : star)}
                      className={`h-9 w-9 rounded-lg border text-base flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
                        filled
                          ? "border-amber-500/50 bg-amber-500/10 text-amber-400"
                          : "border-stage-border bg-stage-surface/40 text-stage-muted/50 hover:text-stage-text"
                      }`}
                      aria-label={`Rate ${star} stars out of 5`}
                    >
                      ★
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Feedback Message */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="feedback-message" className="font-semibold uppercase tracking-wider text-stage-muted">
                  Message
                </label>
                <span className={message.length > 2800 ? "text-amber-400" : "text-stage-muted/70"}>
                  {message.length} / 3,000
                </span>
              </div>
              <textarea
                id="feedback-message"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={3000}
                placeholder={
                  category === "bug"
                    ? "What happened? Steps to reproduce the issue..."
                    : category === "feature"
                    ? "What capability or improvement would you like to see?"
                    : category === "debate_quality"
                    ? "Which AI opponent or judge behavior felt unnatural or unfair?"
                    : "Tell us what's on your mind..."
                }
                className="w-full resize-none rounded-xl border border-stage-border bg-stage-surface/80 p-3 text-sm text-stage-text placeholder-stage-muted/60 focus:border-stage-accent focus:outline-none focus:ring-1 focus:ring-stage-accent transition-colors"
              />
            </div>

            {/* Email (Optional) */}
            <div className="space-y-1.5">
              <label htmlFor="feedback-email" className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
                Your Email (Optional)
              </label>
              <input
                id="feedback-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com (if you'd like a reply)"
                className="w-full rounded-xl border border-stage-border bg-stage-surface/80 px-3 py-2 text-sm text-stage-text placeholder-stage-muted/60 focus:border-stage-accent focus:outline-none focus:ring-1 focus:ring-stage-accent transition-colors"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || message.trim().length < 5}>
                {submitting ? "Sending..." : "Submit Feedback"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
