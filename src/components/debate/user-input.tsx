"use client";

import { useState } from "react";
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
    <div className="space-y-2">
      <Textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value.slice(0, maxChars));
          onTyping?.();
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={5}
        className="min-h-[120px]"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-stage-muted">
          {charCount}/{maxChars} chars | Ctrl+Enter to submit
        </span>
        <Button
          onClick={handleSubmit}
          disabled={disabled || !content.trim()}
          size="sm"
        >
          Submit
        </Button>
      </div>
    </div>
  );
}
