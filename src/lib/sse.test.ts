import { describe, it, expect } from "vitest";
import { parseSSEBuffer } from "./sse";

describe("parseSSEBuffer", () => {
  it("parses a single complete data line", () => {
    const { messages, rest } = parseSSEBuffer('data: {"text":"hi"}\n');
    expect(messages).toEqual([{ text: "hi" }]);
    expect(rest).toBe("");
  });

  it("keeps a trailing partial line in rest", () => {
    const { messages, rest } = parseSSEBuffer('data: {"text":"a"}\ndata: {"te');
    expect(messages).toEqual([{ text: "a" }]);
    expect(rest).toBe('data: {"te');
  });

  it("treats a buffer with no newline as entirely partial", () => {
    const { messages, rest } = parseSSEBuffer('data: {"text":"x"}');
    expect(messages).toEqual([]);
    expect(rest).toBe('data: {"text":"x"}');
  });

  it("reassembles a payload split across two chunks", () => {
    const first = parseSSEBuffer('data: {"text":"hel');
    expect(first.messages).toEqual([]);
    const second = parseSSEBuffer(first.rest + 'lo"}\n');
    expect(second.messages).toEqual([{ text: "hello" }]);
    expect(second.rest).toBe("");
  });

  it("parses done and error payloads", () => {
    const { messages } = parseSSEBuffer(
      'data: {"done":true,"nextStage":"closing_ai"}\ndata: {"error":"boom"}\n'
    );
    expect(messages).toEqual([
      { done: true, nextStage: "closing_ai" },
      { error: "boom" },
    ]);
  });

  it("ignores non-data lines and blank data", () => {
    const { messages } = parseSSEBuffer(
      ': comment\n\nevent: ping\ndata: \ndata: {"text":"ok"}\n'
    );
    expect(messages).toEqual([{ text: "ok" }]);
  });

  it("skips a complete line with malformed JSON", () => {
    const { messages, rest } = parseSSEBuffer(
      'data: {not json}\ndata: {"text":"good"}\n'
    );
    expect(messages).toEqual([{ text: "good" }]);
    expect(rest).toBe("");
  });

  it("returns nothing for an empty buffer", () => {
    expect(parseSSEBuffer("")).toEqual({ messages: [], rest: "" });
  });
});
