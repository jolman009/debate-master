"use client";

import { useEffect, useId, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface UserInputProps {
  onSubmit: (content: string) => Promise<void> | void;
  disabled: boolean;
  placeholder: string;
  debateId?: string;
  stage?: string;
  // Human mode: fired (throttled upstream) on each keystroke to broadcast a
  // "typing" signal to the opponent.
  onTyping?: () => void;
}

export function UserInput({
  onSubmit,
  disabled,
  placeholder,
  debateId,
  stage,
  onTyping,
}: UserInputProps) {
  const inputId = useId();
  const helpId = useId();
  const storageKey = debateId ? `debate_draft_${debateId}_${stage || "general"}` : null;
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Restore draft from sessionStorage on mount or stage change
  useEffect(() => {
    if (!storageKey || typeof window === "undefined") return;
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        setContent(saved);
      }
    } catch {}
  }, [storageKey]);

  const charCount = content.length;
  const maxChars = 3000;

  async function handleSubmit() {
    const trimmed = content.trim();
    if (!trimmed || disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
      setContent("");
      if (storageKey) {
        sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Retain content if submission encounters an error so user never loses their draft
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleChange(value: string) {
    const next = value.slice(0, maxChars);
    setContent(next);
    if (storageKey) {
      try {
        if (next) {
          sessionStorage.setItem(storageKey, next);
        } else {
          sessionStorage.removeItem(storageKey);
        }
      } catch {}
    }
    onTyping?.();
  }

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <div className="flex items-center justify-between">
        <label htmlFor={inputId} className="block text-xs sm:text-sm font-medium text-stage-text">
          Your argument
        </label>
        <span id={helpId} className="text-[11px] sm:text-xs text-stage-muted">
          {charCount}/{maxChars} chars
        </span>
      </div>
      <Textarea
        id={inputId}
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isSubmitting}
        aria-describedby={helpId}
        rows={2}
        className="min-h-[52px] sm:min-h-[96px] max-h-[160px] text-xs sm:text-sm resize-y"
      />
      <div className="flex items-center justify-between">
        <span className="hidden sm:inline text-xs text-stage-muted">
          Ctrl+Enter or ⌘+Enter to submit
        </span>
        <div className="sm:hidden" />
        <Button
          onClick={handleSubmit}
          disabled={disabled || isSubmitting || !content.trim()}
          size="sm"
          className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm ml-auto"
        >
          {isSubmitting ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
}

