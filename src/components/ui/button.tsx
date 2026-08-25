import { cn } from "@/lib/utils";
import { ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg font-semibold transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
          variant === "primary" &&
            "bg-stage-accent text-stage-on-accent hover:bg-stage-accent-hover",
          variant === "secondary" &&
            "bg-stage-surface border border-stage-border hover:border-stage-accent text-stage-text",
          variant === "ghost" &&
            "bg-transparent hover:bg-stage-surface text-stage-muted hover:text-stage-text",
          size === "sm" && "px-3 py-2 text-sm",
          size === "md" && "px-5 py-2.5",
          size === "lg" && "px-8 py-3 text-lg",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
