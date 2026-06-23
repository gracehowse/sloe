import { useEffect, useMemo, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { Spacing } from "@/constants/theme";
import { useCookRunningTimers } from "@/hooks/useCookRunningTimers";
import { CookRunningTimerStrip } from "@/components/cook/CookRunningTimerStrip";
import { CookStepTimerPills } from "@/components/cook/CookStepTimerPills";
import { parseTimersInStep } from "@suppr/nutrition-core/recipeTimers";

export interface CookTimerPanelProps {
  /** Recipe id — threaded to the timer-started/completed analytics. */
  recipeId: string;
  /** Zero-based active step index — stamped on each started timer so the
   *  strip can label which step a concurrent countdown belongs to. */
  stepIndex: number;
  /** The RAW (cleaned, pre-scale) step text. Timers are parsed off the
   *  unscaled string so offsets stay stable as the serving scale changes —
   *  scaling rewrites amounts ("2 cups" → "1 cup") but never durations
   *  ("bake for 25 minutes"), and the parser must index against the
   *  unchanged text. Mirrors web `CookMode.tsx` (`currentStepCleaned`). */
  stepText: string;
  /** `cook_multi_timers_v1` gate. Flag-off renders nothing (byte-identical
   *  revert) and the hook drops any running timers. */
  enabled: boolean;
  testID?: string;
}

/**
 * Cook-mode step timers (ENG-1230 parity fix). Ports the timer wiring that
 * already existed in the orphaned `app/cook.tsx` standalone screen and on
 * web `CookMode.tsx` into the LIVE inline cook overlay in `recipe/[id].tsx`,
 * which previously had no timers at all.
 *
 * Self-contained so the pinned `recipe/[id].tsx` screen file stays under its
 * line-budget cap: it owns the `useCookRunningTimers` hook (tick + chime +
 * Success haptic + `recipe_timer_completed`), parses durations out of the
 * current step, and renders:
 *   - one tappable pill per parsed duration (tap to start a countdown), and
 *   - a concurrent running-timer strip that stays visible + cancellable even
 *     after the user advances past the step the timer was started on.
 *
 * The strip sits directly above the pills here (rather than pinned to the
 * top of the overlay as on web) — a deliberate, contained placement so the
 * whole timer surface mounts at one point under the step text. The hook and
 * the chime/haptic-on-done behaviour are identical to the standalone screen.
 */
export function CookTimerPanel({
  recipeId,
  stepIndex,
  stepText,
  enabled,
  testID = "cook-timer-panel",
}: CookTimerPanelProps) {
  const {
    runningTimers,
    startParsedTimer,
    cancelTimer,
    resetTimer,
  } = useCookRunningTimers(recipeId, enabled);

  /** Parse timers off the RAW step text (see `stepText` prop note). */
  const parsedTimers = useMemo(
    () => (enabled ? parseTimersInStep(stepText) : []),
    [enabled, stepText],
  );

  /** Count of countdowns still running on THIS step — drives whether we
   *  pulse the first pill (only when nothing's been started yet for it). */
  const activeStepTimerCount = runningTimers.filter(
    (timer) => timer.stepIndex === stepIndex && !timer.done,
  ).length;
  const pulseFirst = parsedTimers.length > 0 && activeStepTimerCount === 0;

  /** Subtle pulse on the first suggested pill so a first-time cook notices
   *  it. Stops the moment a timer is started for the current step. */
  const pulseRef = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulseFirst) {
      pulseRef.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRef, {
          toValue: 1.06,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(pulseRef, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseFirst, pulseRef]);

  if (!enabled) return null;
  if (parsedTimers.length === 0 && runningTimers.length === 0) return null;

  return (
    <View style={styles.panel} testID={testID}>
      <CookRunningTimerStrip
        timers={runningTimers}
        onReset={resetTimer}
        onCancel={cancelTimer}
      />
      <CookStepTimerPills
        timers={parsedTimers}
        pulseFirst={pulseFirst}
        pulseRef={pulseRef}
        onStart={(timer) => startParsedTimer(timer, stepIndex)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
    width: "100%",
  },
});
