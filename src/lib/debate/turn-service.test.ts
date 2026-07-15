import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { submitHumanTurn } from "./turn-service";
import { DebateConfig, DebateStage } from "./types";

function humanConfig(overrides: Partial<DebateConfig> = {}): DebateConfig {
  return {
    topic: "Topic",
    motion: "This house believes X",
    userSide: "pro",
    personaId: "",
    difficulty: "intermediate",
    rebuttalCycles: 1,
    crossExamEnabled: false,
    mode: "human",
    ...overrides,
  };
}

// Minimal fake of the exact Supabase call chains submitHumanTurn uses.
function fakeSupabase(opts: {
  participantSide?: "pro" | "con" | null;
  advanceRows?: { id: string }[];
  advanceError?: unknown;
  insertError?: unknown;
}) {
  const inserted: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      if (table === "debate_participants") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          maybeSingle: () =>
            Promise.resolve({
              data:
                opts.participantSide != null
                  ? { side: opts.participantSide }
                  : null,
              error: null,
            }),
        };
        return chain;
      }
      if (table === "debates") {
        const chain = {
          update: () => chain,
          eq: () => chain,
          select: () =>
            Promise.resolve({
              data: opts.advanceRows ?? [{ id: "d1" }],
              error: opts.advanceError ?? null,
            }),
        };
        return chain;
      }
      if (table === "debate_turns") {
        return {
          insert: (row: Record<string, unknown>) => {
            inserted.push(row);
            return Promise.resolve({ error: opts.insertError ?? null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return { client: client as unknown as SupabaseClient, inserted };
}

const debate = (current_stage: DebateStage, config = humanConfig()) => ({
  id: "d1",
  config,
  current_stage,
});

describe("submitHumanTurn turn authority", () => {
  it("rejects a player submitting on the wrong side with 403", async () => {
    const { client } = fakeSupabase({ participantSide: "con" });
    const res = await submitHumanTurn(client, {
      debate: debate("opening_pro"), // pro's turn
      userId: "u1",
      content: "My argument",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("rejects a non-participant with 403", async () => {
    const { client } = fakeSupabase({ participantSide: null });
    const res = await submitHumanTurn(client, {
      debate: debate("opening_pro"),
      userId: "stranger",
      content: "Sneaky",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(403);
  });

  it("rejects submission at a system stage (no active side) with 400", async () => {
    const { client } = fakeSupabase({ participantSide: "pro" });
    const res = await submitHumanTurn(client, {
      debate: debate("judge"),
      userId: "u1",
      content: "Too late",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });

  it("accepts the correct side and reports the next stage", async () => {
    const { client, inserted } = fakeSupabase({
      participantSide: "pro",
      advanceRows: [{ id: "d1" }],
    });
    const res = await submitHumanTurn(client, {
      debate: debate("opening_pro"),
      userId: "u1",
      content: "My opening",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.nextStage).toBe("opening_con");
    // Turn is written with role = side and the author id.
    expect(inserted[0]).toMatchObject({
      role: "pro",
      author_id: "u1",
      stage: "opening_pro",
    });
  });

  it("returns 409 conflict when the optimistic advance loses the race", async () => {
    const { client, inserted } = fakeSupabase({
      participantSide: "pro",
      advanceRows: [], // compare-and-set matched zero rows
    });
    const res = await submitHumanTurn(client, {
      debate: debate("opening_pro"),
      userId: "u1",
      content: "My opening",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.status).toBe(409);
      expect(res.conflict).toBe(true);
    }
    // Never writes a turn when it lost the advance.
    expect(inserted).toHaveLength(0);
  });

  it("rejects empty content with 400 (after passing authority)", async () => {
    const { client } = fakeSupabase({ participantSide: "pro" });
    const res = await submitHumanTurn(client, {
      debate: debate("opening_pro"),
      userId: "u1",
      content: "   ",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(400);
  });
});
