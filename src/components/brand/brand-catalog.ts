/**
 * Debate Master Official Brand Tokens & Assets Catalog
 */

export const BRAND_COLORS = {
  // Primary dark tones
  charcoal: "#1c1a19",
  charcoalDark: "#1a1817",
  charcoalCard: "#181816",

  // Warm Gold / Bronze accents
  gold: "#b88d4c",
  goldLight: "#c59b4c",
  goldDark: "#a9803e",
  goldMuted: "#bf8f50",

  // Editorial Parchment / Cream
  cream: "#eee7dd",
  creamLight: "#f5f4ef",
  creamForeground: "#f3ede3",
} as const;

export const BRAND_ASSETS = {
  // Vector SVGs
  svg: {
    markAdaptive: "/brand/logo-mark.svg",
    markLight: "/brand/logo-mark-light.svg",
    markDark: "/brand/logo-mark-dark.svg",
    horizontalAdaptive: "/brand/logo-horizontal.svg",
    horizontalLight: "/brand/logo-horizontal-light.svg",
    horizontalDark: "/brand/logo-horizontal-dark.svg",
    verticalAdaptive: "/brand/logo-vertical.svg",
    verticalLight: "/brand/logo-vertical-light.svg",
    verticalDark: "/brand/logo-vertical-dark.svg",
    appIconDark: "/brand/app-icon-dark.svg",
    appIconGold: "/brand/app-icon-gold.svg",
    appIconLight: "/brand/app-icon-light.svg",
    favicon: "/favicon.svg",
  },
  // High-Resolution PNGs
  png: {
    markLight: "/brand/logo-mark-light-hires.png",
    markDark: "/brand/logo-mark-dark-hires.png",
    horizontalLight: "/brand/logo-horizontal-light-hires.png",
    horizontalDark: "/brand/logo-horizontal-dark-hires.png",
    verticalLight: "/brand/logo-vertical-light-hires.png",
    verticalDark: "/brand/logo-vertical-dark-hires.png",
    verticalDarkCard: "/brand/logo-vertical-dark-card.png",
    appIconDark1024: "/brand/app-icon-dark-1024.png",
    appIconGold1024: "/brand/app-icon-gold-1024.png",
    appIconLight1024: "/brand/app-icon-light-1024.png",
    wordmarkLight: "/brand/logo-wordmark-light.png",
    wordmarkDark: "/brand/logo-wordmark-dark.png",
  },
  // PWA & Browser Icons
  icons: {
    favicon16: "/favicon-16x16.png",
    favicon32: "/favicon-32x32.png",
    faviconIco: "/favicon.ico",
    appleTouchIcon: "/icons/apple-touch-icon.png",
    icon192: "/icons/icon-192.png",
    icon512: "/icons/icon-512.png",
    icon512Maskable: "/icons/icon-512-maskable.png",
  },
} as const;
