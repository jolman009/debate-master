import { describe, it, expect, beforeEach, vi } from "vitest";

const { getUserMock, fromMock, signOutMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  fromMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerClient: () => ({
    auth: {
      getUser: getUserMock,
      signOut: signOutMock,
    },
    from: fromMock,
  }),
}));

import { GET, DELETE } from "./route";

function makeDeleteQueryMock() {
  const chain: Record<string, unknown> = {
    delete: () => chain,
    eq: () => Promise.resolve({ error: null }),
  };
  return chain;
}

describe("API /api/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockImplementation(() => makeDeleteQueryMock());
    signOutMock.mockResolvedValue({ error: null });
  });

  describe("GET /api/profile", () => {
    it("returns 401 when user is not authenticated", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const res = await GET();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Not authenticated");
    });
  });

  describe("DELETE /api/profile", () => {
    it("returns 401 when unauthenticated", async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });
      const res = await DELETE();
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe("Not authenticated");
    });

    it("successfully deletes user records and signs out when authenticated", async () => {
      getUserMock.mockResolvedValue({
        data: {
          user: {
            id: "user-123",
            email: "debater@example.com",
            user_metadata: {},
          },
        },
      });

      const res = await DELETE();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.message).toContain("permanently deleted");

      // Verify deletion of tables
      expect(fromMock).toHaveBeenCalledWith("debates");
      expect(fromMock).toHaveBeenCalledWith("custom_personas");
      expect(fromMock).toHaveBeenCalledWith("user_feedback");
      expect(fromMock).toHaveBeenCalledWith("profiles");
      expect(signOutMock).toHaveBeenCalled();
    });
  });
});
