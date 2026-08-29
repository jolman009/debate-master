import { test, expect } from "@playwright/test";

// Public, unauthenticated surfaces. These run without real Supabase/Gemini
// credentials — backend calls fail gracefully and the app renders logged-out.

test("home page loads with nav", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Debate Master/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Debate Master" })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Start a debate" }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "An empty debate chamber with two illuminated lecterns",
    })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Leaderboard" })).toBeVisible();

  const nextSectionTop = await page.locator("main section").nth(1).evaluate(
    (element) => element.getBoundingClientRect().top
  );
  expect(nextSectionTop).toBeLessThan(page.viewportSize()!.height);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test.describe("reduced motion", () => {
  test("home content appears without spatial animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const motion = await page.locator(".motion-hero-title").evaluate((element) => {
      const style = getComputedStyle(element);
      const duration = style.animationDuration;
      return {
        durationMs: duration.endsWith("ms")
          ? Number.parseFloat(duration)
          : Number.parseFloat(duration) * 1000,
        opacity: style.opacity,
      };
    });
    expect(motion.durationMs).toBeLessThanOrEqual(0.001);
    expect(motion.opacity).toBe("1");
  });
});

test("protected /debate/new redirects to login", async ({ page }) => {
  await page.goto("/debate/new");
  await expect(page).toHaveURL(/\/login/);
});

test("leaderboard page renders", async ({ page }) => {
  await page.goto("/leaderboard");
  await expect(
    page.getByRole("heading", { name: "Leaderboard" })
  ).toBeVisible();
});

test("persona form renders and live preview reflects the name", async ({
  page,
}) => {
  await page.goto("/personas/new");
  await expect(
    page.getByRole("heading", { name: /create a custom persona/i })
  ).toBeVisible();
  await page.getByPlaceholder("e.g. The Pragmatist").fill("Socrates");
  // The live-preview card echoes the typed name.
  await expect(page.getByText("Socrates")).toBeVisible();
});

test("creating a persona while logged out is rejected", async ({ page }) => {
  await page.goto("/personas/new");
  await page.getByPlaceholder("e.g. The Pragmatist").fill("Socrates");
  await page
    .getByPlaceholder(/Describe how this character argues/)
    .fill(
      "Argues by relentless questioning to expose contradictions in the opponent's reasoning."
    );
  await page.getByRole("button", { name: "Create persona" }).click();
  await expect(page.getByText(/not authenticated/i)).toBeVisible();
});
