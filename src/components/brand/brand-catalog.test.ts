import { describe, it, expect } from "vitest";
import { BRAND_COLORS, BRAND_ASSETS } from "./brand-catalog";

describe("Brand Tokens and Assets", () => {
  it("defines primary charcoal, gold, and cream color palette", () => {
    expect(BRAND_COLORS.charcoal).toBe("#1c1a19");
    expect(BRAND_COLORS.gold).toBe("#b88d4c");
    expect(BRAND_COLORS.cream).toBe("#eee7dd");
  });

  it("contains vector SVG asset paths", () => {
    expect(BRAND_ASSETS.svg.markAdaptive).toBe("/brand/logo-mark.svg");
    expect(BRAND_ASSETS.svg.markLight).toBe("/brand/logo-mark-light.svg");
    expect(BRAND_ASSETS.svg.markDark).toBe("/brand/logo-mark-dark.svg");
    expect(BRAND_ASSETS.svg.horizontalLight).toBe("/brand/logo-horizontal-light.svg");
    expect(BRAND_ASSETS.svg.horizontalDark).toBe("/brand/logo-horizontal-dark.svg");
    expect(BRAND_ASSETS.svg.verticalLight).toBe("/brand/logo-vertical-light.svg");
    expect(BRAND_ASSETS.svg.verticalDark).toBe("/brand/logo-vertical-dark.svg");
    expect(BRAND_ASSETS.svg.appIconDark).toBe("/brand/app-icon-dark.svg");
    expect(BRAND_ASSETS.svg.favicon).toBe("/favicon.svg");
  });

  it("contains high-res raster PNG and icon paths", () => {
    expect(BRAND_ASSETS.png.markLight).toBe("/brand/logo-mark-light-hires.png");
    expect(BRAND_ASSETS.png.appIconDark1024).toBe("/brand/app-icon-dark-1024.png");
    expect(BRAND_ASSETS.icons.icon512).toBe("/icons/icon-512.png");
    expect(BRAND_ASSETS.icons.appleTouchIcon).toBe("/icons/apple-touch-icon.png");
    expect(BRAND_ASSETS.icons.faviconLight).toBe("/favicon-light.png");
    expect(BRAND_ASSETS.icons.faviconDark).toBe("/favicon-dark.png");
  });
});
