"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { SupprMark } from "./ui/suppr-mark.tsx";

interface Props {
  children: ReactNode;
  /** Human-readable feature name for the error message */
  feature: string;
}

interface State {
  hasError: boolean;
  retryCount: number;
}

/**
 * Feature-level error boundary that isolates crashes to individual components
 * instead of taking down the entire view. Shows a retry button with count.
 *
 * ENG-799 (Redesign — Design Direction 2026, 2026-05-31): the fallback card
 * is built in the brand language — the canonical `SupprMark`, a brand
 * background tone, and a primary CTA — mirroring mobile
 * `RootErrorBoundary.renderBranded()`. `redesign_branded_sheets` collapsed
 * (ENG-1651): the flag was permanently ON via REDESIGN_DEFAULT_ON, so this
 * is the only fallback now — the legacy slate card is gone.
 */
export class FeatureErrorBoundary extends Component<Props, State> {
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

  render() {
    if (this.state.hasError) {
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

    return this.props.children;
  }
}

export default FeatureErrorBoundary;
