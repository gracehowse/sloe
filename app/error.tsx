"use client";

import { useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { SupprMark } from "@/app/components/ui/suppr-mark";
import { isFeatureEnabled } from "@/lib/analytics/track";

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

  // ENG-799 (Redesign — Design Direction 2026): brand-language crash screen
  // mirroring mobile RootErrorBoundary.renderBranded() — brand mark + brand
  // background tone. Gated behind redesign_branded_sheets; the legacy slate
  // card stays alive in the else branch. Wrapped so a cold flag client can
  // never break the recovery UI.
  let branded = false;
  try {
    branded = isFeatureEnabled("redesign_branded_sheets");
  } catch {
    branded = false;
  }

  if (branded) {
    return (
      <div className="min-h-screen grid place-items-center px-6 py-12 bg-background">
        <div
          data-testid="route-error-branded"
          className="w-full max-w-md flex flex-col items-center gap-3 rounded-card-lg bg-card card-slab p-8 text-center"
        >
          <SupprMark size={44} className="mb-1" />
          <h1 className="text-foreground">Something went wrong</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            The team has been notified. Try again, or go home and start fresh.
          </p>
          <div className="flex flex-wrap justify-center gap-2 mt-1">
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

  return (
    <div className="min-h-screen grid place-items-center px-6 py-12 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/40 p-6 shadow-lg">
        <h1 className="text-slate-900 dark:text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          Try again, or go home and start fresh. If this keeps happening, let us know.
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

