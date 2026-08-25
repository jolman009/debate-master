import { describe, expect, it } from "vitest";
import {
  getBottomNavItems,
  getDesktopNavItems,
  getProfileMenuNavItems,
  navItemActive,
} from "./navigation";

describe("navigation model", () => {
  it("keeps compact signed-in navigation to the expected primary destinations", () => {
    expect(getBottomNavItems(true, false).map((item) => item.href)).toEqual([
      "/debate",
      "/debate/new",
      "/personas",
      "/leaderboard",
    ]);
    expect(getBottomNavItems(false, false)).toEqual([]);
  });

  it("omits pricing in TWA while keeping it reachable on the web", () => {
    expect(getDesktopNavItems(true, true).some((item) => item.href === "/pricing")).toBe(false);
    expect(getDesktopNavItems(false, false).some((item) => item.href === "/pricing")).toBe(true);
    expect(getProfileMenuNavItems(true, true).some((item) => item.href === "/pricing")).toBe(false);
    expect(getProfileMenuNavItems(true, false).some((item) => item.href === "/pricing")).toBe(true);
  });

  it("keeps the signed-in profile menu backed by the shared navigation model", () => {
    expect(getProfileMenuNavItems(true, false).map((item) => item.href)).toEqual([
      "/debate",
      "/debate/new",
      "/personas",
      "/leaderboard",
      "/pricing",
    ]);
    expect(getProfileMenuNavItems(false, false)).toEqual([]);
  });

  it("uses exact matching for Practice and prefix matching for libraries", () => {
    const [practice] = getDesktopNavItems(true, false);
    const library = getDesktopNavItems(true, false).find(
      (item) => item.href === "/personas"
    )!;

    expect(navItemActive("/debate", practice)).toBe(true);
    expect(navItemActive("/debate/abc", practice)).toBe(false);
    expect(navItemActive("/personas/new", library)).toBe(true);
  });
});
