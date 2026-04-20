import { SupprMark } from "./ui/suppr-mark.tsx";

/**
 * Full-screen loading placeholder for auth / profile gates.
 *
 * Grace 2026-04-20: the visible "Loading profile…" text reads as
 * "something went wrong" after the first 200ms — kill it from the
 * visible layer and show a calm branded pulse instead. The `label`
 * is preserved as an sr-only + `aria-live` announcement so screen
 * readers still get progress updates.
 *
 * Visual language:
 *  - Centered SupprMark with a slow opacity + scale pulse (2s cycle).
 *    Reads as "thinking" without the dashboard-skeleton noise the
 *    previous Skeleton-bar implementation had.
 *  - Three small dots below, staggered pulse — communicates liveness
 *    for users with animation-enabled motion preferences.
 *  - `prefers-reduced-motion` respected: mark stays at full opacity,
 *    dots fade in place without transforming.
 *
 * Every `AppLoadingSkeleton` consumer (HomePageClient, HomeProfileGate,
 * App.tsx dynamic-import fallbacks, reset-password, legacy onboarding
 * form) picks this up automatically.
 */

export function AppLoadingSkeleton({ label }: { label?: string }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-5 p-6 bg-background"
      aria-busy="true"
    >
      <div className="v2-brand-pulse">
        <SupprMark size={44} />
      </div>
      <div className="flex gap-1.5" aria-hidden>
        <span className="v2-dot v2-dot-0" />
        <span className="v2-dot v2-dot-1" />
        <span className="v2-dot v2-dot-2" />
      </div>
      {/* Screen-reader-only status. Keeps the labelled-loading a11y
          contract without showing the words on screen. */}
      <span className="sr-only" aria-live="polite">
        {label ?? "Loading"}
      </span>
      <style>{`
        @keyframes v2BrandPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.55; transform: scale(0.97); }
        }
        @keyframes v2DotPulse {
          0%, 100% { opacity: 0.2; }
          50%      { opacity: 1; }
        }
        .v2-brand-pulse {
          animation: v2BrandPulse 2000ms ease-in-out infinite;
          will-change: opacity, transform;
        }
        .v2-dot {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: var(--muted-foreground);
          opacity: 0.2;
          animation: v2DotPulse 1200ms ease-in-out infinite;
        }
        .v2-dot-0 { animation-delay: 0ms; }
        .v2-dot-1 { animation-delay: 180ms; }
        .v2-dot-2 { animation-delay: 360ms; }
        @media (prefers-reduced-motion: reduce) {
          .v2-brand-pulse { animation: none; }
          .v2-dot { animation: v2DotPulse 2000ms ease-in-out infinite; }
        }
      `}</style>
    </div>
  );
}
