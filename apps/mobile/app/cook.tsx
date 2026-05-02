import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  Animated,
  ToastAndroid,
  TextInput,
  Platform,
  Linking,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Mic, MicOff, Play, Star, Timer as TimerIcon, CheckCircle2 } from "lucide-react-native";
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
  COOK_SCALE_PRESETS,
  clampCookScale,
  cookScaleCaption,
  cookScaleStorageKey,
  formatCookScaleLabel,
  scaleAmountText,
} from "../../../src/lib/nutrition/recipeScale";
import {
  formatCookHistoryPreview,
  insertCookHistory,
  listRecentCookHistory,
  type CookHistoryRow,
} from "../../../src/lib/nutrition/recipeCookHistoryClient";
import {
  COOK_HISTORY_KEY_PREFIX,
  COOK_NOTE_MAX_LEN,
  appendCookHistoryEntry,
  clampCookNote,
  formatCookDuration,
  medianCookDuration,
  parseCookHistory,
  pickDefaultRegularsSlot,
} from "@/lib/cookSession";
import { extractVideoHost } from "../../../src/lib/recipes/heroImageFallback";
import {
  COOK_HANDSFREE_FEATURE_ENABLED,
  readHandsfreeEnabled,
  writeHandsfreeEnabled,
} from "@/lib/cookHandsfree";

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
  const {
    recipeId,
    title,
    steps: stepsJson,
    // Recime parity (2026-04-30) — when set, surfaces a "Watch
    // original" pill in the header so the user can flip back to the
    // source video while cooking. `sourceVideoUrl` is preferred (set
    // by importer when distinct from the page URL); `sourceUrl` is
    // the fallback for imports where the page URL itself is the
    // video (YouTube watch / shorts URLs are common).
    sourceVideoUrl: sourceVideoUrlParam,
    sourceUrl: sourceUrlParam,
    // Round 4 user-sentiment audit (2026-04-30): the recipe yield is
    // surfaced in the cook header so "Serves N" is prominent (and
    // "Serves 1" appears verbatim for solo cooks — Mealime's locked
    // 2/4/6 was a top complaint). Optional — skips the header line
    // when not passed (e.g. cooking from a 3rd-party imported
    // recipe with unknown yield). `servings` is parsed safely; any
    // non-positive integer is treated as missing.
    servings: servingsParam,
  } = useLocalSearchParams<{
    recipeId: string;
    title: string;
    steps: string;
    sourceVideoUrl?: string;
    sourceUrl?: string;
    servings?: string;
  }>();
  /** Base recipe yield, parsed once from the route query. Null when
   *  unknown — the cook header simply omits the "Serves N" line. */
  const baseServings: number | null = (() => {
    if (typeof servingsParam !== "string" || !servingsParam.trim()) return null;
    const parsed = Number.parseInt(servingsParam, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  })();
  const watchOriginalUrl =
    typeof sourceVideoUrlParam === "string" && sourceVideoUrlParam.trim() !== ""
      ? sourceVideoUrlParam
      : typeof sourceUrlParam === "string" && sourceUrlParam.trim() !== ""
        ? sourceUrlParam
        : null;

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
  /** Active scale factor (Paprika parity, 2026-04-30). 0.5 / 1 / 1.5 /
   *  2 / 4 — see `COOK_SCALE_PRESETS`. Persisted per (userId, recipeId)
   *  to AsyncStorage so reopening the same recipe in Cook mode remembers
   *  the last scale used. Initialised optimistically to 1; the hydration
   *  effect below upgrades it once we've read storage. */
  const [scale, setScale] = useState<number>(1);
  /** Auth user id — used both as part of the scale storage key (so
   *  shared devices don't bleed scale between accounts) and as the
   *  Supabase write owner for the cook-history insert. Null until the
   *  hydration effect resolves; we treat null as "anon" for the local
   *  scale key, and skip the Supabase write entirely. */
  const [userId, setUserId] = useState<string | null>(null);
  /** Free-text per-cook note (Paprika parity). Capped at
   *  `COOK_NOTE_MAX_LEN` (500) chars by the input + clamp. */
  const [noteDraft, setNoteDraft] = useState<string>("");
  /** Latest 3 prior cook-history rows for this recipe, surfaced on the
   *  "Last time" card at the top of cook mode. Empty when the user has
   *  never cooked this recipe / read failed silently. */
  const [recentHistory, setRecentHistory] = useState<CookHistoryRow[]>([]);
  /** True while we're writing the completion entry to Supabase. Drives
   *  the Save button's loading state. */
  const [savingHistory, setSavingHistory] = useState(false);
  /** Whether the user has saved this completion. Idempotent — once
   *  true, the Save button stays disabled. */
  const [historySaved, setHistorySaved] = useState(false);

  /** Voice handsfree (Paprika parity, 2026-05-01). v1 ships the
   *  opt-in shell only — the toggle, the persistence, and an
   *  explanatory banner. Real audio capture is intentionally deferred
   *  per `docs/decisions/2026-05-01-cook-voice-handsfree.md` so the
   *  TestFlight build doesn't ship a mic permission prompt + binary
   *  bloat for a feature with zero users yet (solo-tester posture).
   *  The toggle still mirrors to AsyncStorage so v2 lights up
   *  listening without re-onboarding the user.
   *  Hydrated from storage on mount; defaults to OFF. */
  const [handsfreeOn, setHandsfreeOn] = useState(false);

  const totalSteps = steps.length;
  const isDone = current >= totalSteps;
  const rawStepText = current < totalSteps ? steps[current]!.replace(/^\d+[\.\)\-]\s*/, "") : "";
  /** Visible step text with amounts rewritten by the active scale.
   *  Returns the original verbatim when scale === 1 so the timer
   *  parser still indexes against the unchanged offsets when no
   *  scaling is active. The scaling itself is text-level only — the
   *  shared `scaleAmountText` helper picks up cooking units / count
   *  nouns and skips time / temperature / step numbers. */
  const stepText = useMemo(() => scaleAmountText(rawStepText, scale), [rawStepText, scale]);

  /** Parse durations out of the current step text. First match wins —
   *  if the step contains multiple ("simmer 10 minutes, then bake 25
   *  minutes") we surface the first one as the suggested timer; users
   *  can still hit the manual Start Timer for the second. Picking the
   *  longest would be wrong as often as right (instructions list the
   *  decisive step first). Future iteration: render a row of pills,
   *  one per match. */
  // Parse timers off the RAW step text — scaling can rewrite "2 cups"
  // → "1 cup" but must never touch "bake for 25 minutes" (the time-
  // unit guard in `scaleAmountText` enforces this). Indexing against
  // the raw text keeps the timer offsets stable regardless of the
  // active scale.
  const parsedTimers: ParsedTimer[] = useMemo(
    () => parseTimersInStep(rawStepText),
    [rawStepText],
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

  /** Recime parity (2026-04-30): tap the "Watch original" pill →
   *  emit `cook_watch_original_tapped` with the host classification
   *  (URL itself stays on-device) and open the link in the system
   *  browser / native app. `Linking.openURL` returns a Promise that
   *  rejects when nothing can handle the URL — we surface a soft
   *  alert in that case rather than crashing the cook session. */
  const onWatchOriginalPress = useCallback(() => {
    if (!watchOriginalUrl) return;
    const host = extractVideoHost(watchOriginalUrl);
    try {
      track(AnalyticsEvents.cook_watch_original_tapped, {
        recipeId,
        videoHost: host,
      });
    } catch {
      /* analytics fire-and-forget */
    }
    Linking.openURL(watchOriginalUrl).catch(() => {
      Alert.alert(
        "Couldn't open video",
        "The original video link couldn't be opened on this device.",
      );
    });
  }, [watchOriginalUrl, recipeId]);

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

  // Hydrate the persisted handsfree preference once on mount. Storage
  // failures fall back to OFF — privacy-safe default.
  // 2026-05-01 (PR 5) — when the v1 shell is gated off, skip the read
  // entirely so we don't grow an unused AsyncStorage round-trip on
  // every cook-mode mount. The toggle isn't rendered, so the
  // hydrated value would never be visible.
  useEffect(() => {
    if (!COOK_HANDSFREE_FEATURE_ENABLED) return;
    let cancelled = false;
    void (async () => {
      const enabled = await readHandsfreeEnabled();
      if (!cancelled) setHandsfreeOn(enabled);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Hydrate the auth user id once on mount. We need it for the per-
   *  user scale storage key and the cook-history Supabase write. Both
   *  surfaces gracefully degrade when the read fails — the scale falls
   *  back to the "anon:{recipeId}" key, the Supabase insert is skipped. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (cancelled) return;
        const id = data?.user?.id ?? null;
        setUserId(id);
      } catch {
        /* auth flaky — userId stays null */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Hydrate the persisted scale factor for this (userId, recipeId).
   *  Storage-only, no network. Falls back to 1 when the key is missing
   *  / malformed. Re-runs when userId resolves so a signed-in user
   *  picks up their account-scoped scale on first auth tick. */
  useEffect(() => {
    if (!recipeId) return;
    let cancelled = false;
    (async () => {
      try {
        const key = cookScaleStorageKey(userId, recipeId);
        const raw = await AsyncStorage.getItem(key);
        if (!raw || cancelled) return;
        const parsed = Number.parseFloat(raw);
        const clamped = clampCookScale(parsed);
        if (clamped !== 1) setScale(clamped);
      } catch {
        /* storage flaky — leave scale at 1 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId, userId]);

  /** Hydrate the latest 3 cook-history rows for the "Last time" card.
   *  Network read; failures fall back to an empty array (no card).
   *  Skipped when the user is not signed in (no rows can exist) or
   *  when the recipeId isn't a uuid (FK rejects non-uuid). */
  useEffect(() => {
    if (!recipeId || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listRecentCookHistory(supabase, userId, recipeId, 3);
        if (cancelled) return;
        setRecentHistory(rows);
      } catch {
        /* network / RLS flaky — fail closed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipeId, userId]);

  /** Persist a freshly-picked scale to AsyncStorage. Fire-and-forget;
   *  storage failures don't block the user. */
  const persistScale = useCallback(
    (next: number) => {
      if (!recipeId) return;
      const key = cookScaleStorageKey(userId, recipeId);
      void AsyncStorage.setItem(key, String(next)).catch(() => {
        /* storage flaky — fail closed, scale stays in memory */
      });
    },
    [recipeId, userId],
  );

  const handleScaleChange = useCallback(
    (next: number) => {
      const clamped = clampCookScale(next);
      if (clamped === scale) return;
      setScale(clamped);
      void Haptics.selectionAsync();
      persistScale(clamped);
      try {
        track(AnalyticsEvents.recipe_scale_changed, {
          recipeId,
          scale: clamped,
        });
      } catch {
        /* analytics fire-and-forget */
      }
    },
    [scale, persistScale, recipeId],
  );

  /** Flip the in-cook handsfree toggle. Persists the new value to the
   *  shared pref so the Settings switch stays in sync, and fires both
   *  analytics events: the session toggle (so we can slice cook-surface
   *  discovery) and the pref-changed (so the funnel doesn't have to
   *  UNION two surfaces to count opt-ins). */
  const handleHandsfreeToggle = () => {
    const next = !handsfreeOn;
    setHandsfreeOn(next);
    void writeHandsfreeEnabled(next);
    track(AnalyticsEvents.cook_handsfree_session_toggled, {
      recipeId,
      enabled: next,
    });
    track(AnalyticsEvents.cook_handsfree_pref_changed, { enabled: next });
  };

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
      // Best-effort local-history write so the median + "Last time"
      // surfaces have data even when the user never taps Save. The
      // Save button enriches this row with rating / note / scale +
      // writes to Supabase; this initial write only captures the
      // duration so the median reads remain stable. The active scale
      // is included so the local cache reflects how the dish was
      // cooked even if the network write is skipped.
      void persistCookHistoryEntry(recipeId, elapsedSec, {
        ...(scale !== 1 ? { scale } : {}),
      });
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
   *  drops the entry silently. Extra fields (scale / rating / note /
   *  recipeCookHistoryId) are stored alongside the duration so a
   *  future read of the local cache surfaces the full per-cook record
   *  even when the device was offline at write time. */
  async function persistCookHistoryEntry(
    rid: string,
    durationSec: number,
    extra: {
      scale?: number;
      rating?: number;
      note?: string;
      recipeCookHistoryId?: string;
    } = {},
  ): Promise<void> {
    try {
      const key = COOK_HISTORY_KEY_PREFIX + rid;
      const existing = await AsyncStorage.getItem(key);
      const prior = existing ? parseCookHistory(JSON.parse(existing)) : [];
      const entry: import("@/lib/cookSession").CookHistoryEntry = {
        durationSec,
        ts: Date.now(),
        ...(extra.scale != null && extra.scale !== 1 ? { scale: extra.scale } : {}),
        ...(extra.rating != null ? { rating: extra.rating } : {}),
        ...(extra.note ? { note: extra.note } : {}),
        ...(extra.recipeCookHistoryId
          ? { recipeCookHistoryId: extra.recipeCookHistoryId }
          : {}),
      };
      const next = appendCookHistoryEntry(prior, entry);
      await AsyncStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* fail closed */
    }
  }

  /** Tap handler for a rating star on the completion card. Stores in
   *  memory only — the actual Supabase write happens when the user
   *  taps Save (so they can adjust the rating + note together before
   *  committing one row). Light haptic confirms the tap. */
  const handleRate = useCallback(
    (stars: number) => {
      setSavedRating(stars);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [],
  );

  /** Save the per-cook history row: writes one row to
   *  `recipe_cook_history` (Supabase) and also enriches the local
   *  AsyncStorage cache so the "Last time" card has data even on the
   *  next offline open. Idempotent — disables itself once the row
   *  exists. Failures route to a toast; the local cache write still
   *  happens so the user's note isn't lost. */
  const handleSaveHistory = useCallback(async () => {
    if (!recipeId) return;
    if (historySaved || savingHistory) return;
    if (cookDurationSec == null) return; // shouldn't fire before completion

    const note = clampCookNote(noteDraft);
    const ratingValue = savedRating;
    const scaleValue = scale;

    setSavingHistory(true);

    let savedId: string | undefined;
    try {
      if (userId) {
        const row = await insertCookHistory(supabase, userId, {
          recipeId,
          durationSec: cookDurationSec,
          scaleFactor: scaleValue,
          rating: ratingValue ?? null,
          note: note ?? null,
        });
        savedId = row.id;
      }
      // Local cache enrichment runs even when the network write was
      // skipped (no userId) so the "Last time" card surfaces something.
      await persistCookHistoryEntry(recipeId, cookDurationSec, {
        scale: scaleValue,
        rating: ratingValue ?? undefined,
        note: note ?? undefined,
        recipeCookHistoryId: savedId,
      });

      setHistorySaved(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try {
        track(AnalyticsEvents.cook_history_saved, {
          recipeId,
          scale: scaleValue,
          rating: ratingValue,
          hasNote: Boolean(note),
          durationSec: cookDurationSec,
        });
      } catch {
        /* analytics fire-and-forget */
      }
      showToast(
        ratingValue != null && note
          ? `Saved · ${ratingValue} star${ratingValue === 1 ? "" : "s"}`
          : "Saved this cook",
      );
    } catch (err) {
      console.warn("Cook history save failed", err);
      Alert.alert(
        "Could not save",
        "Your rating + note are stored locally. Try again when you're back online.",
      );
      // Best-effort local write so the user's note isn't blackholed.
      try {
        await persistCookHistoryEntry(recipeId, cookDurationSec, {
          scale: scaleValue,
          rating: ratingValue ?? undefined,
          note: note ?? undefined,
        });
      } catch {
        /* fail closed */
      }
    } finally {
      setSavingHistory(false);
    }
  }, [
    recipeId,
    userId,
    historySaved,
    savingHistory,
    cookDurationSec,
    noteDraft,
    savedRating,
    scale,
  ]);

  const handleAddToRegulars = useCallback(async () => {
    if (!recipeId) return;
    if (addedToRegulars) return; // idempotent — disable button after first add
    try {
      // Use the hydrated userId when available, fall back to a fresh
      // read for the case where the auth tick hasn't landed yet.
      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const { data: authData } = await supabase.auth.getUser();
        resolvedUserId = authData?.user?.id ?? null;
      }
      if (!resolvedUserId) {
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
      // Macro fields are scaled by the active cook factor so "Add to
      // my regulars" at 2x stores the doubled portion. Fiber follows
      // the same scaling. We apply scale via a small inline multiply
      // (not the `scaledMacro` helper from portionMultiplier — that
      // helper clamps to multiplier semantics for plan totals; here
      // we want a direct factor multiply with rounding to whole
      // grams so the saved meal lines up with the displayed
      // ingredient amounts).
      const scaleMacro = (v: unknown): number =>
        Math.max(0, Math.round((Number(v) || 0) * scale));
      await createSavedMeal(supabase, resolvedUserId, {
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
            calories: scaleMacro(recipe.calories),
            protein: scaleMacro(recipe.protein),
            carbs: scaleMacro(recipe.carbs),
            fat: scaleMacro(recipe.fat),
            ...(recipe.fiber_g != null && Number.isFinite(Number(recipe.fiber_g))
              ? { fiber: scaleMacro(recipe.fiber_g) }
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
  }, [recipeId, title, addedToRegulars, userId, scale]);

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

    /** Recime parity (2026-04-30) — "Watch original" pill in the
     *  cook-screen header. Only rendered when `watchOriginalUrl` is
     *  set. Uses the primary-tinted ghost-pill pattern (matching the
     *  active scale pill / paywall accent strip) so it reads as a
     *  link, not a primary CTA. */
    watchOriginalPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: Accent.primary,
      backgroundColor: Accent.primary + "14",
    },
    watchOriginalText: {
      color: Accent.primary,
      fontSize: 12,
      fontWeight: "700",
    },

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

    /** Recipe-scale segmented control (Paprika parity, 2026-04-30).
     *  Sits above the step text so the user can adjust amounts without
     *  leaving cook mode. Each pill is one of `COOK_SCALE_PRESETS`. */
    scaleRow: {
      flexDirection: "row",
      alignSelf: "center",
      backgroundColor: colors.card,
      borderRadius: 999,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    scalePill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 999,
      minWidth: 44,
      alignItems: "center",
    },
    scalePillActive: {
      backgroundColor: Accent.primary,
    },
    scalePillText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    scalePillTextActive: {
      color: "#fff",
      fontWeight: "700",
    },
    scaleCaption: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.xs,
    },

    /** "Last time" card surfaced above the step text so the user
     *  walks into the cook session reminded of their last cook (timer,
     *  rating, note). Shown only when at least one row exists in
     *  `recipe_cook_history` for this (user, recipe). */
    lastTimeCard: {
      width: "100%",
      maxWidth: 380,
      alignSelf: "center",
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      marginHorizontal: Spacing.xl,
      marginTop: Spacing.md,
      gap: 4,
    },
    lastTimeLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: colors.textTertiary,
      textTransform: "uppercase",
    },
    lastTimePreview: {
      fontSize: 13,
      color: colors.text,
      fontWeight: "500",
      lineHeight: 18,
    },
    lastTimeMore: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 2,
    },

    /** Per-cook notes input on the completion card. Auto-grows up to
     *  ~5 lines via `multiline` + min/max heights; the 500-char cap is
     *  enforced via `maxLength`. */
    noteInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
      minHeight: 64,
      textAlignVertical: "top",
    },
    noteCounter: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "right",
    },
    saveBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 12,
      borderRadius: Radius.md,
      backgroundColor: Accent.primary,
    },
    saveBtnDisabled: {
      opacity: 0.5,
    },
    saveBtnDone: {
      backgroundColor: Accent.success,
    },
    saveBtnText: {
      color: "#fff",
      fontSize: 14,
      fontWeight: "700",
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

    // Voice handsfree toggle (Paprika parity, 2026-05-01). The mic
    // sits in the right slot of the header where the layout
    // previously held a 40-width spacer balancing the Exit button.
    // Hit area matches the spacer width so the counter stays
    // visually centred whether the toggle is on or off.
    micToggle: {
      width: 40,
      height: 32,
      borderRadius: Radius.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    // Subtle muted tint when off — present so users know it's
    // tappable, not so loud that it competes with the step text.
    micToggleOff: { backgroundColor: colors.card },
    // Accent tint when on so the active state is unmistakable
    // even from across the kitchen.
    micToggleOn: { backgroundColor: Accent.primary + "22" },
    handsfreeBanner: {
      marginHorizontal: Spacing.xl,
      marginTop: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.sm,
      backgroundColor: Accent.primary + "10",
      borderWidth: 1,
      borderColor: Accent.primary + "30",
    },
    handsfreeBannerText: {
      color: colors.text,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "600",
    },
    handsfreeBannerSub: {
      color: colors.textSecondary,
      fontSize: 11,
      lineHeight: 15,
      marginTop: 2,
    },
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
        {/* Right slot: Watch Original (when available) + voice
            handsfree toggle. Recime parity (2026-04-30) for watch-
            original; Paprika parity (2026-05-01) for the mic toggle.
            The mic toggle is gated behind `COOK_HANDSFREE_FEATURE_ENABLED`
            so the v1 shell ships dark — the audio capture + state
            code stays in this file but is unreachable until the flag
            flips (journey-architect P1). */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {watchOriginalUrl ? (
            <Pressable
              onPress={onWatchOriginalPress}
              accessibilityRole="link"
              accessibilityLabel="Watch original video"
              testID="cook-watch-original"
              hitSlop={6}
              style={styles.watchOriginalPill}
            >
              <Play size={14} color={Accent.primary} />
              <Text style={styles.watchOriginalText}>Watch original</Text>
            </Pressable>
          ) : null}
          {COOK_HANDSFREE_FEATURE_ENABLED ? (
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: handsfreeOn }}
              accessibilityLabel={
                handsfreeOn ? "Voice handsfree on" : "Voice handsfree off"
              }
              testID="cook-handsfree-toggle"
              onPress={handleHandsfreeToggle}
              hitSlop={8}
              style={[
                styles.micToggle,
                handsfreeOn ? styles.micToggleOn : styles.micToggleOff,
              ]}
            >
              {handsfreeOn ? (
                <Mic size={18} color={Accent.primary} strokeWidth={2} />
              ) : (
                <MicOff size={18} color={colors.textSecondary} strokeWidth={2} />
              )}
            </Pressable>
          ) : (
            // Spacer keeps the centered step counter centred when
            // the toggle is hidden behind the feature flag.
            <View
              style={{ width: 40, height: 32 }}
              testID="cook-handsfree-toggle-placeholder"
            />
          )}
        </View>
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

      {/* Voice handsfree banner — only renders when the toggle is ON.
          v1 transparency: tells the user voice listening isn't live
          yet, but the screen-stays-on bit IS. Better to ship honest
          copy than to fake a pulsing mic the listener can't fulfil
          (CLAUDE.md: never fake-implement). v2 swap-in: replace the
          banner with a "Listening — say next, repeat, pause…" hint
          + a real pulse on the mic icon when the listener is active. */}
      {handsfreeOn && (
        <View
          style={styles.handsfreeBanner}
          accessibilityLiveRegion="polite"
          testID="cook-handsfree-banner"
        >
          <Text style={styles.handsfreeBannerText}>
            Screen stays awake while you cook.
          </Text>
          <Text style={styles.handsfreeBannerSub}>
            Voice control (say &quot;next&quot;, &quot;back&quot;, &quot;repeat&quot;) is coming soon. We don&apos;t record audio yet.
          </Text>
        </View>
      )}

      {/* "Last time" preview card — only when we have prior cook history.
          Renders above the active step so the user walks in reminded of
          how the previous cook went (Paprika parity, 2026-04-30). The
          first row gets the rich preview; the count of older rows is
          surfaced as a small subline. */}
      {!isDone && recentHistory.length > 0 && (
        <View style={styles.lastTimeCard}>
          <Text style={styles.lastTimeLabel}>Last time</Text>
          <Text style={styles.lastTimePreview}>
            {formatCookHistoryPreview(recentHistory[0]!)}
          </Text>
          {recentHistory.length > 1 && (
            <Text style={styles.lastTimeMore}>
              {recentHistory.length === 2
                ? "1 earlier cook on file."
                : `${recentHistory.length - 1} earlier cooks on file.`}
            </Text>
          )}
        </View>
      )}

      {!isDone ? (
        <View style={styles.stepContainer}>
          {/* Step number */}
          <View style={styles.stepNumber}>
            <Text style={styles.stepNumberText}>{current + 1}</Text>
          </View>

          {/* Recipe scale segmented control (Paprika parity, 2026-04-30).
              Tap a preset to rewrite the visible amounts in the step
              text. Persisted per (userId, recipeId). The caption below
              the control reads "Original recipe" at 1x, otherwise
              "Scaled Nx". */}
          <View style={{ alignItems: "center", gap: Spacing.xs }}>
            <View
              style={styles.scaleRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Recipe scale"
            >
              {COOK_SCALE_PRESETS.map((preset) => {
                const active = Math.abs(scale - preset) < 1e-6;
                return (
                  <Pressable
                    key={preset}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Scale ${formatCookScaleLabel(preset)}`}
                    onPress={() => handleScaleChange(preset)}
                    style={[
                      styles.scalePill,
                      active && styles.scalePillActive,
                    ]}
                    hitSlop={4}
                  >
                    <Text
                      style={[
                        styles.scalePillText,
                        active && styles.scalePillTextActive,
                      ]}
                    >
                      {formatCookScaleLabel(preset)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.scaleCaption}>
              {/* Round 4 user-sentiment audit (2026-04-30): pass
                  baseServings so the caption reads "Scaled to N
                  servings" (or "Serves 1" / "Serves N" for the
                  unscaled case via the helper's "Original recipe"
                  fallback — see scaleCaption test). */}
              {cookScaleCaption(scale, baseServings)}
            </Text>
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
           captured cook duration, 1-tap star rating (now persisted via
           recipe_cook_history — Paprika parity), and "Add to my regulars"
           which writes the recipe straight into the user's
           `user_saved_meals` so they can re-log it from the Quick Add
           panel without retyping. The two existing buttons (Log this
           meal / Skip) stay below so we don't break P2-24. Wrapped in a
           ScrollView 2026-04-30 so the completion card remains usable
           on small devices once the per-cook notes input lands — the
           card overflowed on iPhone SE without it. */
        <ScrollView
          contentContainerStyle={styles.centered}
          keyboardShouldPersistTaps="handled"
        >
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

            {/* Per-cook notes input (Paprika parity, 2026-04-30). Free-
                form, optional, capped at COOK_NOTE_MAX_LEN by the
                input + clamp. The placeholder phrasing intentionally
                hints at the Paprika behaviour ("added more garlic,
                cooked 5 min less"). The counter only shows once the
                user is past 80% of the cap so it doesn't clutter the
                empty state. */}
            <TextInput
              accessibilityLabel="Notes for next time"
              placeholder="Notes for next time (optional)"
              placeholderTextColor={colors.textTertiary}
              value={noteDraft}
              onChangeText={setNoteDraft}
              multiline
              maxLength={COOK_NOTE_MAX_LEN}
              editable={!historySaved}
              style={styles.noteInput}
            />
            {noteDraft.length > Math.floor(COOK_NOTE_MAX_LEN * 0.8) && (
              <Text style={styles.noteCounter}>
                {noteDraft.length}/{COOK_NOTE_MAX_LEN}
              </Text>
            )}

            {/* Save — writes one row to recipe_cook_history with the
                duration, scale, rating, and note. Idempotent. Locally
                cached when the network write fails so the user's note
                is never lost. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={historySaved ? "Saved this cook" : "Save this cook"}
              onPress={() => void handleSaveHistory()}
              disabled={historySaved || savingHistory}
              style={[
                styles.saveBtn,
                (historySaved || savingHistory) && styles.saveBtnDisabled,
                historySaved && styles.saveBtnDone,
              ]}
            >
              {historySaved && (
                <CheckCircle2 size={16} color="#fff" strokeWidth={2.25} />
              )}
              <Text style={styles.saveBtnText}>
                {historySaved
                  ? "Saved"
                  : savingHistory
                    ? "Saving…"
                    : "Save this cook"}
              </Text>
            </Pressable>

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
                // Pass the active cook scale through so the recipe
                // page's autoLog flow scales the journal entry by the
                // same factor — matches the "Add to my regulars" path
                // above. The recipe page already reads `portion` and
                // multiplies macros by it; passing 1 is a no-op.
                const scaleQuery = scale !== 1 ? `&portion=${scale}` : "";
                router.replace(
                  `/recipe/${recipeId}?autoLog=1${scaleQuery}` as never,
                );
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
              {savedRating != null || addedToRegulars || historySaved
                ? "Done"
                : "Skip — back to recipe"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
