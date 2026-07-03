import React, { memo } from "react";
import { View } from "react-native";
import { Plus } from "lucide-react-native";

import { Accent, Colors, Elevation } from "@/constants/theme";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAccent } from "@/context/theme";

/**
 * LogFab — persistent 56pt circular Log button.
 *
 * **DEPRECATED on mobile (2026-04-30).** No longer rendered in
 * Today's composition root. The customer-lens audit flagged the
 * side position (`right: 18, bottom: 100`) as overlapping right-edge
 * meal cards + macro tile column, and as the wrong genre for iOS
 * (Cal AI / Lifesum / MyFitnessPal converged on a centered raised
 * tab-bar button years ago). The Log entry point is now the
 * centered raised Plus button inside `<SupprTabBar>` — see
 * `apps/mobile/components/tabs/LogTabBarButton.tsx`.
 *
 * The component file is intentionally preserved (deferred deletion)
 * for two reasons:
 *   1. `tests/unit/canonicalTodayPhase2.test.tsx` still exercises
 *      the component primitive (visibility, default tap, custom
 *      placement) — proving the old behaviour didn't regress in
 *      the codebase, even if the call site moved.
 *   2. The web side still ships its own `<LogFab>` on mobile-web
 *      (`src/app/components/suppr/log-fab.tsx`); deleting the
 *      mobile primitive while the web one still ships would
 *      surprise a future cross-platform refactor.
 *
 * Original authority (D-2026-04-27-15):
 *   "Persistent Log FAB on Today. One sheet with tabs:
 *    search / barcode / recent / saved / voice / photo."
 *
 * Tap, scale, haptic per §1.1 of the production design spec:
 *   "FAB tap. Scale 1 → 0.94 → 1 over 180ms. Combined with haptic
 *    medium."
 */
export interface LogFabProps {
  /** Whether the FAB is visible. Hidden when an explicit overlay is
   *  open (e.g. add-meal form, scanner sheet). */
  visible?: boolean;
  /** Tap handler. Wires to the LogSheet open handler in the host. */
  onPress: () => void;
  /** Distance from the bottom edge in points. Defaults to 100pt
   *  (clears the system tab bar + a little breathing room). */
  bottom?: number;
  /** Distance from the right edge in points. Defaults to 18pt. */
  right?: number;
}

function LogFabImpl({ visible = true, onPress, bottom = 100, right = 18 }: LogFabProps) {
  const accent = useAccent();
  if (!visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        bottom,
        right,
        zIndex: 60,
      }}
    >
      <PressableScale
        haptic="confirm"
        scaleTo={0.94}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Log a meal"
        accessibilityHint="Opens the log sheet for searching foods, scanning barcodes, or quick logging"
        testID="today-log-fab"
        hitSlop={8}
        style={[
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: accent.primary,
            alignItems: "center",
            justifyContent: "center",
          },
          Elevation.floatPrimary,
        ]}
      >
        <Plus size={28} color={Colors.light.primaryForeground} strokeWidth={2.25} />
      </PressableScale>
    </View>
  );
}

export const LogFab = memo(LogFabImpl);

export default LogFab;
