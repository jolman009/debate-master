import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { GET } from "./route";

describe("GET /api/assetlinks", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 404 when env vars are missing", async () => {
    delete process.env.ANDROID_PACKAGE_NAME;
    delete process.env.ANDROID_CERT_FINGERPRINTS;

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns properly formatted assetlinks JSON when clean env vars are provided", async () => {
    process.env.ANDROID_PACKAGE_NAME = "app.debatemaster.twa";
    process.env.ANDROID_CERT_FINGERPRINTS = "14:6D:E9:7D,2A:1B:3C:9F";

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data).toHaveLength(1);
    expect(data[0].target.package_name).toBe("app.debatemaster.twa");
    expect(data[0].target.sha256_cert_fingerprints).toEqual([
      "14:6D:E9:7D",
      "2A:1B:3C:9F",
    ]);
  });

  it("sanitizes accidental brackets, quotes, and whitespace from Vercel env vars", async () => {
    process.env.ANDROID_PACKAGE_NAME = ' ["app.debatemaster.twa"] ';
    process.env.ANDROID_CERT_FINGERPRINTS = '["14:6D:E9:7D", "2A:1B:3C:9F"]';

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data[0].target.package_name).toBe("app.debatemaster.twa");
    expect(data[0].target.sha256_cert_fingerprints).toEqual([
      "14:6D:E9:7D",
      "2A:1B:3C:9F",
    ]);
  });
});
