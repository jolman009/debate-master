"use client";

import { useId, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface UserInputProps {
  onSubmit: (content: string) => void;
  disabled: boolean;
  placeholder: string;
  // Human mode: fired (throttled upstream) on each keystroke to broadcast a
  // "typing" signal to the opponent.
  onTyping?: () => void;
}

export function UserInput({
  onSubmit,
  disabled,
  placeholder,
  onTyping,
}: UserInputProps) {
  const inputId = useId();
  const helpId = useId();
  const [content, setContent] = useState("");

  const charCount = content.length;
  const maxChars = 3000;

  function handleSubmit() {
    if (!content.trim() || disabled) return;
    onSubmit(content.trim());
    setContent("");
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
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
        onChange={(e) => {
          setContent(e.target.value.slice(0, maxChars));
          onTyping?.();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
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
          disabled={disabled || !content.trim()}
          size="sm"
          className="h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm ml-auto"
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
