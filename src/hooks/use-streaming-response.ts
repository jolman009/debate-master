"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { parseSSEBuffer } from "@/lib/sse";

interface StreamResult {
  done: boolean;
  nextStage?: string;
}

export function useStreamingResponse() {
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(
    async (
      debateId: string,
      content?: string
    ): Promise<StreamResult | null> => {
      setIsStreaming(true);
      setStreamedText("");
      setStreamError(null);

      abortRef.current = new AbortController();

      try {
        const res = await fetch(`/api/debate/${debateId}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          let message = `Request failed (${res.status})`;
          try {
            const errBody = await res.json();
            if (errBody?.error) message = errBody.error;
          } catch {
            // Non-JSON error body - keep the generic message.
          }
          throw new Error(message);
        }

        // Check if this is a JSON response (no AI turn needed)
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          setIsStreaming(false);
          return { done: true, nextStage: json.nextStage };
        }

        // SSE stream
        if (!res.body) {
          throw new Error("Empty streaming response");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let result: StreamResult | null = null;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse complete `data:` lines; the trailing partial line (if any)
          // is carried over into the next chunk via `rest`.
          const { messages, rest } = parseSSEBuffer(buffer);
          buffer = rest;

          for (const parsed of messages) {
            if (parsed.error) {
              setStreamError(parsed.error);
              continue;
            }

            if (parsed.done) {
              result = { done: true, nextStage: parsed.nextStage };
              continue;
            }

            if (parsed.text) {
              accumulated += parsed.text;
              setStreamedText(accumulated);
            }
          }
        }

        setIsStreaming(false);
        return result;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Cancelled - not an error.
        } else {
          setStreamError(
            (err as Error).message || "Something went wrong. Please try again."
          );
        }
        setIsStreaming(false);
        return null;
      }
    },
    []
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Cancel any in-flight stream when the component unmounts. Without this,
  // navigating away mid-stream leaves the fetch open and the server keeps
  // token-billing Anthropic until the response completes on its own.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const clearStreamedText = useCallback(() => {
    setStreamedText("");
  }, []);

  const clearStreamError = useCallback(() => {
    setStreamError(null);
  }, []);

  return {
    streamedText,
    isStreaming,
    streamError,
    startStream,
    cancelStream,
    clearStreamedText,
    clearStreamError,
  };
}
