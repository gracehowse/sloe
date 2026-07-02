import * as React from "react";
import { ActivityIndicator, Text } from "react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { SupprButton } from "@/components/ui/SupprButton";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";

/**
 * QuickLogButton — the compact secondary "Log" action on suggestion surfaces
 * (ENG-1301, VERIFIED V13). The north-star CTA and Coach candidate rows used
 * to route ONLY to /recipe/[id]; this commits the suggested recipe to the
 * suggested slot in one tap instead. Presentation-only: the host owns the
 * actual journal insert (it must reuse an existing quick-log insert helper —
 * no new logging path) and the standard success feedback; this component owns
 * the async press state (disable + spinner — no double-submit).
 *
 * Appearances:
 *   - `ghost`   — the canonical secondary (2026-06-12 button system): SupprButton
 *     variant="ghost", compact padding. For card/row surfaces.
 *   - `onImage` — dark scrim pill for the full-bleed Figma hero, matching the
 *     sibling skip-button grammar (`figmaSkipButton`: rgba(0,0,0,0.3) on-photo).
 *
 * Web mirror: the `logAction` slot in `north-star-block.tsx` /
 * `coach-screen.tsx` (SupprButton variant="ghost" + loading).
 */
export function QuickLogButton({
  onLog,
  appearance = "ghost",
  accessibilityLabel,
  testID,
}: {
  /** Host-owned quick-log commit. Awaited; the button disables + shows a
   *  spinner until it settles. */
  onLog: () => Promise<void> | void;
  appearance?: "ghost" | "onImage";
  /** e.g. "Log Chicken salad to Lunch". */
  accessibilityLabel: string;
  testID?: string;
}) {
  const [logging, setLogging] = React.useState(false);
  const handlePress = React.useCallback(async () => {
    if (logging) return;
    setLogging(true);
    try {
      await onLog();
    } finally {
      setLogging(false);
    }
  }, [logging, onLog]);

  if (appearance === "onImage") {
    return (
      <PressableScale
        testID={testID}
        haptic={logging ? "none" : "confirm"}
        disabled={logging}
        onPress={() => void handlePress()}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled: logging, busy: logging }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          // Same on-photo scrim treatment as the sibling figma skip button.
          backgroundColor: "rgba(0,0,0,0.3)",
          borderRadius: Radius.full,
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.md,
        }}
      >
        {logging ? (
          <ActivityIndicator size="small" color={Accent.primaryForeground} />
        ) : (
          <Text style={{ ...Type.button, color: Accent.primaryForeground }} numberOfLines={1}>
            Log
          </Text>
        )}
      </PressableScale>
    );
  }

  return (
    <SupprButton
      variant="ghost"
      testID={testID}
      label="Log"
      loading={logging}
      onPress={() => void handlePress()}
      accessibilityLabel={accessibilityLabel}
      // Compact row footprint — layout-only override (padding stays on-scale).
      style={{ paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md }}
    />
  );
}

export default QuickLogButton;
