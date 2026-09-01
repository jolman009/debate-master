import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

describe("POST /api/feedback/usefulness", () => {
  it("accepts valid helpfulness ratings", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback/usefulness", {
      method: "POST",
      body: JSON.stringify({
        usefulness: "helpful",
        feedbackVersion: 2,
        overallScore: 8,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("accepts report rating", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback/usefulness", {
      method: "POST",
      body: JSON.stringify({
        usefulness: "reported",
        feedbackVersion: 2,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("rejects invalid rating values", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback/usefulness", {
      method: "POST",
      body: JSON.stringify({
        usefulness: "invalid_signal",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid usefulness rating");
  });
});
