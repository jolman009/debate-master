"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/observability";

/**
 * Top-level error boundary for the App Router. Catches rendering errors that
 * escape page-level handling, reports them, and offers a recovery action.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportError(error, { digest: error.digest, boundary: "global-error" });
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="max-w-md text-sm text-stage-muted">
            An unexpected error occurred. You can try again — if it keeps
            happening, the issue has been logged.
          </p>
          <button
            type="button"
            onClick={reset}
            className="btn-primary px-6 py-2.5"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
