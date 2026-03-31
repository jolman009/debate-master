import { cn } from "@/lib/utils";
import { TextareaHTMLAttributes, forwardRef } from "react";

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "w-full bg-stage-bg border border-stage-border rounded-lg px-4 py-3 text-white placeholder:text-stage-muted/50 focus:outline-none focus:border-stage-accent resize-none transition-colors",
        className
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
