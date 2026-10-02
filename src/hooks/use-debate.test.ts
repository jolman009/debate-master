import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createElement, useEffect } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { useDebate } from "./use-debate";

vi.mock("./use-realtime-debate", () => ({
  useRealtimeDebate: () => ({ connected: false, onlineSides: [], typingSide: null }),
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

let view: ReturnType<typeof useDebate>;
let renderer: ReactTestRenderer;
function Harness() {
  const state = useDebate("fixture");
  view = state;
  const { isAiTurn, isStreaming, streamError, triggerAiTurn } = state;
  useEffect(() => {
    if (isAiTurn && !isStreaming && !streamError) void triggerAiTurn();
  }, [isAiTurn, isStreaming, streamError, triggerAiTurn]);
  return null;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
const debate = (stage: string) => ({ id: "fixture", config: { mode: "ai" }, current_stage: stage, turns: [], feedback: null });
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } });
afterEach(() => { act(() => renderer?.unmount()); vi.unstubAllGlobals(); });

test("AI auto-trigger stays locked through delayed refresh and clears old text before the user stage", async () => {
  const refresh = deferred<Response>();
  let gets = 0;
  let posts = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    if (options?.method === "POST") {
      posts++;
      return new Response('data: {"text":"Saved AI response"}\n\ndata: {"done":true,"nextStage":"closing_user"}\n\n', { headers: { "Content-Type": "text/event-stream" } });
    }
    return ++gets === 1 ? json(debate("cross_exam_ai_response")) : refresh.promise;
  }));
  await act(async () => { renderer = create(createElement(Harness)); });
  expect(gets).toBe(2);
  expect(posts).toBe(1);
  expect(view.isStreaming).toBe(true);
  // A click/effect arriving while synchronization is pending must not start another request.
  await act(async () => { await view.triggerAiTurn(); });
  expect(posts).toBe(1);
  await act(async () => { refresh.resolve(json(debate("closing_user"))); });
  expect(view.isMyTurn).toBe(true);
  expect(view.isStreaming).toBe(false);
  expect(view.streamedText).toBe("");
  expect(posts).toBe(1);
});

test("truncated SSE stops auto-retry and allows one explicit retry", async () => {
  let posts = 0;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    if (options?.method === "POST") {
      posts++;
      return new Response(posts === 1
        ? 'data: {"text":"Partial answer"}\n\n'
        : 'data: {"text":"Complete answer"}\n\ndata: {"done":true,"nextStage":"closing_user"}\n\n',
      { headers: { "Content-Type": "text/event-stream" } });
    }
    return json(debate(posts < 2 ? "cross_exam_ai_response" : "closing_user"));
  }));
  await act(async () => { renderer = create(createElement(Harness)); });
  expect(posts).toBe(1);
  expect(view.streamError).toContain("interrupted");
  expect(view.streamedText).toBe("");
  await act(async () => { await view.triggerAiTurn(); });
  expect(posts).toBe(2);
  expect(view.streamError).toBeNull();
  expect(view.isMyTurn).toBe(true);
});
