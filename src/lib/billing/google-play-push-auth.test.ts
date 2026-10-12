import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authenticateGooglePlayPush } from "./google-play-push-auth";

const verifyIdToken = vi.hoisted(() => vi.fn());
vi.mock("google-auth-library", () => ({
  OAuth2Client: class { verifyIdToken = verifyIdToken; },
}));

const audience = "https://staging.example.com/api/webhooks/google-play";
const email = "push@example.iam.gserviceaccount.com";
const request = (authorization?: string) => new Request(audience, {
  headers: authorization ? { authorization } : {},
});

describe("Google Play push authentication", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_PLAY_PUBSUB_AUDIENCE", audience);
    vi.stubEnv("GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT", email);
    verifyIdToken.mockReset().mockResolvedValue({ getPayload: () => ({ email, email_verified: true }) });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed without server authentication configuration", async () => {
    vi.stubEnv("GOOGLE_PLAY_PUBSUB_AUDIENCE", "");
    expect((await authenticateGooglePlayPush(request("Bearer test-token")))?.status).toBe(503);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
  it.each([undefined, "Basic test-token", "Bearer one two"])("rejects invalid authorization: %s", async (header) => {
    expect((await authenticateGooglePlayPush(request(header)))?.status).toBe(401);
    expect(verifyIdToken).not.toHaveBeenCalled();
  });
  it("verifies against the configured audience and accepts the expected identity", async () => {
    expect(await authenticateGooglePlayPush(request("Bearer test-token"))).toBeNull();
    expect(verifyIdToken).toHaveBeenCalledWith({ idToken: "test-token", audience });
  });
  it.each([
    undefined,
    { email: "other@example.iam.gserviceaccount.com", email_verified: true },
    { email, email_verified: false },
  ])("rejects a missing or unexpected verified identity: %j", async (claims) => {
    verifyIdToken.mockResolvedValue({ getPayload: () => claims });
    expect((await authenticateGooglePlayPush(request("Bearer test-token")))?.status).toBe(401);
  });
  it("rejects invalid, expired, or wrong-audience tokens without exposing details", async () => {
    verifyIdToken.mockRejectedValue(new Error("sensitive provider details"));
    const response = await authenticateGooglePlayPush(request("Bearer test-token"));
    expect(response?.status).toBe(401);
    expect(await response?.text()).toBe("Unauthorized");
  });
});
