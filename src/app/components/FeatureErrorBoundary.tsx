"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

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
                className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
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

    return this.props.children;
  }
}
