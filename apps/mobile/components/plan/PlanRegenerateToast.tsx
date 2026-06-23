import { StyleSheet, Text, View } from "react-native";
import { RefreshCw } from "lucide-react-native";

import { Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * PlanRegenerateToast — the calm "Plan updated — N meals changed" diff toast
 * (Group E Card 4, premium-bar audit 2026-05-14). Absolutely-positioned overlay
 * below the status bar; no tap target (calm-reward posture). Auto-dismiss is
 * owned by the host effect on `regenerateToast`.
 *
 * Extracted verbatim from `planner.tsx` (ENG-1225 Block 1) to free line-budget
 * headroom on that pinned screen for the v3 Plan UI — behaviour is unchanged.
 */
export interface PlanRegenerateToastProps {
  toast: { visible: boolean; changedCount: number } | null | undefined;
  /** Safe-area top inset — the toast sits `Spacing.sm` below it. */
  topInset: number;
}

export function PlanRegenerateToast({ toast, topInset }: PlanRegenerateToastProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  if (!toast?.visible) return null;
  return (
    <View
      testID="planner-regenerate-toast"
      accessibilityRole="alert"
      accessibilityLabel={`Plan updated. ${toast.changedCount} meals changed.`}
      pointerEvents="none"
      style={[
        styles.toast,
        {
          top: topInset + Spacing.sm,
          backgroundColor: colors.card,
          borderColor: accent.primary + "40",
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: accent.primary + "1A" }]}>
        <RefreshCw size={14} color={accent.primary} strokeWidth={2.25} />
      </View>
      <Text style={[styles.text, { color: colors.text }]}>
        Plan updated — {toast.changedCount}{" "}
        {toast.changedCount === 1 ? "meal" : "meals"} changed
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 1000,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, fontSize: 14, fontWeight: "600", letterSpacing: -0.1 },
});

export default PlanRegenerateToast;
