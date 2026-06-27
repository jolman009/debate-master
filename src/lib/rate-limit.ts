import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Per-user/IP rate limiting for the expensive AI and TTS routes.
 *
 * Gated by env vars: if UPSTASH_REDIS_REST_URL / _TOKEN are not set, every
 * check passes (no-op) so local dev and unconfigured deploys still work.
 * Set both vars to activate enforcement.
 */

type Bucket = "ai" | "tts";

type Limiters = Record<Bucket, Ratelimit>;

let cached: Limiters | null | undefined;

function getLimiters(): Limiters | null {
  if (cached !== undefined) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    cached = null;
    return null;
  }

  const redis = new Redis({ url, token });
  cached = {
    // AI turns + feedback: a full debate is ~10 turns, so 20/min is
    // generous for real use while blocking runaway abuse.
    ai: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      prefix: "rl:ai",
      analytics: false,
    }),
    // TTS is called per streamed sentence batch, so allow more headroom.
    tts: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 m"),
      prefix: "rl:tts",
      analytics: false,
    }),
  };
  return cached;
}

export interface RateLimitResult {
  success: boolean;
  /** Seconds until the limit resets (0 when not rate limited). */
  retryAfter: number;
}

export async function checkRateLimit(
  bucket: Bucket,
  identifier: string
): Promise<RateLimitResult> {
  const limiters = getLimiters();
  if (!limiters) return { success: true, retryAfter: 0 };

  const { success, reset } = await limiters[bucket].limit(identifier);
  return {
    success,
    retryAfter: success ? 0 : Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
  };
}

/** Best-effort client IP, used as the rate-limit key when no user id exists. */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
