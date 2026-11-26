import { beforeEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
const m = vi.hoisted(() => ({ report: vi.fn() }));
vi.mock("@/lib/observability", () => ({ reportError: m.report }));
import { recommendation } from "./service";
beforeEach(() => vi.clearAllMocks());
it("deduplicates an unavailable owned source without storing learner content", async () => {
  const write = vi.fn().mockResolvedValue({ error: null });
  const db = { from: (table: string) => {
    const q = { select: () => q, eq: () => q, order: async () => ({ data: [], error: null }),
      maybeSingle: async () => ({ data: { id: "debate", assessment_status: "invalid", feedback: { summary: "private learner text" } }, error: null }),
      upsert: write };
    return q;
  } } as unknown as SupabaseClient;
  expect(await recommendation(db, "owner", "debate")).toEqual({ existingCycleId: null, recommendation: null });
  expect(write).toHaveBeenCalledWith({ user_id: "owner", debate_id: "debate", reason: "ineligible_source" }, { onConflict: "user_id,debate_id,reason", ignoreDuplicates: true });
  expect(JSON.stringify(write.mock.calls)).not.toContain("private learner text");
});
it("does not manufacture an unavailable event for an inaccessible debate", async () => {
  const write = vi.fn();
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: null, error: null }), upsert: write };
  await expect(recommendation({ from: () => q } as unknown as SupabaseClient, "owner", "foreign")).rejects.toMatchObject({ status: 404 });
  expect(write).not.toHaveBeenCalled();
});
