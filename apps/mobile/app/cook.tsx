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
import { useHaptics } from "@/hooks/useHaptics";
import { showSignInAlert } from "@/lib/authAlertCopy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Mic,
  MicOff,
  Play,
  Star,
  Timer as TimerIcon,
  CheckCircle2,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import { Accent, Spacing, Radius, FontFamily, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { SupprButton } from "@/components/ui/SupprButton";
import { CookLogServingsSheet } from "@/components/cook/CookLogServingsSheet";
import { CookStepPageIndicator } from "@/components/cook/CookStepPageIndicator";
import { CookStepSwipeSurface } from "@/components/cook/CookStepSwipeSurface";
import { CookMiseEnPlace } from "@/components/cook/CookMiseEnPlace";
import { useCookIngredientPanelUi } from "@/hooks/useCookIngredientPanelUi";
import { CookHandsfreeBanner } from "@/components/cook/CookHandsfreeBanner";
import { CookRunningTimerStrip } from "@/components/cook/CookRunningTimerStrip";
import { CookStepTimerPills } from "@/components/cook/CookStepTimerPills";
import { useCookRunningTimers } from "@/hooks/useCookRunningTimers";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import {
  parseTimersInStep,
  formatTimer as formatTimerShared,
  type ParsedTimer,
} from "@suppr/nutrition-core/recipeTimers";
import { createSavedMeal } from "@suppr/nutrition-core/savedMeals";
import {
  COOK_SCALE_PRESETS,
  clampCookScale,
  cookScaleCaption,
  cookScaleStorageKey,
  formatCookScaleLabel,
  scaleAmountText,
} from "@suppr/nutrition-core/recipeScale";
import {
  cookStepIngredientChips,
  type StepMatchableIngredient,
} from "@suppr/shared/recipe-ingredients/stepIngredients";
import { formatIngredientAmountUnit } from "@suppr/shared/recipe-ingredients/formatIngredientAmount";
import {
  formatCookHistoryPreview,
  insertCookHistory,
  listRecentCookHistory,
  type CookHistoryRow,
} from "@suppr/nutrition-core/recipeCookHistoryClient";
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
import { extractVideoHost } from "@suppr/shared/recipes/heroImageFallback";
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
  const haptics = useHaptics(), colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the step-progress
  // rail, active step, primary "Next/Done" CTAs, and timer chips. Threaded
  // into the memoised StyleSheet via the dep array below. Completion/"Cooked
  // it" keeps `Accent.success`; cautions keep warning/destructive.
  const accent = useAccent();
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
    portion: portionParam,
    // ENG-944 — the recipe's structured ingredients, threaded in as a
    // JSON array of `{ name, amount, unit }` so the "For this step" chip
    // matcher has data to work with. Optional + fail-safe parsed: an
    // absent / malformed param simply yields no chips (the feature is
    // also flag-gated). A caller serialises only the three fields the
    // matcher needs — no macros / PII in the deep link.
    //
    // ENG-945 — canonical cook surface; all entry points route here via
    // `buildCookModeHref` (recipe detail footer, batch-cook `?cook=1`, deep links).
    ingredients: ingredientsJson,
  } = useLocalSearchParams<{
    recipeId: string;
    title: string;
    steps: string;
    sourceVideoUrl?: string;
    sourceUrl?: string;
    servings?: string;
    portion?: string;
    ingredients?: string;
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

  // ENG-944 — structured ingredients threaded via the `ingredients` route
  // param. Same fail-safe parse shape as `steps`: an absent / malformed /
  // non-array param yields []. Only rows with a usable `name` are kept;
  // `amount` / `unit` are normalised to the matcher's shape. The "For this
  // step" chips are also flag-gated below, so a stale client that never
  // passes this param simply shows no chips.
  const stepIngredients: StepMatchableIngredient[] = useMemo(() => {
    if (!ingredientsJson) return [];
    try {
      const parsed = JSON.parse(ingredientsJson);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(
          (r): r is { name: unknown; amount?: unknown; unit?: unknown } =>
            r != null && typeof r === "object",
        )
        .map((r) => ({
          name: typeof r.name === "string" ? r.name : "",
          amount:
            typeof r.amount === "string" || typeof r.amount === "number"
              ? r.amount
              : null,
          unit: typeof r.unit === "string" ? r.unit : null,
        }))
        .filter((r) => r.name.trim().length > 0);
    } catch {
      return [];
    }
  }, [ingredientsJson]);

  const stepIngredientsEnabled = isFeatureEnabled("cook_step_ingredients_v1");
  /** ENG-947 — horizontal swipe + quiet segment indicator. Default-OFF
   *  so cook mode stays byte-identical until ramped. */
  const cookSwipeStepsEnabled = isFeatureEnabled("cook_swipe_steps_v1");
  /** ENG-946 — tap-to-check ingredient checklist + optional mise en place.
   *  Default-OFF for byte-identical revert. */
  const cookIngredientChecklistEnabled = isFeatureEnabled("cook_ingredient_checklist_v1");
  /** ENG-948 — one pill per parsed duration + concurrent countdown stack.
   *  Default-OFF; flag-off keeps the single suggested-timer pill. */
  const cookMultiTimersEnabled = isFeatureEnabled("cook_multi_timers_v1");
  const [cookPhase, setCookPhase] = useState<"mise" | "steps">("steps");

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
  const [logServingsOpen, setLogServingsOpen] = useState(false);
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

  /** ENG-944 — "For this step" chips for the current step. Pure matcher
   *  against the threaded structured ingredients; amounts scaled by the
   *  active `scale`. Gated behind `cook_step_ingredients_v1` (default-OFF)
   *  AND empty when no ingredients were threaded in — both yield []. The
   *  match is run on the RAW step text (pre-scale) so token matching is
   *  stable across scale changes. Web parity: `CookMode.tsx`. */
  const stepChips = useMemo(
    () =>
      cookStepIngredientChips(
        stepIngredientsEnabled,
        rawStepText,
        stepIngredients,
        scale,
      ),
    [stepIngredientsEnabled, stepIngredients, rawStepText, scale],
  );

  /** ENG-946 — checklist rows for mise en place (scaled amounts). */
  const checklistItems = useMemo(
    () =>
      stepIngredients.map((ing) => {
        const numericAmount =
          typeof ing.amount === "number"
            ? ing.amount
            : typeof ing.amount === "string"
              ? Number.parseFloat(ing.amount)
              : NaN;
        const scaledAmount =
          Number.isFinite(numericAmount) && scale !== 1
            ? Math.round(numericAmount * scale * 100) / 100
            : ing.amount;
        const amountLabel =
          scaledAmount != null || ing.unit
            ? formatIngredientAmountUnit(scaledAmount, ing.unit)
            : null;
        return { name: ing.name, amountLabel };
      }),
    [stepIngredients, scale],
  );

  const ingredientPanel = useCookIngredientPanelUi({
    checklistEnabled: cookIngredientChecklistEnabled,
    checklistItems,
    cookPhase,
    isDone,
    scale,
    baseServings,
    recipeId: recipeId ?? "",
    accentInk: accent.primarySolid,
    handsfreeVisible: COOK_HANDSFREE_FEATURE_ENABLED,
    onMiseBootstrap: setCookPhase,
    recipeIdForMise: recipeId,
  });

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
  const {
    runningTimers,
    startParsedTimer,
    cancelTimer: cancelRunningTimer,
    resetTimer: resetRunningTimer,
  } = useCookRunningTimers(recipeId ?? "", cookMultiTimersEnabled);
  const activeStepTimerCount = runningTimers.filter(
    (timer) => timer.stepIndex === current && !timer.done,
  ).length;
  /** True only when there's a suggested timer AND the user hasn't
   *  started any timer for this step yet — drives the pulse animation. */
  const showSuggestedPill = cookMultiTimersEnabled
    ? parsedTimers.length > 0 && activeStepTimerCount === 0 && !timerActive
    : suggestedTimer != null && !timerActive && timerDurationSec === 0;

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

  /** ENG-1129 — cook-mode auto-log: optional servings-eaten confirm → logServings param. */
  const navigateAutoLog = useCallback(
    (servingsEaten?: number) => {
      if (!recipeId) {
        router.back();
        return;
      }
      if (
        isFeatureEnabled("cook_log_servings_confirm") &&
        servingsEaten != null &&
        Number.isFinite(servingsEaten) &&
        servingsEaten > 0
      ) {
        track(AnalyticsEvents.cook_mode_log_tapped, {
          recipeId,
          batchScale: scale,
          servingsLogged: servingsEaten,
        });
        router.replace(
          `/recipe/${recipeId}?autoLog=1&logServings=${encodeURIComponent(String(servingsEaten))}` as never,
        );
        return;
      }
      track(AnalyticsEvents.cook_mode_log_tapped, { recipeId, batchScale: scale });
      const scaleQuery = scale !== 1 ? `&portion=${scale}` : "";
      router.replace(`/recipe/${recipeId}?autoLog=1${scaleQuery}` as never);
    },
    [recipeId, router, scale],
  );

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
   *  A deep-link `portion` wins over storage so batch-cook / planner
   *  handoffs open at the intended multiplier. Storage-only otherwise;
   *  falls back to 1 when the key is missing / malformed. */
  useEffect(() => {
    if (!recipeId) return;
    const fromUrl =
      typeof portionParam === "string" && portionParam.trim()
        ? Number.parseFloat(portionParam)
        : NaN;
    if (Number.isFinite(fromUrl) && fromUrl > 0) {
      setScale(clampCookScale(fromUrl));
      return;
    }
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
  }, [recipeId, userId, portionParam]);

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
      haptics.select();
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
    haptics.success();
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
            if (current < totalSteps) setStepIndex(current + 1, "timer");
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
    haptics.success();
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

  const setStepIndex = useCallback(
    (nextIndex: number, via: "button" | "swipe" | "timer") => {
      if (!cookMultiTimersEnabled) {
        stopTimer();
      } else if (timerActive) {
        stopTimer();
      }
      if (nextIndex < 0 || nextIndex > totalSteps || nextIndex === current) {
        return;
      }
      haptics.select();
      if (via === "swipe") {
        track(AnalyticsEvents.cook_step_swiped, {
          direction: nextIndex > current ? "next" : "prev",
          platform: "ios",
        });
      }
      setCurrent(nextIndex);
    },
    [cookMultiTimersEnabled, current, totalSteps, recipeId],
  );

  const goNext = () => {
    if (current < totalSteps) {
      setStepIndex(current + 1, "button");
    }
  };

  const goPrev = () => {
    if (current > 0) {
      setStepIndex(current - 1, "button");
    }
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
      haptics.select();
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
      haptics.success();
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
      // Use the hydrated userId when available, fall back to a fresh read for the case where the auth tick hasn't landed yet.
      let resolvedUserId = userId;
      if (!resolvedUserId) {
        const { data: authData } = await supabase.auth.getUser();
        resolvedUserId = authData?.user?.id ?? null;
      }
      if (!resolvedUserId) {
        showSignInAlert("save this recipe as a regular");
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
      haptics.success();
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

  const cookV3 = isFeatureEnabled("recipe_detail_v3_conformance");

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: cookV3 ? Accent.primaryDeep : colors.background },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md, padding: Spacing.xxl },
    errorText: { color: colors.text, fontSize: 16 },
    emptyHeading: { color: colors.text, fontSize: 20, fontWeight: "700", textAlign: "center" },
    emptySub: { color: colors.textSecondary, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 320 },

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
    headerExit: { color: cookV3 ? Accent.frostBright : colors.text, fontSize: 16, fontWeight: "600" },
    headerCounter: { color: cookV3 ? Accent.frost : colors.textSecondary, fontSize: 14, fontWeight: "500" },

    /** Recime parity (2026-04-30) — "Watch original" ghost pill in the
     *  cook-screen header. Only rendered when `watchOriginalUrl` is
     *  set. Layout-only override on `SupprButton variant="ghost"`: a
     *  compact header pill (tighter padding + gap than the primitive's
     *  full-width base) reading as a link, not a primary CTA. The ghost
     *  fill (transparent, no border) comes from the primitive. */
    watchOriginalPill: {
      gap: 4,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
    },
    watchOriginalText: {
      color: accent.primarySolid,
      fontFamily: Type.captionSmall.fontFamily,
      fontSize: Type.captionSmall.fontSize,
      lineHeight: Type.captionSmall.lineHeight,
      fontWeight: "700",
    },

    progressBar: {
      height: 3,
      backgroundColor: cookV3 ? "rgba(255,255,255,0.15)" : colors.border,
      width: "100%",
    },
    progressBarFilled: {
      height: 3,
      backgroundColor: cookV3 ? "#fff" : accent.primary,
    },

    stepContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
      gap: Spacing.lg,
      maxWidth: 520,
      alignSelf: "center",
      width: "100%",
    },

    stepText: {
      fontSize: cookV3 ? 38 : 24,
      fontWeight: cookV3 ? "500" : "600",
      fontFamily: cookV3 ? FontFamily.serifSemibold : undefined,
      color: cookV3 ? Accent.frostBright : colors.text,
      textAlign: "center",
      lineHeight: cookV3 ? 46 : 34,
      letterSpacing: cookV3 ? 0 : -0.3,
      maxWidth: cookV3 ? 280 : undefined,
      alignSelf: cookV3 ? "center" : undefined,
    },

    /** Recipe-scale segmented control (Paprika parity, 2026-04-30).
     *  Sits above the step text so the user can adjust amounts without
     *  leaving cook mode. Each pill is one of `COOK_SCALE_PRESETS`. */
    scaleRow: {
      flexDirection: "row",
      alignSelf: "center",
      backgroundColor: colors.card,
      borderRadius: Radius.full,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 4,
    },
    scalePill: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: Radius.full,
      minWidth: 44,
      alignItems: "center",
    },
    scalePillActive: {
      backgroundColor: accent.primary,
    },
    scalePillText: {
      fontSize: 13,
      fontWeight: "600",
      color: colors.textSecondary,
      fontVariant: ["tabular-nums"],
    },
    scalePillTextActive: {
      color: colors.primaryForeground,
      fontWeight: "700",
    },
    scaleCaption: {
      ...Type.captionSmall,
      color: colors.textSecondary,
      textAlign: "center",
      marginTop: Spacing.xs,
    },

    /** ENG-944 — "For this step" ingredient chips. The caption mirrors the
     *  `lastTimeLabel` uppercase-tracked treatment; chips are calm cream
     *  cards (`colors.card` + hairline border) with measured serif text —
     *  no loud accent fills. Centred to sit under the centred step text. */
    forStepBlock: {
      alignItems: "center",
      gap: Spacing.sm,
      maxWidth: 420,
      width: "100%",
    },
    forStepLabel: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.5,
      color: colors.textTertiary,
      textTransform: "uppercase",
    },
    forStepChips: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: Spacing.sm,
    },
    forStepChip: {
      paddingHorizontal: Spacing.dense,
      paddingVertical: 6,
      borderRadius: Radius.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    forStepChipText: {
      fontFamily: FontFamily.serifRegular,
      fontSize: 14,
      lineHeight: 18,
      color: colors.text,
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
      ...Type.captionSmall,
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
    // Layout-only override on `SupprButton variant="ghost"` — the icon +
    // stateful label share a 6px gap. Fill/radius/padding/press come from
    // the primitive; disabled (saved) + loading (saving) are props.
    saveBtn: {
      gap: 6,
    },
    saveBtnText: {
      color: accent.primarySolid,
      fontSize: 14,
      fontWeight: "700",
    },

    timerSection: { alignItems: "center", gap: Spacing.md },
    timerDisplay: {
      fontSize: 38,
      fontWeight: "700",
      color: accent.primarySolid,
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

    /** Parsed-duration pill — layout-only override on `SupprButton
     *  variant="ghost"`. Renders inside `timerSection` above the manual
     *  stopwatch button so the suggestion is the more prominent option
     *  when present. Icon + label share an 8px gap; the ghost fill
     *  (transparent, no border) comes from the primitive. */
    suggestedTimerPill: {
      gap: 8,
      paddingVertical: Spacing.sm,
    },
    suggestedTimerText: {
      color: accent.primarySolid,
      fontWeight: "700",
      fontSize: 14,
    },
    // Layout-only override on `SupprButton variant="ghost"` for the
    // manual-stopwatch link — tighter vertical padding than the
    // primitive base; transparent fill comes from the primitive.
    timerSecondaryBtn: {
      paddingVertical: 8,
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
    // Layout-only override on `SupprButton variant="ghost"` — icon +
    // stateful label share a 6px gap. Fill (transparent, no border) +
    // radius + padding + press come from the primitive; added/disabled
    // is a prop. The success-coloured label + check carry the "added"
    // affordance inside the ghost (no green fill).
    addRegularsBtn: {
      gap: 6,
    },
    addRegularsText: {
      color: accent.primarySolid,
      fontSize: 14,
      fontWeight: "600",
    },
    addRegularsTextDone: { color: Accent.success },
    priorCookLine: {
      ...Type.captionSmall,
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

    // Layout-only override on `SupprButton variant="primary"` (the done
    // state's ONE solid CTA) — just the top margin off the card. Solid
    // aubergine fill / radius / padding / press come from the primitive.
    doneBtn: {
      marginTop: Spacing.lg,
    },

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
    micToggleOn: { backgroundColor: accent.primary + "22" },
  }), [colors, accent, cookV3]);

  if (steps.length === 0) {
    // Audit 2026-05-04 #37: previously this state had no top app bar
    // and the back CTA was a narrow primary pill mid-screen. Add a
    // proper top bar (matching the active-cook header pattern) and
    // promote the CTA to button-lg full-width so the empty state
    // looks like a designed surface, not a prototype dropout.
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Exit cook mode">
            <Text style={styles.headerExit}>Exit</Text>
          </Pressable>
          <Text style={[styles.emptyHeading, { fontSize: 16, flex: 1, textAlign: "center" }]} numberOfLines={1}>
            Cook
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={[styles.centered, { paddingHorizontal: Spacing.xl }]}>
          <Text style={styles.emptyHeading}>No cook steps yet</Text>
          <Text style={styles.emptySub}>
            {
              "This recipe doesn't have step-by-step instructions. You can still log it from the recipe page."
            }
          </Text>
          <SupprButton
            variant="primary"
            style={{ alignSelf: "stretch", marginTop: Spacing.xl }}
            onPress={() => router.back()}
            accessibilityLabel="Back to recipe"
            label="Back to recipe"
          />
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
        <Text style={styles.headerCounter}>
          {cookPhase === "mise" ? "Gather ingredients" : `Step ${current + 1} of ${totalSteps}`}
        </Text>
        {/* Right slot: Watch Original (when available) + voice
            handsfree toggle. Recime parity (2026-04-30) for watch-
            original; Paprika parity (2026-05-01) for the mic toggle.
            The mic toggle is gated behind `COOK_HANDSFREE_FEATURE_ENABLED`
            so the v1 shell ships dark — the audio capture + state
            code stays in this file but is unreachable until the flag
            flips (journey-architect P1). */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          {watchOriginalUrl ? (
            <SupprButton
              variant="ghost"
              onPress={onWatchOriginalPress}
              accessibilityLabel="Watch original video"
              testID="cook-watch-original"
              haptic="selection"
              style={styles.watchOriginalPill}
            >
              <Play size={14} color={accent.primarySolid} />
              <Text style={styles.watchOriginalText}>Watch original</Text>
            </SupprButton>
          ) : null}
          {ingredientPanel.headerToggle}
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
                <Mic size={18} color={accent.primary} strokeWidth={2} />
              ) : (
                <MicOff size={18} color={colors.textSecondary} strokeWidth={2} />
              )}
            </Pressable>
          ) : (
            ingredientPanel.headerSpacer
          )}
        </View>
      </View>

      {cookMultiTimersEnabled ? (
        <CookRunningTimerStrip
          timers={runningTimers}
          onReset={resetRunningTimer}
          onCancel={cancelRunningTimer}
        />
      ) : null}

      {/* Progress — segment indicator when swipe flag is ON; legacy
          filled bar otherwise (byte-identical pre-ENG-947). */}
      {cookSwipeStepsEnabled ? (
        <View style={{ paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm }}>
          <CookStepPageIndicator
            currentIndex={Math.min(current, Math.max(totalSteps - 1, 0))}
            totalSteps={totalSteps}
          />
        </View>
      ) : (
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
      )}

      <CookHandsfreeBanner visible={handsfreeOn} />

      {/* "Last time" preview card — only when we have prior cook history.
          Renders above the active step so the user walks in reminded of
          how the previous cook went (Paprika parity, 2026-04-30). The
          first row gets the rich preview; the count of older rows is
          surfaced as a small subline. */}
      {!isDone && recentHistory.length > 0 && cookPhase === "steps" && (
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

      {cookPhase === "mise" ? (
        <CookMiseEnPlace
          recipeId={recipeId}
          recipeTitle={title}
          items={checklistItems}
          onContinueToSteps={() => setCookPhase("steps")}
        />
      ) : !isDone ? (
        <CookStepSwipeSurface
          enabled={cookSwipeStepsEnabled}
          stepIndex={current}
          stepCount={totalSteps}
          onBeforeStepChange={stopTimer}
          onStepIndexChange={(index) => setStepIndex(index, "swipe")}
        >
        <View style={styles.stepContainer}>
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

          {/* ENG-944 — "For this step" ingredient chips. Quiet uppercase
              tracked caption (mirrors the `lastTimeLabel` treatment) over
              calm serif amount+name chips — no loud accent fill. Renders
              nothing (no empty label) when the matcher finds no ingredient
              or the flag is OFF. */}
          {stepChips.length > 0 && (
            <View style={styles.forStepBlock} testID="cook-step-ingredients">
              <Text style={styles.forStepLabel}>For this step</Text>
              <View style={styles.forStepChips}>
                {stepChips.map((chip) => (
                  <View key={chip.key} style={styles.forStepChip}>
                    <Text style={styles.forStepChipText}>{chip.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Timer — suggested-duration pill(s) when the step text contains
              parseable durations; count-down when started; manual count-up
              stopwatch fallback otherwise. Multi-timer flag renders one pill
              per match + a concurrent heads-up strip (ENG-948). */}
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
            ) : cookMultiTimersEnabled ? (
              <>
                <CookStepTimerPills
                  timers={parsedTimers}
                  pulseFirst={showSuggestedPill}
                  pulseRef={pulseRef}
                  onStart={(timer) => startParsedTimer(timer, current)}
                />
                <SupprButton
                  variant="ghost"
                  style={styles.timerSecondaryBtn}
                  onPress={startTimer}
                  haptic="selection"
                  accessibilityLabel="Start stopwatch"
                  label={parsedTimers.length > 0 ? "Or start a stopwatch" : "Start stopwatch"}
                />
              </>
            ) : (
              <>
                {showSuggestedPill && suggestedTimer && (
                  <Animated.View style={{ transform: [{ scale: pulseRef }] }}>
                    <SupprButton
                      variant="ghost"
                      accessibilityLabel={`Set ${formatTimer(suggestedTimer.totalSeconds)} timer`}
                      onPress={() => startCountdown(suggestedTimer)}
                      haptic="selection"
                      style={styles.suggestedTimerPill}
                    >
                      <TimerIcon
                        size={16}
                        color={accent.primarySolid}
                        strokeWidth={2.25}
                      />
                      <Text style={styles.suggestedTimerText}>
                        Set {formatTimer(suggestedTimer.totalSeconds)} timer
                      </Text>
                    </SupprButton>
                  </Animated.View>
                )}
                <SupprButton
                  variant="ghost"
                  style={styles.timerSecondaryBtn}
                  onPress={startTimer}
                  haptic="selection"
                  accessibilityLabel="Start stopwatch"
                  label={showSuggestedPill ? "Or start a stopwatch" : "Start stopwatch"}
                />
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
            <SupprButton
              variant="primary"
              style={{ flex: 1 }}
              onPress={goNext}
              accessibilityLabel={current === totalSteps - 1 ? "Done!" : "Next Step"}
              label={current === totalSteps - 1 ? "Done!" : "Next Step"}
            />
          </View>
        </View>
        </CookStepSwipeSurface>
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
            <SupprButton
              variant="ghost"
              accessibilityLabel={historySaved ? "Saved this cook" : "Save this cook"}
              onPress={() => void handleSaveHistory()}
              disabled={historySaved}
              loading={savingHistory}
              haptic="success"
              style={styles.saveBtn}
            >
              {historySaved && (
                <CheckCircle2 size={16} color={Accent.success} strokeWidth={2.25} />
              )}
              <Text style={styles.saveBtnText}>
                {/* DC12 (2026-05-14, premium-bar audit) — specific
                    confirmation. Mirrors the "Save this cook" verb
                    in the affirmed state so the user reads the
                    same noun back. */}
                {historySaved
                  ? "Cook saved"
                  : savingHistory
                    ? "Saving…"
                    : "Save this cook"}
              </Text>
            </SupprButton>

            {/* Add to my regulars — writes a saved meal so the user can
                one-tap re-log this recipe from Quick Add tomorrow. */}
            <SupprButton
              variant="ghost"
              accessibilityLabel={
                addedToRegulars
                  ? "Already added to your regulars"
                  : "Add to my regulars"
              }
              onPress={() => void handleAddToRegulars()}
              disabled={addedToRegulars}
              haptic="success"
              style={styles.addRegularsBtn}
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
            </SupprButton>
          </View>

          {/* P2-24 (2026-04-25): Log this meal — closes the loop from cook
              back to the journal. Replace the route with the recipe detail
              + an `autoLog=1` query param; the recipe page already owns
              the journal-write logic with the coercion guard (P0-3) so we
              don't fork the write path. */}
          <SupprButton
            variant="primary"
            style={styles.doneBtn}
            onPress={() => {
              if (isFeatureEnabled("cook_log_servings_confirm")) {
                setLogServingsOpen(true);
                return;
              }
              navigateAutoLog();
            }}
            label="Log this meal"
          />
          <SupprButton
            variant="ghost"
            style={{ marginTop: Spacing.sm }}
            onPress={() => router.back()}
            haptic="selection"
            label={
              savedRating != null || addedToRegulars || historySaved
                ? "Done"
                : "Skip — back to recipe"
            }
          />
        </ScrollView>
      )}
      {ingredientPanel.sheet}
      <CookLogServingsSheet
        visible={logServingsOpen}
        batchScale={scale}
        baseServings={baseServings}
        onClose={() => setLogServingsOpen(false)}
        onConfirm={(servingsEaten) => {
          setLogServingsOpen(false);
          navigateAutoLog(servingsEaten);
        }}
      />
    </View>
  );
}
