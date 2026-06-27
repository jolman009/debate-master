import { test, expect } from "@playwright/test";

test("serves a valid web manifest", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.ok()).toBeTruthy();
  const manifest = await res.json();
  expect(manifest.name).toBe("Debate Master");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
});

test("registers a controlling service worker that precaches the offline page", async ({
  page,
}) => {
  await page.goto("/");

  // The SW registers on load (production build). Wait until it controls this
  // page (clients.claim) — this is the exact behavior that regressed when the
  // registration only listened for an already-fired 'load' event.
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, {
    timeout: 20_000,
  });

  // The offline fallback the SW will serve must be precached with the right
  // content. (Live offline navigation is verified manually; headless
  // setOffline doesn't exercise the SW navigation fallback reliably.)
  const offlineText = await page.evaluate(async () => {
    const cache = await caches.open("dm-cache-v1");
    const res = await cache.match("/offline");
    return res ? await res.text() : null;
  });
  expect(offlineText).not.toBeNull();
  expect(offlineText!).toContain("needs a connection to run live debates");
});
