import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "pro" | "con" | "accent";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        variant === "default" && "bg-stage-border text-stage-muted",
        variant === "pro" && "bg-stage-pro/20 text-stage-pro",
        variant === "con" && "bg-stage-con/20 text-stage-con",
        variant === "accent" && "bg-stage-accent/20 text-stage-accent",
        className
      )}
    >
      {children}
    </span>
  );
}
