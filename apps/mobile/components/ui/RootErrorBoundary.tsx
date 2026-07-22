import * as React from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { Accent, Colors, Radius, Spacing, Type } from "@/constants/theme";
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
 *
 * ENG-799 (Redesign — Design Direction 2026, 2026-05-31): the recovery
 * UI is built in the brand language (token colours via `Colors.dark.*`
 * + `Accent.*`, brand mark, blue CTA) so the most off-brand moment in
 * the app — a crash — no longer reads as a borrowed/raw OS error screen.
 * `redesign_branded_sheets` collapsed (ENG-1651): the flag was permanently
 * ON via REDESIGN_DEFAULT_ON, so this is the only recovery UI now — the
 * prior hardcoded-hex legacy layout is gone.
 *
 * This component sits ABOVE the theme provider (it must survive a crash
 * in the provider tree), so it cannot use the `useThemeColors()` hook or
 * the hook-dependent `SupprMark`. It references `Colors.dark.*` tokens
 * directly and renders a self-contained inline brand mark.
 */

interface State {
  error: Error | null;
  resets: number;
}

interface Props {
  children: React.ReactNode;
}

/** Self-contained ring brand mark — no theme-context / flag dependency
 *  so it is safe to render inside the crashed tree. Mirrors the canonical
 *  `SupprPlateMark` ring motif (ENG-797). */
function InlineBrandMark({ size = 40, ring }: { size?: number; ring: string }) {
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="image"
      accessibilityLabel="Sloe"
    >
      <Svg width={size} height={size} viewBox="0 0 32 32">
        <Rect width="32" height="32" rx="8" fill="transparent" />
        <Circle cx="16" cy="16" r="9.5" stroke={ring} strokeWidth="2" fill="none" opacity={0.95} />
        <Circle cx="16" cy="16" r="5.5" stroke={ring} strokeWidth="1" fill="none" opacity={0.35} />
      </Svg>
    </View>
  );
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

  renderBranded() {
    const c = Colors.dark;
    return (
      <View
        accessibilityRole="alert"
        testID="root-error-boundary-branded"
        style={{
          flex: 1,
          backgroundColor: c.background,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.xxl,
          gap: Spacing.lg,
        }}
      >
        <InlineBrandMark size={44} ring={c.text} />
        <Text
          style={{
            ...Type.title,
            color: c.text,
            textAlign: "center",
          }}
        >
          Something went wrong
        </Text>
        <Text
          style={{
            ...Type.body,
            color: c.textSecondary,
            textAlign: "center",
            maxWidth: 320,
          }}
        >
          Sloe hit an unexpected error. The team has been notified. Tap Try
          again to recover, or restart the app if it keeps happening.
        </Text>
        <Pressable
          onPress={this.handleRetry}
          accessibilityRole="button"
          accessibilityLabel="Try again"
          style={({ pressed }) => ({
            backgroundColor: Accent.primary,
            paddingHorizontal: Spacing.xl,
            paddingVertical: Spacing.md,
            borderRadius: Radius.xl,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: Accent.primaryForeground, ...Type.button }}>Try again</Text>
        </Pressable>
        {this.state.resets >= 2 ? (
          <Text
            style={{
              ...Type.caption,
              color: c.textTertiary,
              textAlign: "center",
              marginTop: Spacing.sm,
            }}
          >
            Still not working? Force-quit Sloe from the app switcher and
            reopen.
          </Text>
        ) : null}
      </View>
    );
  }

  render() {
    if (this.state.error) {
      return this.renderBranded();
    }
    return this.props.children;
  }
}

export default RootErrorBoundary;
