/** Server-only rollout: off is an immediate generation rollback; pilot uses explicit IDs. */
export function measurementEnabled(userId: string): boolean {
  const rollout = process.env.MEASUREMENT_ROLLOUT ?? "on";
  if (rollout === "off") return false;
  if (rollout === "pilot") return (process.env.MEASUREMENT_PILOT_USERS ?? "").split(",").map(s => s.trim()).includes(userId);
  return rollout === "on";
}
