import { afterEach, describe, expect, it, vi } from "vitest";
import { measurementEnabled } from "./measurement-flags";
afterEach(() => vi.unstubAllEnvs());
describe("server measurement rollout", () => {
  it("off blocks even pilot users", () => {
    vi.stubEnv("MEASUREMENT_ROLLOUT", "off");
    vi.stubEnv("MEASUREMENT_PILOT_USERS", "pilot-user");
    expect(measurementEnabled("pilot-user")).toBe(false);
  });
  it("pilot only enables explicitly listed users", () => {
    vi.stubEnv("MEASUREMENT_ROLLOUT", "pilot");
    vi.stubEnv("MEASUREMENT_PILOT_USERS", " pilot-user, second-user ");
    expect(measurementEnabled("pilot-user")).toBe(true);
    expect(measurementEnabled("second-user")).toBe(true);
    expect(measurementEnabled("other-user")).toBe(false);
  });
  it("empty pilot enables no authenticated user", () => {
    vi.stubEnv("MEASUREMENT_ROLLOUT", "pilot");
    vi.stubEnv("MEASUREMENT_PILOT_USERS", "");
    expect(measurementEnabled("user")).toBe(false);
  });
  it("on enables users", () => {
    vi.stubEnv("MEASUREMENT_ROLLOUT", "on");
    expect(measurementEnabled("user")).toBe(true);
  });
  it("unrecognized rollout values fail closed", () => {
    vi.stubEnv("MEASUREMENT_ROLLOUT", "typo");
    expect(measurementEnabled("user")).toBe(false);
  });
});
