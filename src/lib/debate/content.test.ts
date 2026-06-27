import { describe, it, expect, beforeEach, vi } from "vitest";

// Hoisted so the vi.mock factory can reference it.
const { fromMock } = vi.hoisted(() => ({ fromMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({ from: fromMock }),
}));

import { getTopics, getTopicPacks, getPersonas } from "./content";
import { CURATED_TOPICS } from "./topics";
import { getAllPersonas } from "./personas";

// A Supabase query-builder stub whose terminal calls resolve to `result`.
function chainResolving(result: unknown) {
  const chain: Record<string, unknown> = {
    select: () => chain,
    order: () => Promise.resolve(result),
    not: () => Promise.resolve(result),
  };
  return chain;
}

beforeEach(() => {
  fromMock.mockReset();
});

describe("getTopics", () => {
  it("maps DB rows to Topic objects (slug -> id)", async () => {
    fromMock.mockReturnValue(
      chainResolving({
        data: [
          {
            slug: "x",
            title: "X",
            motion: "m",
            category: "economics",
            difficulty: "beginner",
          },
        ],
        error: null,
      })
    );
    expect(await getTopics()).toEqual([
      { id: "x", title: "X", motion: "m", category: "economics", difficulty: "beginner" },
    ]);
  });

  it("falls back to in-code topics on error", async () => {
    fromMock.mockReturnValue(
      chainResolving({ data: null, error: { message: "relation does not exist" } })
    );
    expect(await getTopics()).toEqual(CURATED_TOPICS);
  });

  it("falls back to in-code topics when the table is empty", async () => {
    fromMock.mockReturnValue(chainResolving({ data: [], error: null }));
    expect(await getTopics()).toEqual(CURATED_TOPICS);
  });
});

describe("getTopicPacks", () => {
  it("maps DB rows to TopicPack objects", async () => {
    fromMock.mockReturnValue(
      chainResolving({
        data: [{ id: "p1", name: "Core", description: "d" }],
        error: null,
      })
    );
    expect(await getTopicPacks()).toEqual([
      { id: "p1", name: "Core", description: "d" },
    ]);
  });

  it("returns an empty list on error", async () => {
    fromMock.mockReturnValue(
      chainResolving({ data: null, error: { message: "no table" } })
    );
    expect(await getTopicPacks()).toEqual([]);
  });
});

describe("getPersonas", () => {
  const builtInCount = getAllPersonas().length;

  it("appends DB custom personas to the in-code built-ins", async () => {
    fromMock.mockReturnValue(
      chainResolving({
        data: [
          {
            slug: "custom-1",
            display_name: "Custom One",
            tagline: null,
            ideology: null,
            system_prompt: "sp",
            avatar_url: null,
            avatar_url_speaking: null,
            avatar_url_thinking: null,
            voice_config: null,
            theme: null,
          },
        ],
        error: null,
      })
    );
    const personas = await getPersonas();
    expect(personas).toHaveLength(builtInCount + 1);
    expect(personas.some((p) => (p.id as string) === "custom-1")).toBe(true);
  });

  it("does not let a custom row shadow a built-in slug", async () => {
    fromMock.mockReturnValue(
      chainResolving({
        data: [
          {
            slug: "destiny",
            display_name: "IMPOSTER",
            tagline: null,
            ideology: null,
            system_prompt: "sp",
            avatar_url: null,
            avatar_url_speaking: null,
            avatar_url_thinking: null,
            voice_config: null,
            theme: null,
          },
        ],
        error: null,
      })
    );
    const personas = await getPersonas();
    expect(personas).toHaveLength(builtInCount);
    expect(personas.find((p) => p.id === "destiny")?.displayName).toBe("Destiny");
  });

  it("falls back to built-ins only on error", async () => {
    fromMock.mockReturnValue(
      chainResolving({ data: null, error: { message: "no table" } })
    );
    expect(await getPersonas()).toHaveLength(builtInCount);
  });
});
