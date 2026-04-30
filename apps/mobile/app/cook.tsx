import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { supabase } from "@/lib/supabase";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function CookModeScreen() {
  useKeepAwake();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { recipeId, title, steps: stepsJson } = useLocalSearchParams<{
    recipeId: string;
    title: string;
    steps: string;
  }>();

  // CM1 fix (2026-04-28): a malformed `steps` query param used to crash
  // the screen with no error UI — `JSON.parse` would throw on the
  // synchronous render path and Expo Router would surface a red box in
  // dev / a blank screen in prod. Now we fail safe to an empty array
  // and the screen renders the "no instructions yet" state below.
  const steps: string[] = (() => {
    if (!stepsJson) return [];
    try {
      const parsed = JSON.parse(stepsJson);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((s): s is string => typeof s === "string");
    } catch {
      return [];
    }
  })();
  const [current, setCurrent] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressWidthRef = useRef(new Animated.Value(0)).current;

  const totalSteps = steps.length;
  const isDone = current >= totalSteps;
  const stepText = current < totalSteps ? steps[current]!.replace(/^\d+[\.\)\-]\s*/, "") : "";

  // Track cook mode open — parity with web `CookMode.tsx` (audit R2,
  // 2026-04-18). Same event name + `{ recipeId, stepCount }` payload shape
  // as the web call site (`recipe.id` there, `recipeId` from query params
  // here). Fires once per mount. Mobile previously silent on this event.
  useEffect(() => {
    track(AnalyticsEvents.cook_mode_opened, {
      recipeId,
      stepCount: totalSteps,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer count up
  useEffect(() => {
    if (timerActive) {
      intervalRef.current = setInterval(() => {
        setTimerElapsed((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerActive]);

  // Animate progress bar
  useEffect(() => {
    const progressPercent = (current + 1) / totalSteps;
    Animated.timing(progressWidthRef, {
      toValue: progressPercent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [current, totalSteps, progressWidthRef]);

  const goNext = () => {
    stopTimer();
    if (current < totalSteps) setCurrent((c) => c + 1);
  };

  const goPrev = () => {
    stopTimer();
    if (current > 0) setCurrent((c) => c - 1);
  };

  const startTimer = () => {
    setTimerElapsed(0);
    setTimerActive(true);
    // Parity with web `CookMode.tsx` (audit R2, 2026-04-18). Web fires
    // `{ recipeId, seconds: totalSeconds }` because web timers are
    // pre-parsed countdowns with a known duration. Mobile is a count-up
    // stopwatch with no intended duration at start time, so `seconds`
    // is intentionally omitted — emitting a fake value would poison
    // the dashboard. `recipe_timer_completed` is not fired on mobile
    // because the mobile timer has no natural completion event (the
    // user always presses Stop). Documented in the verification report.
    track(AnalyticsEvents.recipe_timer_started, { recipeId });
  };

  const stopTimer = () => {
    setTimerActive(false);
    setTimerElapsed(0);
  };

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md, padding: Spacing.xxl },
    errorText: { color: colors.text, fontSize: 16 },
    emptyHeading: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
    emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 320 },
    backBtn: { paddingHorizontal: 22, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Accent.primary, marginTop: Spacing.lg },
    backBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
    },
    // Audit 2026-04-30: Exit is navigation, not deletion. Was rendered
    // in `Accent.destructive` (red) which made users hesitate. Reserve
    // red for true destructive actions; use the standard text colour
    // here so Exit reads as "go back" rather than "discard cook".
    headerExit: { color: colors.text, fontSize: 16, fontWeight: "600" },
    headerCounter: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },

    progressBar: {
      height: 3,
      backgroundColor: colors.border,
      width: "100%",
    },
    progressBarFilled: {
      height: 3,
      backgroundColor: Accent.primary,
    },

    stepContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.xxl,
      gap: Spacing.xl,
    },

    stepNumber: {
      width: 40,
      height: 40,
      borderRadius: 8,
      backgroundColor: Accent.primary + "20",
      justifyContent: "center",
      alignItems: "center",
    },
    stepNumberText: { color: Accent.primary, fontSize: 18, fontWeight: "700" },

    stepText: {
      fontSize: 17,
      fontWeight: "500",
      color: colors.text,
      textAlign: "center",
      lineHeight: 24,
    },

    timerSection: { alignItems: "center", gap: Spacing.md },
    timerDisplay: {
      fontSize: 38,
      fontWeight: "700",
      color: Accent.primary,
      fontVariant: ["tabular-nums"],
      fontFamily: "Menlo",
    },
    timerStartBtn: {
      backgroundColor: Accent.primary + "20",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
    },
    timerStartText: { color: Accent.primary, fontWeight: "600", fontSize: 15 },
    timerStopBtn: {
      backgroundColor: Accent.destructive + "20",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
    },
    timerStopText: { color: Accent.destructive, fontWeight: "600", fontSize: 15 },

    navRow: {
      flexDirection: "row",
      gap: Spacing.md,
      width: "100%",
      marginTop: Spacing.xl,
    },
    navBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: Radius.md,
      backgroundColor: colors.card,
      alignItems: "center",
    },
    navBtnText: { color: colors.text, fontWeight: "600", fontSize: 16 },
    navBtnDisabled: { opacity: 0.4 },
    nextBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: Radius.md,
      backgroundColor: Accent.primary,
      alignItems: "center",
    },
    nextBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    doneIcon: { fontSize: 48 },
    doneTitle: { fontSize: 24, fontWeight: "700", color: colors.text },
    doneSubtext: { fontSize: 14, color: colors.textSecondary },
    doneBtn: {
      marginTop: Spacing.lg,
      backgroundColor: Accent.primary,
      paddingHorizontal: Spacing.xxxl,
      paddingVertical: 14,
      borderRadius: Radius.md,
    },
    doneBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  }), [colors]);

  if (steps.length === 0) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <Text style={styles.emptyHeading}>No cook steps yet</Text>
          <Text style={styles.emptySub}>
            This recipe doesn&apos;t have step-by-step instructions. You can still log it from the recipe page.
          </Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Back to recipe</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const progressWidth = progressWidthRef.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.headerExit}>Exit</Text>
        </Pressable>
        <Text style={styles.headerCounter}>Step {current + 1} of {totalSteps}</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <Animated.View
          style={[
            styles.progressBarFilled,
            {
              width: progressWidth,
            },
          ]}
        />
      </View>

      {!isDone ? (
        <View style={styles.stepContainer}>
          {/* Step number */}
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{current + 1}</Text>
          </View>

          {/* Step text */}
          <Text style={styles.stepText}>{stepText}</Text>

          {/* Timer */}
          <View style={styles.timerSection}>
            {timerActive ? (
              <>
                <Text style={styles.timerDisplay}>{formatTimer(timerElapsed)}</Text>
                <Pressable style={styles.timerStopBtn} onPress={stopTimer}>
                  <Text style={styles.timerStopText}>Stop</Text>
                </Pressable>
              </>
            ) : (
              <Pressable style={styles.timerStartBtn} onPress={startTimer}>
                <Text style={styles.timerStartText}>⏱ Start Timer</Text>
              </Pressable>
            )}
          </View>

          {/* Navigation */}
          <View style={styles.navRow}>
            <Pressable
              style={[styles.navBtn, current === 0 && styles.navBtnDisabled]}
              onPress={goPrev}
              disabled={current === 0}
            >
              <Text style={styles.navBtnText}>Previous</Text>
            </Pressable>
            <Pressable style={styles.nextBtn} onPress={goNext}>
              <Text style={styles.nextBtnText}>
                {current === totalSteps - 1 ? "Done!" : "Next Step"}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        /* Done state */
        <View style={styles.centered}>
          <Text style={styles.doneIcon}>🎉</Text>
          <Text style={styles.doneTitle}>Enjoy your meal!</Text>
          <Text style={styles.doneSubtext}>{title}</Text>
          {/* P2-24 (2026-04-25): Log this meal — closes the loop from cook
              back to the journal. Replace the route with the recipe detail
              + an `autoLog=1` query param; the recipe page already owns
              the journal-write logic with the coercion guard (P0-3) so we
              don't fork the write path. */}
          <Pressable
            style={styles.doneBtn}
            onPress={() => {
              if (recipeId) {
                track(AnalyticsEvents.cook_mode_log_tapped, { recipeId });
                router.replace(`/recipe/${recipeId}?autoLog=1` as never);
              } else {
                router.back();
              }
            }}
          >
            <Text style={styles.doneBtnText}>Log this meal</Text>
          </Pressable>
          <Pressable
            style={[styles.doneBtn, { backgroundColor: "transparent", marginTop: Spacing.sm }]}
            onPress={() => router.back()}
          >
            <Text style={[styles.doneBtnText, { color: colors.textSecondary }]}>Skip — back to recipe</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
