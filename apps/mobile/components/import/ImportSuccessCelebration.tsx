import * as React from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { isFeatureEnabled } from "@/lib/analytics";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { WinMomentPlayer } from "@/components/ui/WinMomentPlayer";

/**
 * ENG-728 — import-success "magic moment" (mobile).
 *
 * Wraps the recipe-import success sheet so the calm celebration lands the
 * instant `state` flips to `"success"` in `import-shared.tsx`. Lives in its own
 * file because `import-shared.tsx` is pinned shrink-only under the screen-line
 * ratchet — the overlay + Reanimated dependency must NOT grow that screen.
 *
 * Two layered behaviours, both gated:
 *   1. A subtle FadeIn + scale-settle on the success sheet itself (the
 *      `children`), so the panel arrives gently rather than snapping in.
 *   2. A one-shot `WinMomentPlayer celebration="log-confirm" fullBleed`
 *      overlay — the quiet gold "Logged" beat (NOT a loud confetti storm; the
 *      `goal-hit` tier stays reserved for the daily ring landmark).
 *
 * Gating contract:
 *   - `isFeatureEnabled("import_magic_moment")` (default-ON since 2026-06-30,
 *     ENG-1279). Flag OFF → renders `children` verbatim, ZERO visual change.
 *   - `useReduceMotion()` → instant: no entering animation, no overlay. The
 *     sheet just appears. (WinMomentPlayer also honours reduce-motion itself,
 *     but we skip the mount entirely so there is genuinely no motion.)
 *   - Plays ONCE per mount. `onComplete` unmounts the overlay so it can't
 *     replay if the success sheet re-renders.
 *
 * Web mirror: the same flag + `prefers-reduced-motion` gate around
 * `WinMomentPlayer` + the success sheet in `src/app/components/RecipeUpload.tsx`.
 */
const SETTLE_MS = 320;

export function ImportSuccessCelebration({
  sheetStyle,
  children,
  testID,
}: {
  /** The `successSheet` style from `import-shared.tsx`, applied to the
   *  animated wrapper so the FadeIn/scale lands on the real panel. */
  sheetStyle?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  testID?: string;
}) {
  const enabled = isFeatureEnabled("import_magic_moment");
  const reduceMotion = useReduceMotion();
  const celebrate = enabled && !reduceMotion;

  // One-shot overlay: mount on first success render, unmount on complete.
  const [showOverlay, setShowOverlay] = React.useState(celebrate);

  // Subtle scale settle (0.96 → 1) on the sheet. Skipped under reduce-motion.
  const scale = useSharedValue(celebrate ? 0.96 : 1);
  React.useEffect(() => {
    if (!celebrate) return;
    scale.value = withTiming(1, {
      duration: SETTLE_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [celebrate, scale]);

  const sheetAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Flag OFF or reduce-motion → render the sheet verbatim, no overlay.
  if (!celebrate) {
    return (
      <View style={sheetStyle} testID={testID}>
        {children}
      </View>
    );
  }

  return (
    <Animated.View
      style={[sheetStyle, sheetAnimStyle]}
      entering={FadeIn.duration(SETTLE_MS)}
      testID={testID}
    >
      {children}
      {showOverlay ? (
        <WinMomentPlayer
          celebration="log-confirm"
          fullBleed
          onComplete={() => setShowOverlay(false)}
          testID="import-magic-moment"
        />
      ) : null}
    </Animated.View>
  );
}

export default ImportSuccessCelebration;
