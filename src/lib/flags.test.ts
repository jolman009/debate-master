import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  isFeatureEnabled,
  setFeatureFlagOverride,
  getAllFeatureFlags,
  FEATURE_FLAGS,
} from "./flags";

describe("flags", () => {
  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    const mockStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = String(value);
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        store = {};
      },
    };

    // Polyfill window & localStorage for tests
    vi.stubGlobal("window", {
      location: { search: "" },
      localStorage: mockStorage,
    });
    vi.stubGlobal("localStorage", mockStorage);
  });

  it("returns default value when no overrides exist", () => {
    expect(isFeatureEnabled("ui_live_v2")).toBe(true);
    expect(isFeatureEnabled("ui_navigation_v2")).toBe(true);
  });

  it("respects searchParams override", () => {
    const paramsTrue = new URLSearchParams("flag_ui_live_v2=1");
    expect(isFeatureEnabled("ui_live_v2", paramsTrue)).toBe(true);

    const paramsFalse = new URLSearchParams("flag_ui_live_v2=0");
    expect(isFeatureEnabled("ui_live_v2", paramsFalse)).toBe(false);

    const paramsFalseText = new URLSearchParams("flag_ui_live_v2=false");
    expect(isFeatureEnabled("ui_live_v2", paramsFalseText)).toBe(false);
  });

  it("respects localStorage override when no searchParams are present", () => {
    setFeatureFlagOverride("ui_live_v2", false);
    expect(isFeatureEnabled("ui_live_v2", new URLSearchParams())).toBe(false);

    setFeatureFlagOverride("ui_live_v2", true);
    expect(isFeatureEnabled("ui_live_v2", new URLSearchParams())).toBe(true);

    setFeatureFlagOverride("ui_live_v2", null);
    expect(isFeatureEnabled("ui_live_v2", new URLSearchParams())).toBe(
      FEATURE_FLAGS.ui_live_v2.defaultValue
    );
  });

  it("searchParams take precedence over localStorage override", () => {
    setFeatureFlagOverride("ui_live_v2", true);
    const paramsFalse = new URLSearchParams("flag_ui_live_v2=0");
    expect(isFeatureEnabled("ui_live_v2", paramsFalse)).toBe(false);
  });

  it("getAllFeatureFlags returns map of all flags", () => {
    const flags = getAllFeatureFlags();
    expect(flags).toHaveProperty("ui_navigation_v2");
    expect(flags).toHaveProperty("ui_setup_v2");
    expect(flags).toHaveProperty("ui_live_v2");
    expect(flags).toHaveProperty("ui_feedback_v2");
  });
});
