/**
 * Privacy-safe client and server analytics telemetry helper.
 * Tracks user engagement events (setup progression, debate turns, practice conversions, feedback signals)
 * without collecting or transmitting private debate content.
 */

export type AnalyticsEventName =
  | "setup_step_viewed"
  | "setup_completed"
  | "setup_abandoned"
  | "practice_suggested"
  | "practice_started"
  | "feedback_usefulness_rated"
  | "feedback_reported"
  | "debate_started"
  | "turn_submitted"
  | "debate_rematch";

export interface AnalyticsEventPayload {
  setup_step_viewed: { step: string; mode?: string };
  setup_completed: {
    mode: string;
    topic: string;
    personaId?: string;
    difficulty?: string;
  };
  setup_abandoned: { lastStep: string; mode?: string };
  practice_suggested: { focus: string; motion: string; difficulty: string };
  practice_started: { focus: string; motion: string; difficulty: string };
  feedback_usefulness_rated: {
    usefulness: "helpful" | "not_helpful";
    score: number | null;
    version: number;
  };
  feedback_reported: {
    score: number | null;
    version: number;
  };
  debate_started: { debateId: string; mode: string };
  turn_submitted: { debateId: string; stage: string; role?: string };
  debate_rematch: { motion: string; personaId?: string };
}

export type EventCallback = <E extends AnalyticsEventName>(
  name: E,
  properties: AnalyticsEventPayload[E]
) => void;

const listeners = new Set<EventCallback>();

/**
 * Register a listener for analytics events (e.g. for forwarding to external telemetry).
 */
export function addAnalyticsListener(listener: EventCallback): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Track an analytics event.
 */
export function trackEvent<E extends AnalyticsEventName>(
  name: E,
  properties: AnalyticsEventPayload[E]
): void {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug(`[Analytics: ${name}]`, properties);
  }

  for (const listener of listeners) {
    try {
      listener(name, properties);
    } catch {
      // Prevent listener errors from interfering with app flow
    }
  }
}
