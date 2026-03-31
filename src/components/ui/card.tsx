import { cn } from "@/lib/utils";
import { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export function Card({ className, selected, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-stage-surface border rounded-xl p-6 transition-all duration-200",
        selected
          ? "border-stage-accent shadow-lg shadow-stage-accent/10"
          : "border-stage-border hover:border-stage-accent/50",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
