import * as React from "react";

/**
 * Catches Skia render failures (common when JS @shopify/react-native-skia
 * version ≠ the native binary, e.g. Dependabot bump before a TF rebuild)
 * and lets CalorieRing fall back to the SVG arc layer instead of hitting
 * RootErrorBoundary.
 */
type Props = {
  children: React.ReactNode;
  onFallback: () => void;
};

type State = { failed: boolean };

export class SkiaRingErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown): void {
    void import("@/lib/errorTracking")
      .then(({ captureException }) => captureException(error))
      .catch(() => {
        // capture must never throw; skip if Sentry isn't loadable
      });
    this.props.onFallback();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
