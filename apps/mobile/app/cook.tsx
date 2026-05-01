import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  ToastAndroid,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Star, Timer as TimerIcon, CheckCircle2 } from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";
import {
  parseTimersInStep,
  formatTimer as formatTimerShared,
  type ParsedTimer,
} from "../../../src/lib/nutrition/recipeTimers";
import { createSavedMeal } from "../../../src/lib/nutrition/savedMeals";
import {
  COOK_HISTORY_KEY_PREFIX,
  appendCookHistoryEntry,
  formatCookDuration,
  medianCookDuration,
  parseCookHistory,
  pickDefaultRegularsSlot,
} from "@/lib/cookSession";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function formatTimer(seconds: number): string {
  return formatTimerShared(seconds);
}

/** Show a brief confirmation message. Android gets a real Toast; iOS
 *  gets the lightweight `Alert.alert` with no buttons until dismissed —
 *  iOS doesn't ship a native toast, and pulling in a third-party one
 *  for two callsites is overkill. Auto-dismisses on iOS via timer. */
function showToast(message: string): void {
  if (Platform.OS === "android") {
    ToastAndroid.show(message, ToastAndroid.SHORT);
    return;
  }
  Alert.alert(message);
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
  /** When set (>0), the timer counts DOWN from this duration. When 0,
   *  the timer counts UP (stopwatch — historical behaviour). The two
   *  modes share `timerElapsed` so the UI render path stays simple;
   *  count-down completion is detected when `elapsed >= duration`. */
  const [timerDurationSec, setTimerDurationSec] = useState(0);
  const [timerDoneFired, setTimerDoneFired] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressWidthRef = useRef(new Animated.Value(0)).current;
  /** Pulse animation for the parsed-duration pill so users notice it
   *  before they'd otherwise tap the manual Start Timer button. Only
   *  pulses when a duration is parsed AND the user has not started a
   *  timer for the current step yet. */
  const pulseRef = useRef(new Animated.Value(1)).current;
  /** Capture session start time once on mount so the completion card
   *  can show "Took you Nm Ss". Stable across step navigation; never
   *  resets unless the screen unmounts. */
  const sessionStartRef = useRef<number>(Date.now());
  const [cookDurationSec, setCookDurationSec] = useState<number | null>(null);
  const [savedRating, setSavedRating] = useState<number | null>(null);
  const [addedToRegulars, setAddedToRegulars] = useState(false);
  /** Latest in a small recent-cook history per recipe, hydrated lazily
   *  when the completion card mounts so we can preview "you usually cook
   *  this in N min" once the surface lands. */
  const [priorCookMedianSec, setPriorCookMedianSec] = useState<number | null>(
    null,
  );

  const totalSteps = steps.length;
  const isDone = current >= totalSteps;
  const stepText = current < totalSteps ? steps[current]!.replace(/^\d+[\.\)\-]\s*/, "") : "";

  /** Parse durations out of the current step text. First match wins —
   *  if the step contains multiple ("simmer 10 minutes, then bake 25
   *  minutes") we surface the first one as the suggested timer; users
   *  can still hit the manual Start Timer for the second. Picking the
   *  longest would be wrong as often as right (instructions list the
   *  decisive step first). Future iteration: render a row of pills,
   *  one per match. */
  const parsedTimers: ParsedTimer[] = useMemo(
    () => parseTimersInStep(stepText),
    [stepText],
  );
  const suggestedTimer: ParsedTimer | null = parsedTimers[0] ?? null;
  /** True only when there's a suggested timer AND the user hasn't
   *  started any timer for this step yet — drives the pulse animation. */
  const showSuggestedPill =
    suggestedTimer != null && !timerActive && timerDurationSec === 0;

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

  /** Hydrate prior cook-history median for the optional "you usually
   *  cook this in N min" surface. Storage-only, no network. Failures
   *  are non-fatal — the card just doesn't show the prior-time line. */
  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(
          COOK_HISTORY_KEY_PREFIX + recipeId,
        );
        if (!raw || cancelled) return;
        const parsed = JSON.parse(raw);
        const history = parseCookHistory(parsed);
        const median = medianCookDuration(history);
        if (median != null) setPriorCookMedianSec(median);
      } catch {
        /* storage flaky — fail closed, no preview line */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId]);

  // Timer tick — supports both stopwatch (count-up) and parsed-duration
  // (count-down) modes. When `timerDurationSec > 0`, fires a one-shot
  // success haptic + step-done prompt the moment elapsed reaches the
  // duration; the historical stopwatch behaviour is preserved when no
  // duration is set.
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

  /** Detect count-down completion. Runs whenever elapsed advances and
   *  fires the haptic + Step done? prompt exactly once per active
   *  countdown — the `timerDoneFired` flag prevents repeats on the
   *  same end-of-timer tick. */
  useEffect(() => {
    if (!timerActive) return;
    if (timerDurationSec <= 0) return; // count-up mode — no completion event
    if (timerElapsed < timerDurationSec) return;
    if (timerDoneFired) return;
    setTimerDoneFired(true);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    track(AnalyticsEvents.recipe_timer_completed, {
      recipeId,
      seconds: timerDurationSec,
    });
    Alert.alert(
      "Timer done",
      "Step done? Move on to the next step or restart the timer.",
      [
        { text: "Restart", onPress: () => restartCountdown() },
        {
          text: "Next step",
          style: "default",
          onPress: () => {
            stopTimer();
            if (current < totalSteps) setCurrent((c) => c + 1);
          },
        },
      ],
    );
    // restartCountdown / stopTimer / setCurrent are stable enough; we
    // intentionally re-run on every tick once we've crossed the line so
    // the alert can still fire on a slow device.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerActive, timerElapsed, timerDurationSec, timerDoneFired]);

  /** Pulse the suggested-timer pill subtly so a first-time user notices
   *  it. Stops when the user starts any timer for the current step. */
  useEffect(() => {
    if (!showSuggestedPill) {
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
  }, [showSuggestedPill, pulseRef]);

  // Animate progress bar
  useEffect(() => {
    const progressPercent = (current + 1) / totalSteps;
    Animated.timing(progressWidthRef, {
      toValue: progressPercent,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [current, totalSteps, progressWidthRef]);

  /** Capture cook duration the moment the screen transitions to "done"
   *  AND persist a single entry to the per-recipe history for future
   *  "you usually cook this in N min" surfaces. Idempotent — only writes
   *  the first time `isDone` flips true (i.e. user actually finished).
   *
   *  Also fires a single Success haptic so completion lands in the body
   *  not just on screen — the audit's "🎉 emoji is the entire celebration"
   *  finding. Skipped when `steps.length === 0` (the empty-state path
   *  short-circuits before this effect even mounts). */
  useEffect(() => {
    if (!isDone) return;
    if (cookDurationSec != null) return; // already captured
    const elapsedSec = Math.max(
      0,
      Math.round((Date.now() - sessionStartRef.current) / 1000),
    );
    setCookDurationSec(elapsedSec);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (recipeId) {
      void persistCookHistoryEntry(recipeId, elapsedSec);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDone]);

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
    setTimerDurationSec(0); // explicit stopwatch mode
    setTimerDoneFired(false);
    setTimerActive(true);
    // Parity with web `CookMode.tsx` (audit R2, 2026-04-18). Web fires
    // `{ recipeId, seconds: totalSeconds }` because web timers are
    // pre-parsed countdowns with a known duration. Mobile is a count-up
    // stopwatch with no intended duration at start time, so `seconds`
    // is intentionally omitted — emitting a fake value would poison
    // the dashboard.
    track(AnalyticsEvents.recipe_timer_started, { recipeId });
  };

  /** Start a count-down timer parsed from the current step's text. The
   *  `recipe_timer_started` event payload includes `seconds` so the
   *  funnel can distinguish suggested-timer starts from stopwatch ones,
   *  matching web `CookMode.tsx` for parsed timers. */
  const startCountdown = useCallback(
    (timer: ParsedTimer) => {
      setTimerElapsed(0);
      setTimerDurationSec(timer.totalSeconds);
      setTimerDoneFired(false);
      setTimerActive(true);
      track(AnalyticsEvents.recipe_timer_started, {
        recipeId,
        seconds: timer.totalSeconds,
      });
    },
    [recipeId],
  );

  const restartCountdown = useCallback(() => {
    if (timerDurationSec <= 0) return;
    setTimerElapsed(0);
    setTimerDoneFired(false);
    setTimerActive(true);
  }, [timerDurationSec]);

  const stopTimer = () => {
    setTimerActive(false);
    setTimerElapsed(0);
    setTimerDurationSec(0);
    setTimerDoneFired(false);
  };

  /** Append a cook session to the per-recipe history in AsyncStorage.
   *  Pure logic lives in `appendCookHistoryEntry` (cap + slice); this
   *  wrapper handles the storage I/O and never throws — flaky storage
   *  drops the entry silently. */
  async function persistCookHistoryEntry(
    rid: string,
    durationSec: number,
  ): Promise<void> {
    try {
      const key = COOK_HISTORY_KEY_PREFIX + rid;
      const existing = await AsyncStorage.getItem(key);
      const prior = existing ? parseCookHistory(JSON.parse(existing)) : [];
      const next = appendCookHistoryEntry(prior, {
        durationSec,
        ts: Date.now(),
      });
      await AsyncStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* fail closed */
    }
  }

  const handleRate = useCallback(
    (stars: number) => {
      // Persistence to a recipe_ratings table is deferred — there's no
      // schema for it yet (CLAUDE.md: never invent backend). For now we
      // confirm the tap visually + keep the in-memory state so the
      // stars stay highlighted; the next iteration adds the migration
      // and writes through here. Defer documented in the audit report.
      setSavedRating(stars);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      showToast(`Rated ${stars} star${stars === 1 ? "" : "s"}`);
    },
    [],
  );

  const handleAddToRegulars = useCallback(async () => {
    if (!recipeId) return;
    if (addedToRegulars) return; // idempotent — disable button after first add
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData?.user?.id;
      if (!userId) {
        Alert.alert("Sign in needed", "Sign in to save this recipe as a regular.");
        return;
      }
      const { data: recipe, error } = await supabase
        .from("recipes")
        .select("id, title, calories, protein, carbs, fat, fiber_g")
        .eq("id", recipeId)
        .maybeSingle();
      if (error || !recipe) {
        Alert.alert("Could not add", "Recipe details unavailable. Try again.");
        return;
      }
      const slot = pickDefaultRegularsSlot(new Date());
      await createSavedMeal(supabase, userId, {
        name: typeof recipe.title === "string" && recipe.title
          ? recipe.title
          : (title || "My usual meal"),
        defaultMealSlot: slot,
        items: [
          {
            recipeTitle:
              typeof recipe.title === "string" && recipe.title
                ? recipe.title
                : (title || "Saved meal"),
            calories: Math.max(0, Math.round(Number(recipe.calories) || 0)),
            protein: Math.max(0, Math.round(Number(recipe.protein) || 0)),
            carbs: Math.max(0, Math.round(Number(recipe.carbs) || 0)),
            fat: Math.max(0, Math.round(Number(recipe.fat) || 0)),
            ...(recipe.fiber_g != null && Number.isFinite(Number(recipe.fiber_g))
              ? { fiber: Math.max(0, Math.round(Number(recipe.fiber_g))) }
              : {}),
            source: "recipe",
            sourceId: String(recipe.id),
          },
        ],
      });
      setAddedToRegulars(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        track(AnalyticsEvents.saved_meal_created, {
          itemCount: 1,
          defaultMealSlot: slot,
          source: "cook_completion",
        });
      } catch {
        /* analytics fire-and-forget */
      }
      showToast(`Added to your usual ${slot.toLowerCase()}.`);
    } catch (err) {
      console.warn("Cook → Add to regulars failed", err);
      Alert.alert("Could not add", "Try again in a moment.");
    }
  }, [recipeId, title, addedToRegulars]);

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
    timerStopBtn: {
      backgroundColor: Accent.destructive + "20",
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radius.md,
    },
    timerStopText: { color: Accent.destructive, fontWeight: "600", fontSize: 15 },

    /** Parsed-duration pill row. Tapping renders inside `timerSection`
     *  above the manual stopwatch button so the suggestion is the more
     *  prominent option when present. */
    suggestedTimerPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: 999,
      backgroundColor: Accent.primary + "15",
      borderWidth: 1,
      borderColor: Accent.primary + "55",
    },
    suggestedTimerText: {
      color: Accent.primary,
      fontWeight: "700",
      fontSize: 14,
    },
    timerSecondaryBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: Radius.md,
    },
    timerSecondaryText: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "600",
    },

    /** Calmer completion card (audit P1, 2026-04-30). Replaces the
     *  static 🎉 + "Enjoy your meal!" copy with a usable surface:
     *  duration line, 1-tap rating, "Add to my regulars". */
    doneCard: {
      width: "100%",
      maxWidth: 340,
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      padding: Spacing.xl,
      gap: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    doneCheck: {
      alignSelf: "center",
      marginBottom: Spacing.xs,
    },
    doneCardTitle: {
      fontSize: 22,
      fontWeight: "700",
      color: colors.text,
      textAlign: "center",
    },
    doneCardSub: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
    },
    ratingRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.sm,
      marginVertical: Spacing.sm,
    },
    addRegularsBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    addRegularsBtnDone: {
      borderColor: Accent.success + "55",
      backgroundColor: Accent.success + "15",
    },
    addRegularsText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: "600",
    },
    addRegularsTextDone: { color: Accent.success },
    priorCookLine: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: "center",
    },

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

          {/* Timer — suggested-duration pill when the step text contains
              a parseable duration ("bake for 25 minutes"); count-down
              when started from the pill; manual count-up stopwatch
              fallback otherwise. */}
          <View style={styles.timerSection}>
            {timerActive ? (
              <>
                <Text style={styles.timerDisplay}>
                  {timerDurationSec > 0
                    ? formatTimer(Math.max(0, timerDurationSec - timerElapsed))
                    : formatTimer(timerElapsed)}
                </Text>
                <Pressable style={styles.timerStopBtn} onPress={stopTimer}>
                  <Text style={styles.timerStopText}>Stop</Text>
                </Pressable>
              </>
            ) : (
              <>
                {showSuggestedPill && suggestedTimer && (
                  <Animated.View style={{ transform: [{ scale: pulseRef }] }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Set ${formatTimer(suggestedTimer.totalSeconds)} timer`}
                      onPress={() => startCountdown(suggestedTimer)}
                      style={styles.suggestedTimerPill}
                    >
                      <TimerIcon
                        size={16}
                        color={Accent.primary}
                        strokeWidth={2.25}
                      />
                      <Text style={styles.suggestedTimerText}>
                        Set {formatTimer(suggestedTimer.totalSeconds)} timer
                      </Text>
                    </Pressable>
                  </Animated.View>
                )}
                <Pressable
                  style={styles.timerSecondaryBtn}
                  onPress={startTimer}
                  accessibilityRole="button"
                  accessibilityLabel="Start stopwatch"
                >
                  <Text style={styles.timerSecondaryText}>
                    {showSuggestedPill ? "Or start a stopwatch" : "Start stopwatch"}
                  </Text>
                </Pressable>
              </>
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
        /* Done state — calmer completion card (audit P1, 2026-04-30).
           Replaces the static 🎉 hero with a useful "what next" surface:
           captured cook duration, 1-tap star rating (visual only — no
           ratings table yet, see persistence note in `handleRate`), and
           "Add to my regulars" which writes the recipe straight into
           the user's `user_saved_meals` so they can re-log it from the
           Quick Add panel without retyping. The two existing buttons
           (Log this meal / Skip) stay below so we don't break P2-24. */
        <View style={styles.centered}>
          <View style={styles.doneCard}>
            <View style={styles.doneCheck}>
              <CheckCircle2
                size={40}
                color={Accent.success}
                strokeWidth={2}
              />
            </View>
            <Text style={styles.doneCardTitle}>Recipe done.</Text>
            {cookDurationSec != null && (
              <Text style={styles.doneCardSub}>
                Took you {formatCookDuration(cookDurationSec)}.
                {title ? `\n${title}` : ""}
              </Text>
            )}
            {priorCookMedianSec != null && cookDurationSec != null && (
              <Text style={styles.priorCookLine}>
                You usually cook this in {formatCookDuration(priorCookMedianSec)}.
              </Text>
            )}

            {/* Rating row — 5 dots/stars. Tap = save (visual confirmation
                today; persistence deferred to a follow-up migration). */}
            <View style={styles.ratingRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = savedRating != null && n <= savedRating;
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityLabel={`Rate ${n} star${n === 1 ? "" : "s"}`}
                    onPress={() => handleRate(n)}
                    hitSlop={8}
                  >
                    <Star
                      size={28}
                      color={filled ? Accent.warning : colors.textTertiary}
                      fill={filled ? Accent.warning : "transparent"}
                      strokeWidth={1.75}
                    />
                  </Pressable>
                );
              })}
            </View>

            {/* Add to my regulars — writes a saved meal so the user can
                one-tap re-log this recipe from Quick Add tomorrow. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                addedToRegulars
                  ? "Already added to your regulars"
                  : "Add to my regulars"
              }
              onPress={handleAddToRegulars}
              disabled={addedToRegulars}
              style={[
                styles.addRegularsBtn,
                addedToRegulars && styles.addRegularsBtnDone,
              ]}
            >
              {addedToRegulars && (
                <CheckCircle2
                  size={16}
                  color={Accent.success}
                  strokeWidth={2.25}
                />
              )}
              <Text
                style={[
                  styles.addRegularsText,
                  addedToRegulars && styles.addRegularsTextDone,
                ]}
              >
                {addedToRegulars ? "Added to regulars" : "Add to my regulars"}
              </Text>
            </Pressable>
          </View>

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
            <Text style={[styles.doneBtnText, { color: colors.textSecondary }]}>
              {savedRating != null || addedToRegulars ? "Done" : "Skip — back to recipe"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
