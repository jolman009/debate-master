/**
 * Centralized feature flags for controlling progressive UI rollouts.
 * Supports environment defaults, URL search parameter overrides, and localStorage overrides.
 */

export type FeatureFlagName =
  | "ui_navigation_v2"
  | "ui_setup_v2"
  | "ui_live_v2"
  | "ui_feedback_v2";

export interface FeatureFlagConfig {
  name: FeatureFlagName;
  description: string;
  defaultValue: boolean;
}

export const FEATURE_FLAGS: Record<FeatureFlagName, FeatureFlagConfig> = {
  ui_navigation_v2: {
    name: "ui_navigation_v2",
    description: "Adaptive bottom navigation, desktop profile menu, and accessible tokens.",
    defaultValue: true,
  },
  ui_setup_v2: {
    name: "ui_setup_v2",
    description: "4-step wizard with topic search, collapsible filters, and step telemetry.",
    defaultValue: true,
  },
  ui_live_v2: {
    name: "ui_live_v2",
    description: "Adaptive mobile bottom sheet and desktop supporting side panel for transcripts.",
    defaultValue: true,
  },
  ui_feedback_v2: {
    name: "ui_feedback_v2",
    description: "Targeted practice independent field rationales and conversion telemetry.",
    defaultValue: true,
  },
};

const STORAGE_PREFIX = "debate_flag_";

/**
 * Check if a feature flag is enabled.
 * Resolution priority:
 * 1. URL search params (e.g. ?flag_ui_live_v2=1 or ?flag_ui_live_v2=0)
 * 2. LocalStorage override (`debate_flag_<name>`)
 * 3. Default configured value
 */
export function isFeatureEnabled(
  flagName: FeatureFlagName,
  searchParams?: URLSearchParams | null
): boolean {
  const config = FEATURE_FLAGS[flagName];
  if (!config) return false;

  // 1. Check search params if provided or available on window
  if (typeof window !== "undefined") {
    const params = searchParams ?? new URLSearchParams(window.location.search);
    const paramVal = params.get(`flag_${flagName}`);
    if (paramVal !== null) {
      return paramVal === "1" || paramVal === "true";
    }
  }

  // 2. Check localStorage in browser
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(`${STORAGE_PREFIX}${flagName}`);
      if (stored !== null) {
        return stored === "true" || stored === "1";
      }
    } catch {
      // Ignore localStorage access errors
    }
  }

  // 3. Fallback to default
  return config.defaultValue;
}

/**
 * Set a feature flag override in localStorage.
 */
export function setFeatureFlagOverride(
  flagName: FeatureFlagName,
  enabled: boolean | null
): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled === null) {
      localStorage.removeItem(`${STORAGE_PREFIX}${flagName}`);
    } else {
      localStorage.setItem(`${STORAGE_PREFIX}${flagName}`, String(enabled));
    }
  } catch {
    // Ignore localStorage access errors
  }
}

/**
 * Get all feature flags with their current resolved status.
 */
export function getAllFeatureFlags(): Record<FeatureFlagName, boolean> {
  const result = {} as Record<FeatureFlagName, boolean>;
  for (const key of Object.keys(FEATURE_FLAGS) as FeatureFlagName[]) {
    result[key] = isFeatureEnabled(key);
  }
  return result;
}
