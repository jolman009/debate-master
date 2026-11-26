import { expect, test } from "@playwright/test";

test("Sentry test page hydrates cleanly before the deliberate test error", async ({ page, baseURL }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  // Keep this regression test local: no real telemetry or server test errors.
  await page.route("**/*", route => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/sentry-example-api") {
      return route.fulfill({ status: 500, body: "Synthetic server error" });
    }
    if (url.origin !== new URL(baseURL!).origin || url.pathname.startsWith("/monitoring")) {
      return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
    return route.continue();
  });

  await page.goto("/sentry-example-page", { waitUntil: "networkidle" });
  await expect(page).toHaveTitle("Sentry monitoring test — Debate Master");
  const button = page.getByRole("button", { name: "Throw Sample Error" });
  await expect(button).toBeEnabled();
  // The click and state change below also prove that hydration attached handlers.
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter(message => /hydrat|server.rendered|Minified React error/i.test(message))).toEqual([]);

  await button.click();
  await expect(page.getByText("Test errors triggered. Confirm delivery in Sentry.")).toBeVisible();
  await expect.poll(() => pageErrors).toEqual([
    "This error is raised on the frontend of the example page.",
  ]);
  expect(consoleErrors.filter(message => /hydrat|server.rendered|Minified React error/i.test(message))).toEqual([]);
});
