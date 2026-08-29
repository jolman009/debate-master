import { GoogleGenAI } from "@google/genai";

/**
 * Single source of truth for the Gemini model used by the debate and
 * feedback routes. Defaults to gemini-3.6-flash with optional env override.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

let client: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (client) return client;

  client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  return client;
}
