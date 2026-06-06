"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { Button } from "@/app/components/ui/button";
import { isFeatureEnabled } from "@/lib/analytics/track";

/**
 * Self-contained inline brand ring — `global-error.tsx` REPLACES the root
 * layout, so the global stylesheet (and heavy client components like
 * `SupprMark`) aren't guaranteed to be loaded here. We inline the Sloe
 * wordmark and use inline-style colours so the branded screen renders
 * correctly even when the app's CSS never mounts. Mirrors mobile
 * `RootErrorBoundary.renderBranded()`, which likewise renders a
 * self-contained dark brand surface.
 */
function InlineSloeWordmark({ size = 32, color }: { size?: number; color: string }) {
  return (
    <span
      role="img"
      aria-label="Sloe"
      style={{
        color,
        fontSize: size,
        fontWeight: 500,
        letterSpacing: "-0.02em",
        lineHeight: 1,
        fontFamily: 'Georgia, "Times New Roman", serif',
      }}
    >
      sloe
    </span>
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary", error);
    Sentry.captureException(error);
  }, [error]);

  // ENG-799 (Redesign — Design Direction 2026): brand-language crash screen
  // mirroring mobile RootErrorBoundary.renderBranded() — inline brand ring +
  // brand background tone. Gated behind redesign_branded_sheets; the legacy
  // slate card stays alive in the else branch. Wrapped so a cold flag client
  // can never break the last-resort recovery UI.
  let branded = false;
  try {
    branded = isFeatureEnabled("redesign_branded_sheets");
  } catch {
    branded = false;
  }

  if (branded) {
    // Self-contained inline colours (no CSS-var dependency): a dark brand
    // surface with a white ring, matching mobile's always-dark branded
    // boundary (Colors.dark.background #0f0e12 / brand-mark-ring #ffffff).
    return (
      <html lang="en">
        <body style={{ margin: 0 }}>
          <div
            data-testid="global-error-branded"
            style={{
              minHeight: "100vh",
              display: "grid",
              placeItems: "center",
              padding: "48px 24px",
              backgroundColor: "#0f0e12",
              color: "#f5f3ec",
              fontFamily: '"Inter", system-ui, sans-serif',
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: "28rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <InlineSloeWordmark size={32} color="#ffffff" />
              <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700 }}>
                Sloe ran into a problem
              </h1>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#a8a29e", maxWidth: "20rem" }}>
                The team has been notified. Try reloading the page.
              </p>
              <div style={{ marginTop: "8px" }}>
                <Button type="button" onClick={() => reset()}>
                  Reload
                </Button>
              </div>
            </div>
          </div>
        </body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen grid place-items-center px-6 py-12 bg-slate-50 dark:bg-slate-950">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/40 p-6 shadow-lg">
            <h1 className="text-slate-900 dark:text-white mb-2">Sloe ran into a problem</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              Try reloading the page. If this keeps happening, let us know.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => reset()}>
                Reload
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

