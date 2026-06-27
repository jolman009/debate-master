// Pure parsing for the AI turn Server-Sent Events stream.
//
// The turn route emits newline-delimited `data: <json>` lines, where each
// JSON payload is one of: { text }, { done, nextStage }, or { error }.
// This helper is extracted from `useStreamingResponse` so the parsing can
// be unit-tested without a browser or a real ReadableStream.

export interface SSEMessage {
  text?: string;
  done?: boolean;
  nextStage?: string;
  error?: string;
}

export interface SSEParseResult {
  /** Parsed payloads from the complete `data:` lines in this buffer. */
  messages: SSEMessage[];
  /** Trailing partial line to carry into the next chunk. */
  rest: string;
}

/**
 * Parse an accumulated SSE buffer. Complete lines (those followed by a
 * newline) are parsed; the final, possibly-incomplete line is returned as
 * `rest` so the caller can prepend it to the next chunk. Lines that are not
 * `data:` payloads, or that are not valid JSON, are skipped.
 */
export function parseSSEBuffer(buffer: string): SSEParseResult {
  const messages: SSEMessage[] = [];
  const parts = buffer.split("\n");
  // The last element may be an incomplete line; keep it for the next chunk.
  const rest = parts.pop() ?? "";

  for (const line of parts) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data: ")) continue;
    const data = trimmed.slice(6).trim();
    if (!data) continue;
    try {
      messages.push(JSON.parse(data) as SSEMessage);
    } catch {
      // A complete line that isn't valid JSON — skip it.
    }
  }

  return { messages, rest };
}
