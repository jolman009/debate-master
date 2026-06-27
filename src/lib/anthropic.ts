import Anthropic from "@anthropic-ai/sdk";

/**
 * Single source of truth for the Claude model used by the debate and
 * feedback routes. Bump this one constant when upgrading models.
 */
export const CLAUDE_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;

  client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  return client;
}
