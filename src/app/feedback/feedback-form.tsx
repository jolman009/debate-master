"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isTwaClient } from "@/lib/platform/twa";

export type FeedbackCategory = "bug" | "feature" | "debate_quality" | "general";

const CATEGORIES: { id: FeedbackCategory; label: string; icon: string; desc: string }[] = [
  { id: "bug", label: "Bug Report", icon: "🐞", desc: "Something isn't working as expected" },
  { id: "feature", label: "Feature Idea", icon: "💡", desc: "Suggest a feature or debate topic" },
  { id: "debate_quality", label: "Debate & AI", icon: "⚖️", desc: "Opponent argumentation or judge scores" },
  { id: "general", label: "General Feedback", icon: "💬", desc: "Thoughts, suggestions, or comments" },
];

const RATING_LABELS = ["", "Poor", "Fair", "Good", "Great", "Exceptional"];

export function FeedbackForm() {
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

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

  if (submitted) {
    return (
      <div className="py-8 text-center space-y-5 animate-in zoom-in-95 duration-200">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 text-3xl text-emerald-400">
          ✓
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold text-stage-text font-editorial">Feedback Received!</h2>
          <p className="text-sm text-stage-muted max-w-sm mx-auto">
            Thank you for taking the time to share your perspective. Your input directly shapes our future updates.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
          <Link
            href="/debate/new"
            className="inline-flex min-h-11 items-center justify-center rounded-lg font-semibold bg-stage-accent text-stage-on-accent hover:bg-stage-accent-hover px-5 py-2.5 text-sm transition-colors"
          >
            Start a Debate
          </Link>
          <Button variant="secondary" onClick={() => setSubmitted(false)}>
            Send Another Note
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3.5 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Category Selection */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
          What kind of feedback do you have?
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {CATEGORIES.map((cat) => {
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                  active
                    ? "border-stage-accent bg-stage-accent/10 text-stage-text shadow-sm"
                    : "border-stage-border bg-stage-surface/60 text-stage-muted hover:border-stage-border-hover hover:text-stage-text"
                }`}
              >
                <span className="text-sm mb-0.5 flex items-center gap-2">
                  <span>{cat.icon}</span>
                  <strong className="font-medium text-stage-text">{cat.label}</strong>
                </span>
                <span className="text-xs text-stage-muted">
                  {cat.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-2">
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
        <div className="flex items-center gap-2.5">
          {[1, 2, 3, 4, 5].map((star) => {
            const filled = rating !== null && star <= rating;
            return (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star === rating ? null : star)}
                className={`h-10 w-10 rounded-xl border text-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 ${
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

      {/* Message Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <label htmlFor="message" className="font-semibold uppercase tracking-wider text-stage-muted">
            Your Feedback
          </label>
          <span className={message.length > 2800 ? "text-amber-400" : "text-stage-muted/70"}>
            {message.length} / 3,000
          </span>
        </div>
        <textarea
          id="message"
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={3000}
          placeholder={
            category === "bug"
              ? "Please describe the problem you ran into and steps to reproduce..."
              : category === "feature"
              ? "What feature or debate mode would you love to see added?"
              : category === "debate_quality"
              ? "Tell us which persona or judge scores felt off, and why..."
              : "Share any thoughts or suggestions for the platform..."
          }
          className="w-full resize-none rounded-xl border border-stage-border bg-stage-surface/80 p-3.5 text-sm text-stage-text placeholder-stage-muted/60 focus:border-stage-accent focus:outline-none focus:ring-1 focus:ring-stage-accent transition-colors"
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-stage-muted">
          Your Email (Optional)
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@example.com (if you would like us to follow up)"
          className="w-full rounded-xl border border-stage-border bg-stage-surface/80 px-3.5 py-2.5 text-sm text-stage-text placeholder-stage-muted/60 focus:border-stage-accent focus:outline-none focus:ring-1 focus:ring-stage-accent transition-colors"
        />
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          disabled={submitting || message.trim().length < 5}
          className="w-full py-2.5 text-sm font-semibold"
        >
          {submitting ? "Sending Feedback..." : "Submit Feedback"}
        </Button>
      </div>
    </form>
  );
}
