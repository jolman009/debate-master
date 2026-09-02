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
    const isGold = theme === "gold";

    const podiumColor = isDark
      ? "#f3ede3"
      : isLight
      ? "#1c1a19"
      : isGold
      ? "#1c1a19"
      : "currentColor";

    const nibColor = isGold ? "#1c1a19" : "#b88d4c";

    return (
      <svg
        viewBox="0 0 282 252"
        width={numericSize}
        height={Math.round((numericSize * 252) / 282)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={cn("inline-block shrink-0 transition-colors", className)}
        aria-label="Debate Master Emblem"
        role="img"
        {...props}
      >
        {/* Podiums and Microphones */}
        <path
          d="M 23.00,248.63 C 23.00,248.16 22.07,246.58 20.93,245.13 L 18.85,242.50 L 9.00,242.50 L -0.85,242.50 L -2.93,245.13 C -4.07,246.58 -5.00,248.16 -5.00,248.63 C -5.00,249.11 5.80,249.50 19.00,249.50 C 32.20,249.50 43.00,249.11 43.00,248.63 Z M 75.97,248.25 C 75.95,247.56 75.09,245.99 74.06,244.75 C 72.23,242.55 71.69,242.50 52.28,242.50 L 32.37,242.50 L 29.69,245.30 C 28.21,246.85 27.00,248.42 27.00,248.80 C 27.00,249.19 38.03,249.50 51.50,249.50 C 70.45,249.50 75.99,249.22 75.97,248.25 Z M 16.00,240.83 C 16.00,240.46 15.26,239.33 14.35,238.33 C 12.89,236.72 10.98,236.50 -1.50,236.50 C -13.98,236.50 -15.89,236.72 -17.35,238.33 C -18.26,239.34 -18.70,240.46 -18.34,240.83 C -17.46,241.71 16.00,241.70 16.00,240.83 Z M 70.00,240.56 C 70.00,240.04 69.00,238.91 67.78,238.06 C 64.44,235.72 39.43,235.80 36.83,238.15 C 35.82,239.07 35.00,240.19 35.00,240.65 C 35.00,241.12 42.88,241.50 52.50,241.50 C 62.80,241.50 70.00,241.11 70.00,240.56 Z"
          fill={podiumColor}
        />
        {/* Vector Mark SVG */}
        <image
          href={
            isDark
              ? "/brand/logo-mark-dark.svg"
              : isLight
              ? "/brand/logo-mark-light.svg"
              : "/brand/logo-mark.svg"
          }
          width="282"
          height="252"
        />
      </svg>
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
