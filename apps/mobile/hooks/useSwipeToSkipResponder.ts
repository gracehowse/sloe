import * as React from "react";
import { PanResponder } from "react-native";
import type { GestureResponderEvent, PanResponderGestureState } from "react-native";
import { useHaptics } from "@/hooks/useHaptics";

const SKIP_THRESHOLD = 50;

/**
 * Swipe-left-to-skip PanResponder, extracted from `NorthStarBlock.tsx`
 * (screen-budget pin). Reduce-motion users see a top-right `X` button
 * instead of the gesture (caller's responsibility).
 *
 * Defensive: `PanResponder` isn't present in the test-time RN shim (see
 * `apps/mobile/tests/shims/react-native.cjs`) — guards the `.create` call
 * so unit tests can mount the block without throwing. The gesture path is
 * exercised on-device only; tests target the reduce-motion `X` button
 * fallback.
 */
export function useSwipeToSkipResponder(reduceMotion: boolean, onSkip?: () => void) {
  const haptics = useHaptics();
  return React.useMemo(() => {
    if (
      typeof PanResponder === "undefined" ||
      typeof (PanResponder as { create?: unknown })?.create !== "function"
    ) {
      return { panHandlers: {} } as { panHandlers: Record<string, unknown> };
    }
    return PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (
        _evt: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => !reduceMotion && gesture.dx < -8 && Math.abs(gesture.dy) < 12,
      onPanResponderRelease: (
        _evt: GestureResponderEvent,
        gesture: PanResponderGestureState,
      ) => {
        if (gesture.dx <= -SKIP_THRESHOLD && onSkip) {
          haptics.confirm();
          onSkip();
        }
      },
    });
  }, [haptics, onSkip, reduceMotion]);
}
