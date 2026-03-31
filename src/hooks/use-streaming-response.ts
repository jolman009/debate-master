"use client";

import { useState, useCallback, useRef } from "react";

interface StreamResult {
  done: boolean;
  nextStage?: string;
}

export function useStreamingResponse() {
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const startStream = useCallback(
    async (
      debateId: string,
      content?: string
    ): Promise<StreamResult | null> => {
      setIsStreaming(true);
      setStreamedText("");

      abortRef.current = new AbortController();

      try {
        const res = await fetch(`/api/debate/${debateId}/turn`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        // Check if this is a JSON response (no AI turn needed)
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const json = await res.json();
          setIsStreaming(false);
          return { done: true, nextStage: json.nextStage };
        }

        // SSE stream
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";
        let result: StreamResult | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (!data) continue;

            try {
              const parsed = JSON.parse(data);

              if (parsed.error) {
                console.error("Stream error:", parsed.error);
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
            } catch {
              // Ignore malformed SSE lines
            }
          }
        }

        setIsStreaming(false);
        return result;
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          // Cancelled
        } else {
          console.error("Stream failed:", err);
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

  return { streamedText, isStreaming, startStream, cancelStream };
}
