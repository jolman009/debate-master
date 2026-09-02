import React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export interface DebateMasterLogoProps extends React.SVGProps<SVGSVGElement> {
  variant?: "mark" | "horizontal" | "vertical" | "badge";
  badgeVariant?: "dark" | "gold" | "light";
  theme?: "auto" | "light" | "dark" | "gold";
  size?: "xs" | "sm" | "md" | "lg" | "xl" | number;
  className?: string;
  showText?: boolean;
}

const SIZE_MAP = {
  mark: {
    xs: 20,
    sm: 28,
    md: 36,
    lg: 48,
    xl: 64,
  },
  horizontal: {
    xs: 110,
    sm: 140,
    md: 180,
    lg: 240,
    xl: 320,
  },
  vertical: {
    xs: 80,
    sm: 120,
    md: 160,
    lg: 220,
    xl: 300,
  },
  badge: {
    xs: 24,
    sm: 36,
    md: 48,
    lg: 64,
    xl: 96,
  },
};

export function DebateMasterLogo({
  variant = "horizontal",
  badgeVariant = "dark",
  theme = "auto",
  size = "md",
  className,
  ...props
}: DebateMasterLogoProps) {
  const numericSize =
    typeof size === "number" ? size : SIZE_MAP[variant][size] || SIZE_MAP[variant].md;

  if (variant === "badge") {
    const src =
      badgeVariant === "gold"
        ? "/brand/app-icon-gold.svg"
        : badgeVariant === "light"
        ? "/brand/app-icon-light.svg"
        : "/brand/app-icon-dark.svg";

    return (
      <Image
        src={src}
        alt="Debate Master Badge"
        width={numericSize}
        height={numericSize}
        className={cn("rounded-2xl shadow-sm object-contain", className)}
        priority
      />
    );
  }

  if (variant === "mark") {
    const isDark = theme === "dark";
    const isLight = theme === "light";

    if (isDark) {
      return (
        <Image
          src="/brand/debate-master-crest-dark.png"
          alt="Debate Master Emblem"
          width={numericSize}
          height={Math.round((numericSize * 454) / 505)}
          className={cn("h-auto object-contain shrink-0", className)}
          priority
        />
      );
    }

    if (isLight) {
      return (
        <Image
          src="/brand/debate-master-crest.png"
          alt="Debate Master Emblem"
          width={numericSize}
          height={Math.round((numericSize * 454) / 505)}
          className={cn("h-auto object-contain shrink-0", className)}
          priority
        />
      );
    }

    // Auto / adaptive: toggles with CSS dark class
    return (
      <div className={cn("relative inline-flex shrink-0 items-center justify-center", className)}>
        <Image
          src="/brand/debate-master-crest.png"
          alt="Debate Master Emblem"
          width={numericSize}
          height={Math.round((numericSize * 454) / 505)}
          className="h-auto w-auto object-contain dark:hidden"
          priority
        />
        <Image
          src="/brand/debate-master-crest-dark.png"
          alt="Debate Master Emblem"
          width={numericSize}
          height={Math.round((numericSize * 454) / 505)}
          className="hidden h-auto w-auto object-contain dark:block drop-shadow-[0_0_8px_rgba(184,141,76,0.35)]"
          priority
        />
      </div>
    );
  }

  if (variant === "vertical") {
    const src =
      theme === "dark"
        ? "/brand/logo-vertical-dark.svg"
        : theme === "light"
        ? "/brand/logo-vertical-light.svg"
        : "/brand/logo-vertical.svg";

    return (
      <Image
        src={src}
        alt="Debate Master Logo"
        width={numericSize}
        height={Math.round((numericSize * 344) / 534)}
        className={cn("h-auto object-contain", className)}
        priority
      />
    );
  }

  // Default: Horizontal
  const src =
    theme === "dark"
      ? "/brand/logo-horizontal-dark.svg"
      : theme === "light"
      ? "/brand/logo-horizontal-light.svg"
      : "/brand/logo-horizontal.svg";

  return (
    <Image
      src={src}
      alt="Debate Master Logo"
      width={numericSize}
      height={Math.round((numericSize * 90) / 460)}
      className={cn("h-auto object-contain", className)}
      priority
    />
  );
}
