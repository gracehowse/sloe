"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { isFeatureEnabled } from "../../lib/analytics/track.ts";
import { SupprMark } from "./ui/suppr-mark.tsx";

interface Props {
  children: ReactNode;
  /** Human-readable feature name for the error message */
  feature: string;
  /**
   * When true, render the brand-language recovery card (ENG-799 parity with
   * mobile `RootErrorBoundary.renderBranded()`). Defaults to the legacy slate
   * card. The flag is read by the functional `FeatureErrorBoundary` wrapper
   * below and threaded in here, because a class component can't call the
   * `isFeatureEnabled` hook-style read inline.
   */
  branded?: boolean;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

/**
 * Feature-level error boundary that isolates crashes to individual components
 * instead of taking down the entire view. Shows a retry button with count.
 *
 * ENG-799 (Redesign — Design Direction 2026, 2026-05-31): when the
 * `redesign_branded_sheets` flag is on (threaded in via the `branded` prop)
 * the fallback is rebuilt in the brand language — the canonical `SupprMark`,
 * a brand background tone, and a primary CTA — mirroring mobile
 * `RootErrorBoundary.renderBranded()`. Flag-off keeps the prior slate card
 * verbatim in the `else` branch.
 */
export class FeatureErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.feature}] Error boundary caught:`, error, info.componentStack);
    // If Sentry is available, report with context
    try {
      const Sentry = (globalThis as Record<string, unknown>).Sentry as
        | { captureException?: (e: Error, ctx?: unknown) => void }
        | undefined;
      Sentry?.captureException?.(error, {
        tags: { feature: this.props.feature },
        extra: { componentStack: info.componentStack },
      });
    } catch {
      /* Sentry not loaded */
    }
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, retryCount: prev.retryCount + 1 }));
  };

  /** Brand-language fallback — mirrors mobile `RootErrorBoundary.renderBranded()`
   *  (SupprMark brand mark + brand background tone + primary CTA + calm copy). */
  renderBranded() {
    return (
      <div
        role="alert"
        data-testid="feature-error-boundary-branded"
        className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border border-border bg-background m-4 text-center"
      >
        <SupprMark size={36} className="mb-1" />
        <p className="text-foreground font-medium">
          {this.props.feature} ran into a problem
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          {this.state.retryCount >= 3
            ? "This keeps failing. Try refreshing the page. The team has been notified."
            : "This section crashed but the rest of the app is fine. The team has been notified."}
        </p>
        <div className="flex gap-2 mt-1">
          {this.state.retryCount < 3 && (
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => { window.location.reload(); }}
            className="px-4 py-2 bg-secondary text-secondary-foreground text-sm font-medium rounded-xl hover:bg-secondary/80 transition-colors"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  /** Legacy slate fallback — the flag-off path, kept verbatim. */
  renderLegacy() {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/40 m-4">
        <p className="text-slate-900 dark:text-white font-medium mb-1">
          {this.props.feature} ran into a problem
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          {this.state.retryCount >= 3
            ? "This keeps failing. Try refreshing the page."
            : "This section crashed but the rest of the app is fine."}
        </p>
        <div className="flex gap-2">
          {this.state.retryCount < 3 && (
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try again
            </button>
          )}
          <button
            type="button"
            onClick={() => { window.location.reload(); }}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Refresh page
          </button>
        </div>
      </div>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.props.branded ? this.renderBranded() : this.renderLegacy();
    }

    return this.props.children;
  }
}

/**
 * Functional wrapper that reads the `redesign_branded_sheets` flag once and
 * threads it into the class boundary as the `branded` prop. The flag read
 * lives here (not in the class) so the class never has to do a hook-style
 * read; the public component name + `feature` prop API are unchanged, so all
 * existing call-sites keep working. Wrapping with a try/catch keeps a cold or
 * throwing flag client from ever breaking the recovery UI — it falls back to
 * the legacy slate card.
 */
export function FeatureErrorBoundary(props: Props) {
  let branded = false;
  try {
    branded = isFeatureEnabled("redesign_branded_sheets");
  } catch {
    branded = false;
  }
  return <FeatureErrorBoundaryClass {...props} branded={branded} />;
}
