import { describe, it, expect } from "vitest";
import { resolveTier, isOverFreeLimit, FREE_DEBATE_LIMIT } from "./tier";

const NOW = new Date("2026-06-15T00:00:00Z");
const FUTURE = "2026-07-15T00:00:00Z";
const PAST = "2026-05-15T00:00:00Z";

describe("resolveTier", () => {
  it("is premium for everyone when billing is disabled", () => {
    expect(
      resolveTier({ billingEnabled: false, status: null, periodEnd: null, now: NOW })
    ).toBe("premium");
    // even a 'canceled' status doesn't gate when billing is off
    expect(
      resolveTier({ billingEnabled: false, status: "canceled", periodEnd: PAST, now: NOW })
    ).toBe("premium");
  });

  it("is free with no subscription when billing is enabled", () => {
    expect(
      resolveTier({ billingEnabled: true, status: null, periodEnd: null, now: NOW })
    ).toBe("free");
  });

  it("is premium for active/trialing within the period", () => {
    expect(
      resolveTier({ billingEnabled: true, status: "active", periodEnd: FUTURE, now: NOW })
    ).toBe("premium");
    expect(
      resolveTier({ billingEnabled: true, status: "trialing", periodEnd: FUTURE, now: NOW })
    ).toBe("premium");
  });

  it("is free for non-active statuses", () => {
    for (const status of ["canceled", "past_due", "incomplete", "unpaid"]) {
      expect(
        resolveTier({ billingEnabled: true, status, periodEnd: FUTURE, now: NOW })
      ).toBe("free");
    }
  });

  it("is free when an active subscription has lapsed", () => {
    expect(
      resolveTier({ billingEnabled: true, status: "active", periodEnd: PAST, now: NOW })
    ).toBe("free");
  });

  it("is premium for active with no period end recorded", () => {
    expect(
      resolveTier({ billingEnabled: true, status: "active", periodEnd: null, now: NOW })
    ).toBe("premium");
  });
});

describe("isOverFreeLimit", () => {
  it("never limits premium users", () => {
    expect(isOverFreeLimit(999, "premium")).toBe(false);
  });

  it("limits free users at the cap", () => {
    expect(isOverFreeLimit(FREE_DEBATE_LIMIT - 1, "free")).toBe(false);
    expect(isOverFreeLimit(FREE_DEBATE_LIMIT, "free")).toBe(true);
    expect(isOverFreeLimit(FREE_DEBATE_LIMIT + 5, "free")).toBe(true);
  });
});
