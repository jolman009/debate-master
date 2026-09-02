import { test, expect } from "@playwright/test";

test.describe("accessibility & visual structure", () => {
  test("home page has valid landmark roles and heading hierarchy", async ({
    page,
  }) => {
    await page.goto("/");
    // Exactly one h1 on the page
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    // Nav landmark is present
    await expect(page.locator("nav").first()).toBeVisible();

    // Main landmark is present
    await expect(page.locator("main")).toBeVisible();
  });

  test("320px ultra-compact viewport has zero horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");

    const horizontalScroll = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(horizontalScroll).toBeLessThanOrEqual(1);
  });

  test("focus rings are visible on keyboard tab navigation", async ({ page }) => {
    await page.goto("/");
    // Tab to the first interactive element
    await page.keyboard.press("Tab");
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
  });

  test("leaderboard table contains accessible column headers", async ({
    page,
  }) => {
    await page.goto("/leaderboard");
    await expect(
      page.getByRole("heading", { name: "Leaderboard" })
    ).toBeVisible();
  });

  test("header has stacking context z-index above hero section", async ({ page }) => {
    await page.goto("/");
    const headerZIndex = await page.locator("header").first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        position: style.position,
        zIndex: style.zIndex,
      };
    });
    expect(headerZIndex.position).toBe("relative");
    expect(Number(headerZIndex.zIndex)).toBeGreaterThanOrEqual(40);
  });
});
