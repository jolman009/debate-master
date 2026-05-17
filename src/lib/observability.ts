import * as Sentry from "@sentry/nextjs";

/**
 * Single error-reporting seam for the app.
 *
 * Gated by env vars: errors are always logged to the console; they are also
 * sent to Sentry only when SENTRY_DSN (or NEXT_PUBLIC_SENTRY_DSN) is set.
 * Without a DSN this is an inert console logger.
 */

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

let initialized = false;

function ensureInit() {
  if (initialized || !dsn) return;
  initialized = true;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}

export function reportError(
  error: unknown,
  context?: Record<string, unknown>
): void {
  // eslint-disable-next-line no-console
  console.error("[error]", error, context ?? "");

  if (!dsn) return;
  ensureInit();
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
