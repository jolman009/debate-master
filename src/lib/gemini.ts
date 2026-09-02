import { GoogleGenAI } from "@google/genai";

/**
 * Single source of truth for the Gemini model used by the debate and
 * feedback routes. Defaults to gemini-3.5-flash with optional env override.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

/**
 * Ordered list of active models used for high-availability fallback
 * when a model encounters temporary 503 high-demand spikes or rate limits.
 */
export const GEMINI_FALLBACK_MODELS = [
  GEMINI_MODEL,
  "gemini-3.5-flash",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite-preview",
].filter((v, i, a) => a.indexOf(v) === i);

export function isRetryableGeminiError(err: unknown): boolean {
  if (!err) return false;
  const anyErr = err as Record<string, unknown>;
  const status = Number(
    anyErr.status || anyErr.code || (anyErr.error as Record<string, unknown>)?.code
  );
  if (
    status === 503 ||
    status === 429 ||
    status === 404 ||
    status === 500 ||
    status === 502 ||
    status === 504
  ) {
    return true;
  }
  const msg = String(anyErr.message || anyErr);
  return (
    msg.includes("503") ||
    msg.includes("429") ||
    msg.includes("404") ||
    msg.includes("500") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("quota") ||
    msg.includes("NOT_FOUND") ||
    msg.includes("RESOURCE_EXHAUSTED")
  );
}

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  return client;
}
