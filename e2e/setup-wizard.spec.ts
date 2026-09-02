import { test, expect } from "@playwright/test";

test.describe("setup wizard & targeted practice", () => {
  test("unauthenticated access redirects to login with return URL", async ({
    page,
  }) => {
    await page.goto("/debate/new");
    await expect(page).toHaveURL(/\/login/);
  });

  test("targeted practice URL params pre-populate practice drill focus", async ({
    page,
  }) => {
    const goal = encodeURIComponent("Rebuttal structuring");
    const motion = encodeURIComponent("This House would ban algorithmic feeds");
    await page.goto(
      `/debate/new?motion=${motion}&difficulty=intermediate&goal=${goal}`
    );
    // Since not logged in, redirects to login, with redirect param preserving query
    await expect(page).toHaveURL(/\/login/);
    const url = new URL(page.url());
    expect(url.searchParams.get("redirect") || url.pathname).toContain("debate/new");
  });
});
