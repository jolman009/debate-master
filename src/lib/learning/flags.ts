export type LearningGate = "enabled" | "rollout_off" | "rollout_unrecognised" | "not_in_pilot";

/**
 * Why learning is or isn't on for this user. Exact matching on purpose: a
 * value with stray spaces or quotes is reported, not silently accepted.
 * Safe to show to that user; it reveals nothing about other users.
 */
export function learningGate(userId: string): LearningGate {
  const flag = process.env.LEARNING_ROLLOUT ?? "off";
  if (flag === "on") return "enabled";
  if (flag === "off" || flag === "") return "rollout_off";
  if (flag !== "pilot") return "rollout_unrecognised";
  return (process.env.LEARNING_PILOT_USERS ?? "").split(",").map(s => s.trim()).includes(userId) ? "enabled" : "not_in_pilot";
}

export function learningEnabled(userId: string): boolean {
  return learningGate(userId) === "enabled";
}

export function approvedTemplateVersions(): string[] {
  return (process.env.LEARNING_APPROVED_TEMPLATES ?? "").split(",").map(s => s.trim()).filter(Boolean);
}
