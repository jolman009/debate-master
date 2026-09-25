export function learningEnabled(userId: string): boolean {
  const flag = process.env.LEARNING_ROLLOUT ?? "off";
  return flag === "on" || (flag === "pilot" &&
    (process.env.LEARNING_PILOT_USERS ?? "").split(",").map(s => s.trim()).includes(userId));
}

export function approvedTemplateVersions(): string[] {
  return (process.env.LEARNING_APPROVED_TEMPLATES ?? "").split(",").map(s => s.trim()).filter(Boolean);
}
