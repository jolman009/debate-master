import { describe, expect, it } from "vitest";
import { POST } from "./route";
import { NextRequest } from "next/server";

describe("POST /api/feedback", () => {
  it("accepts a complete, valid feedback submission", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        category: "bug",
        message: "The audio speech playback stops halfway through turn 3.",
        email: "debater@example.com",
        rating: 4,
        metadata: { platform: "twa", url: "/debate/test-123" },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.id).toBeDefined();
    expect(json.message).toContain("Thank you for your feedback");
  });

  it("accepts minimal valid feedback without email or rating", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        category: "feature",
        message: "Add support for parliamentary debate format rules.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("rejects invalid categories", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        category: "unsupported_category",
        message: "Valid message content here.",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid category");
  });

  it("rejects messages shorter than 5 characters", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        category: "general",
        message: "bad",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("at least 5 characters");
  });

  it("rejects invalid email addresses", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        category: "general",
        message: "Great AI coaches overall!",
        email: "not-an-email",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Invalid email address");
  });

  it("rejects ratings out of 1-5 range", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: JSON.stringify({
        category: "general",
        message: "Testing rating bounds.",
        rating: 6,
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("between 1 and 5");
  });

  it("rejects malformed non-JSON payloads", async () => {
    const req = new NextRequest("http://localhost:3000/api/feedback", {
      method: "POST",
      body: "not-json",
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
