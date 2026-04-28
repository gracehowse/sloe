import * as React from "react";
import { Pressable, Text, View } from "react-native";
import { Accent, Spacing } from "@/constants/theme";
import { captureException } from "@/lib/errorTracking";

/**
 * RootErrorBoundary — catches uncaught render errors at the mobile
 * root and surfaces a recovery UI instead of letting the JS bundle
 * crash to a white screen.
 *
 * ERR-01 fix (audit 2026-04-28): in production builds, an uncaught
 * component throw used to leave the user staring at the splash, then
 * blank, then the OS killed the app. Sentry captured the error but
 * the user got no signal and no path back. This boundary mirrors the
 * web `app/error.tsx` shape: title / message / Try again / Go home.
 *
 * Class component because React's error-boundary contract requires
 * `componentDidCatch` / `getDerivedStateFromError`.
 */

interface State {
  error: Error | null;
  resets: number;
}

interface Props {
  children: React.ReactNode;
}

export class RootErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, resets: 0 };

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown): void {
    try {
      captureException(error);
    } catch {
      // capture must never throw and crash the boundary itself.
    }
  }

  handleRetry = (): void => {
    this.setState((prev) => ({ error: null, resets: prev.resets + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <View
          accessibilityRole="alert"
          style={{
            flex: 1,
            backgroundColor: "#0a0a0f",
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.xxl,
            gap: Spacing.lg,
          }}
        >
          <Text
            style={{
              fontSize: 22,
              fontWeight: "700",
              color: "#e4e4e8",
              textAlign: "center",
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              fontSize: 14,
              lineHeight: 20,
              color: "#94a3b8",
              textAlign: "center",
              maxWidth: 320,
            }}
          >
            Suppr hit an unexpected error. The team has been notified. Tap
            Try again to recover, or restart the app if it keeps happening.
          </Text>
          <Pressable
            onPress={this.handleRetry}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            style={({ pressed }) => ({
              backgroundColor: Accent.primary,
              paddingHorizontal: Spacing.xl,
              paddingVertical: Spacing.md,
              borderRadius: 12,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>
              Try again
            </Text>
          </Pressable>
          {this.state.resets >= 2 ? (
            <Text
              style={{
                fontSize: 12,
                color: "#64748b",
                textAlign: "center",
                marginTop: Spacing.sm,
              }}
            >
              Still not working? Force-quit Suppr from the app switcher and
              reopen.
            </Text>
          ) : null}
        </View>
      );
    }
    return this.props.children;
  }
}

export default RootErrorBoundary;
