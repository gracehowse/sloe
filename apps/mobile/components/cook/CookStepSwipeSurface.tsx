import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Animated, Dimensions } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  cookStepSwipeRubberBand,
  resolveCookStepSwipe,
} from "@suppr/nutrition-core/cookStepSwipe";

export interface CookStepSwipeSurfaceProps {
  enabled: boolean;
  stepIndex: number;
  stepCount: number;
  onStepIndexChange: (nextIndex: number) => void;
  /** Called before the index changes (e.g. stop an active timer). */
  onBeforeStepChange?: () => void;
  children: ReactNode;
  testID?: string;
}

/** Horizontal swipe wrapper for cook-mode step content (ENG-947).
 *  Keeps Prev/Next buttons as the accessible fallback; swipe adds a
 *  large, messy-hands-friendly target with a gentle slide.
 *
 *  LAYOUT CONTRACT (ENG-1230): when `enabled`, children are wrapped in a
 *  `flex: 1` Animated.View so the translateX slide fills the step area. That
 *  `flex: 1` collapses to zero height in a NON-flex parent — which silently
 *  hides ALL step content. Callers MUST render this inside a flex parent that
 *  grants it height (the standalone `/cook` screen does; `recipe/[id].tsx`'s
 *  inline cook overlay had to add `flex: 1` to its step-body group to fix it). */
export function CookStepSwipeSurface({
  enabled,
  stepIndex,
  stepCount,
  onStepIndexChange,
  onBeforeStepChange,
  children,
  testID = "cook-step-swipe-surface",
}: CookStepSwipeSurfaceProps) {
  // Keep the screen awake while cooking (ENG-959 — web parity with the
  // `navigator.wakeLock` in `src/app/components/CookMode.tsx`). This surface
  // renders during the "steps" phase of the cook overlay, so the hook runs only
  // while cooking and the keep-awake tag is released on unmount. The "mise"
  // phase renders `CookMiseEnPlace` instead, which holds its own keep-awake tag
  // for that phase. The standalone `/cook` screen calls `useKeepAwake()`
  // directly; the inline cook overlay in `recipe/[id].tsx` did not — wiring it
  // here (plus `CookMiseEnPlace`) covers both surfaces without touching that
  // pinned (screen-budget) file, and `useKeepAwake` must never be called
  // conditionally so it lives above the `enabled` early return.
  useKeepAwake();

  const translateX = useRef(new Animated.Value(0)).current;
  const stepIndexRef = useRef(stepIndex);
  const stepCountRef = useRef(stepCount);
  const onStepIndexChangeRef = useRef(onStepIndexChange);
  const onBeforeStepChangeRef = useRef(onBeforeStepChange);

  useEffect(() => {
    stepIndexRef.current = stepIndex;
  }, [stepIndex]);
  useEffect(() => {
    stepCountRef.current = stepCount;
  }, [stepCount]);
  useEffect(() => {
    onStepIndexChangeRef.current = onStepIndexChange;
  }, [onStepIndexChange]);
  useEffect(() => {
    onBeforeStepChangeRef.current = onBeforeStepChange;
  }, [onBeforeStepChange]);

  useEffect(() => {
    translateX.setValue(0);
  }, [stepIndex, translateX]);

  const commitDirection = useCallback(
    (direction: "next" | "prev") => {
      const current = stepIndexRef.current;
      const nextIndex = direction === "next" ? current + 1 : current - 1;
      if (nextIndex < 0 || nextIndex >= stepCountRef.current) return;
      onBeforeStepChangeRef.current?.();
      onStepIndexChangeRef.current(nextIndex);
    },
    [],
  );

  const snapBack = useCallback(() => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }, [translateX]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enabled)
        // Same `.runOnJS(true)` posture as `RulerSlider` — no worklets,
        // no Reanimated event-bridge abort on iOS sim (2026-05-12 TF).
        .runOnJS(true)
        .activeOffsetX([-16, 16])
        .failOffsetY([-20, 20])
        .onUpdate((event) => {
          const banded = cookStepSwipeRubberBand(
            event.translationX,
            stepIndexRef.current,
            stepCountRef.current,
          );
          translateX.setValue(banded);
        })
        .onEnd((event) => {
          const viewportWidth = Dimensions.get("window").width;
          const direction = resolveCookStepSwipe({
            translationX: event.translationX,
            velocityX: event.velocityX,
            viewportWidth,
            stepIndex: stepIndexRef.current,
            stepCount: stepCountRef.current,
          });

          if (direction === "none") {
            snapBack();
            return;
          }

          const slideOut =
            direction === "next" ? -viewportWidth * 0.12 : viewportWidth * 0.12;
          Animated.timing(translateX, {
            toValue: slideOut,
            duration: 140,
            useNativeDriver: true,
          }).start(({ finished }) => {
            if (!finished) {
              snapBack();
              return;
            }
            translateX.setValue(
              direction === "next" ? viewportWidth * 0.08 : -viewportWidth * 0.08,
            );
            commitDirection(direction);
            Animated.timing(translateX, {
              toValue: 0,
              duration: 180,
              useNativeDriver: true,
            }).start();
          });
        }),
    [commitDirection, enabled, snapBack, translateX],
  );

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={{ flex: 1, transform: [{ translateX }] }}
        testID={testID}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
