"use client";

import { useEffect } from "react";
import { Button } from "@/app/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error boundary", error);
    // Report to Sentry if available
    try {
      const Sentry = (globalThis as Record<string, unknown>).Sentry as
        | { captureException?: (e: Error) => void }
        | undefined;
      Sentry?.captureException?.(error);
    } catch {
      /* Sentry not loaded */
    }
  }, [error]);

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/40 p-6 shadow-lg">
        <h1 className="text-slate-900 dark:text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Try again. If this keeps happening, we'll need to investigate the error details in the logs.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => reset()}>
            Try again
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Go home
          </Button>
        </div>
      </div>
    </div>
  );
}

