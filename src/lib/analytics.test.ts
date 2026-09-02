import { describe, it, expect, vi } from "vitest";
import { trackEvent, addAnalyticsListener } from "./analytics";

describe("analytics", () => {
  it("delivers events to registered listeners", () => {
    const listener = vi.fn();
    const unsubscribe = addAnalyticsListener(listener);

    trackEvent("practice_started", {
      focus: "Rebuttal structuring",
      motion: "This House would ban targeted ads",
      difficulty: "intermediate",
    });

    expect(listener).toHaveBeenCalledWith("practice_started", {
      focus: "Rebuttal structuring",
      motion: "This House would ban targeted ads",
      difficulty: "intermediate",
    });

    unsubscribe();

    trackEvent("debate_rematch", {
      motion: "This House would ban targeted ads",
      personaId: "the-academic",
    });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("handles listener errors gracefully", () => {
    const errorListener = () => {
      throw new Error("listener failure");
    };
    const goodListener = vi.fn();

    const unsubError = addAnalyticsListener(errorListener);
    const unsubGood = addAnalyticsListener(goodListener);

    expect(() => {
      trackEvent("setup_step_viewed", { step: "motion", mode: "ai" });
    }).not.toThrow();

    expect(goodListener).toHaveBeenCalledWith("setup_step_viewed", {
      step: "motion",
      mode: "ai",
    });

    unsubError();
    unsubGood();
  });
});
