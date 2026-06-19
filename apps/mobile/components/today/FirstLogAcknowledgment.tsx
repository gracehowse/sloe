import { memo } from "react";
import * as React from "react";
import { Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * FirstLogAcknowledgment — one-shot toast shown the very first time a
 * user logs ANY meal on this device.
 *
 * Activation hook (audit 2026-04-30 — competitor-vs-Suppr leak fix
 * #3). The Reveal moment in onboarding is solid, but momentum
 * evaporates after the user lands on Today: their first log moves the
 * ring with no acknowledgement, no "you did the thing." This is the
 * smallest possible reward — a haptic + 2.5s toast — pinned to a
 * one-time AsyncStorage flag (`suppr.first-log-acknowledged.v1`).
 *
 * Visibility lifecycle is host-owned (mirrors the
 * `AiFirstLogTooltip` pattern):
 *   - Host reads `suppr.first-log-acknowledged.v1`. If unset and
 *     `mealsToday.length` transitions from 0 → 1 (the first log),
 *     host fires the haptic and renders this component with
 *     `visible=true`.
 *   - 2.5s auto-fade → component calls `onDismiss` so the host
 *     persists the storage key + hides.
 *
 * The component renders absolutely above content (top-anchored,
 * inside the safe area) so it overlays whatever's mounted. No tap
 * target — auto-fade only, matches the "calm reward" posture.
 *
 * Web parity: web has no equivalent surface yet — adding the toast
 * to `src/app/components/NutritionTracker.tsx` is the matching
 * follow-up. Logged in the activation-hooks commit so sync-enforcer
 * can pick it up.
 */
export interface FirstLogAcknowledgmentProps {
  visible: boolean;
  onDismiss: () => void;
  /**
   * Auto-fade timeout in ms. Default 2500ms. Exposed for tests so
   * they can drive the timer with `vi.useFakeTimers()` without
   * waiting two and a half real seconds.
   */
  autoFadeMs?: number;
  /**
   * Top-inset offset (px) so the toast lands below the status bar /
   * notch on devices with safe-area insets. Host passes
   * `useSafeAreaInsets().top + Spacing.sm`.
   */
  topInset?: number;
}

const DEFAULT_AUTO_FADE_MS = 2500;

function FirstLogAcknowledgmentImpl(props: FirstLogAcknowledgmentProps) {
  const {
    visible,
    onDismiss,
    autoFadeMs = DEFAULT_AUTO_FADE_MS,
    topInset = Spacing.lg,
  } = props;
  const colors = useThemeColors();

  React.useEffect(() => {
    if (!visible) return;
    const handle = setTimeout(() => {
      onDismiss();
    }, autoFadeMs);
    return () => clearTimeout(handle);
  }, [visible, autoFadeMs, onDismiss]);

  if (!visible) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel="First log acknowledged"
      pointerEvents="none"
      // Absolute positioning so the toast overlays the ScrollView
      // without disturbing layout. Host sets `position: relative` on
      // the outer container.
      style={{
        position: "absolute",
        top: topInset,
        left: Spacing.md,
        right: Spacing.md,
        zIndex: 1000,
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.md,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: Accent.success + "40",
        // Subtle elevation so the toast lifts off the ring beneath it.
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 6,
        elevation: 4,
      }}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: Accent.success + "1A",
        }}
      >
        <Sparkles size={14} color={Accent.success} strokeWidth={2.25} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 14,
            fontWeight: "700",
            color: colors.text,
            letterSpacing: -0.2,
          }}
        >
          First log done.
        </Text>
        <Text
          style={{
            fontSize: 13,
            color: colors.textSecondary,
            marginTop: 1,
          }}
        >
          Your ring is moving.
        </Text>
      </View>
    </View>
  );
}

export const FirstLogAcknowledgment = memo(FirstLogAcknowledgmentImpl);

export default FirstLogAcknowledgment;
