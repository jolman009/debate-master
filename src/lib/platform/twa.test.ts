import { describe, it, expect } from "vitest";
import { isTwaReferrer } from "./twa";

describe("isTwaReferrer", () => {
  it("detects an Android app shell referrer", () => {
    expect(isTwaReferrer("android-app://com.debatemaster.twa")).toBe(true);
    expect(isTwaReferrer("ANDROID-APP://com.debatemaster.twa")).toBe(true);
    expect(isTwaReferrer("  android-app://com.debatemaster.twa  ")).toBe(true);
  });

  it("is false for absent referrers", () => {
    expect(isTwaReferrer(null)).toBe(false);
    expect(isTwaReferrer(undefined)).toBe(false);
    expect(isTwaReferrer("")).toBe(false);
  });

  it("is false for ordinary web referrers", () => {
    // An installed PWA / normal browsing must KEEP the upgrade path — only a
    // Play-distributed TWA is subject to Play billing policy.
    expect(isTwaReferrer("https://debate-master-psi.vercel.app/")).toBe(false);
    expect(isTwaReferrer("https://google.com/")).toBe(false);
    expect(isTwaReferrer("http://localhost:3000/")).toBe(false);
  });

  it("does not match a referrer that merely contains the scheme", () => {
    expect(isTwaReferrer("https://evil.com/?next=android-app://x")).toBe(false);
  });
});
