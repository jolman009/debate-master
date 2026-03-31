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
          "font-semibold rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center",
          variant === "primary" &&
            "bg-stage-accent hover:bg-stage-accent-hover text-white",
          variant === "secondary" &&
            "bg-stage-surface border border-stage-border hover:border-stage-accent text-white",
          variant === "ghost" &&
            "bg-transparent hover:bg-stage-surface text-stage-muted hover:text-white",
          size === "sm" && "text-sm py-1.5 px-3",
          size === "md" && "py-2.5 px-5",
          size === "lg" && "text-lg py-3 px-8",
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";
