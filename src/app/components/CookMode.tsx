"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./ui/icons";
import { ListChecks, Play } from "lucide-react";
import { toast } from "sonner";
import type { IngredientRow, RecipeCard } from "../../types/recipe.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";
import {
  parseTimersInStep,
  formatTimer,
  type ParsedTimer,
} from "../../lib/nutrition/recipeTimers.ts";
import {
  COOK_SCALE_PRESETS,
  clampCookScale,
  cookScaleCaption,
  cookScaleStorageKey,
  formatCookScaleLabel,
} from "../../lib/nutrition/recipeScale.ts";
import { scaleStepText } from "../../lib/nutrition/scaleStepText.ts";
import {
  COOK_HISTORY_NOTE_MAX_LEN,
  formatCookHistoryPreview,
  insertCookHistory,
  listRecentCookHistory,
  type CookHistoryRow,
} from "../../lib/nutrition/recipeCookHistoryClient.ts";
import { extractVideoHost } from "../../lib/recipes/heroImageFallback.ts";
import { supabase } from "../../lib/supabase/browserClient.ts";
import {
  fallbackSlotFromTimeOfDay,
  journalSlotFromMealTypes,
} from "../../lib/nutrition/recipeJournalSlot.ts";

interface CookModeProps {
  recipe: RecipeCard;
  instructionSteps: string[];
  ingredients: IngredientRow[];
  /**
   * The user's scaled-to serving count (the value of the servings
   * stepper on the recipe page). Drives the calorie multiplier on
   * "Log this meal" and the step-text scaling. **NOT** the recipe's
   * original yield — that's `baseServings`.
   */
  servings: number;
  /**
   * The recipe's original yield (`recipe.servings`). Required so
   * CookMode can compute `scaleFactor = servings / baseServings`
   * for the step-text quantities. Defaults to `recipe.servings` for
   * call sites that haven't been updated yet, but new call sites
   * should pass it explicitly.
   */
  baseServings?: number;
  onExit: () => void;
  /** Navigate to the nutrition tracker after logging a meal. */
  onViewTracker?: () => void;
}

/** Strip leading step numbers like "1. " or "Step 1: " */
function cleanStepText(text: string): string {
  return text.replace(/^\s*(?:step\s*)?\d+[\.\)\:\-]\s*/i, "").trim();
}

type RunningTimer = {
  id: string;
  stepIndex: number;
  label: string;
  totalSeconds: number;
  /** Server-tick-based remainder so the timer doesn't drift on visibility change. */
  endsAtMs: number;
  /** Derived each tick — held in state so the badge strip re-renders. */
  remainingSeconds: number;
  done: boolean;
};

/**
 * Emit a short chime when a timer completes. Uses a no-asset
 * `AudioContext` tone so it works without bundling a sound file.
 * Guarded behind user-initiated interaction (the timer start click
 * satisfies the browser autoplay policy).
 */
function playChime() {
  if (typeof window === "undefined") return;
  const AC = (window.AudioContext || (window as any).webkitAudioContext) as
    | typeof AudioContext
    | undefined;
  if (!AC) return;
  try {
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.001;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    // Quick envelope: ramp up, beep for ~200ms, ramp down.
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    osc.start(now);
    osc.stop(now + 0.45);
    osc.onended = () => {
      try {
        ctx.close();
      } catch {
        /* no-op */
      }
    };
  } catch {
    // Audio not allowed — fall through to the toast alert.
  }
}

export function CookMode({ recipe, instructionSteps, ingredients, servings, baseServings, onExit, onViewTracker }: CookModeProps) {
  const { addLoggedMeal, userId } = useAppData();
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [runningTimers, setRunningTimers] = useState<RunningTimer[]>([]);
  const [logged, setLogged] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timerTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedTimerIdsRef = useRef<Set<string>>(new Set());

  /** Active scale factor (Paprika parity, 2026-04-30). 0.5 / 1 / 1.5 /
   *  2 / 4. Persisted per (userId, recipeId) to localStorage so
   *  reopening the same recipe in cook mode remembers the last scale.
   *  Initialised optimistically to 1; the hydration effect upgrades it
   *  once we've read storage. */
  const [scale, setScale] = useState<number>(1);
  /** Free-text per-cook note, capped at COOK_HISTORY_NOTE_MAX_LEN. */
  const [noteDraft, setNoteDraft] = useState<string>("");
  /** Last 3 cook-history rows surfaced as a "Last time" preview. */
  const [recentHistory, setRecentHistory] = useState<CookHistoryRow[]>([]);
  /** 1..5 personal rating for THIS cook. Persisted on Save. */
  const [rating, setRating] = useState<number | null>(null);
  const [savingHistory, setSavingHistory] = useState(false);
  const [historySaved, setHistorySaved] = useState(false);

  const totalSteps = instructionSteps.length;
  const isLastStep = currentStep >= totalSteps - 1;
  const isDone = currentStep >= totalSteps;

  // Servings handoff (P0, 2026-05-01) — `servings` is the user's
  // scaled-to value (set via the recipe-page stepper); `baseServings`
  // is the recipe's original yield. The step text gets multiplied by
  // `scaleFactor = (servings / baseServings) × paprikaScale`. The
  // `paprikaScale` (0.5 / 1 / 1.5 / 2 / 4 segmented control below)
  // composes on top so a user who scaled the recipe page to 8 servings
  // and then taps the cook-mode 0.5x preset cooks for 4. Falls back
  // to `recipe.servings` when no explicit `baseServings` is passed
  // (older call sites).
  const effectiveBaseServings = Math.max(
    1,
    baseServings ?? (recipe.servings > 0 ? recipe.servings : 1),
  );
  const scaleFactor = (Number.isFinite(servings) && servings > 0
    ? servings / effectiveBaseServings
    : 1) * scale;

  const currentStepRaw = currentStep < totalSteps ? instructionSteps[currentStep]! : "";
  const currentStepCleaned = useMemo(
    () => cleanStepText(currentStepRaw),
    [currentStepRaw],
  );
  /** Visible step text with amounts rewritten by the active scale.
   *  `scaleStepText` is shared with mobile so both platforms agree on
   *  what counts as a scalable token (cooking units + count nouns)
   *  vs. what stays untouched (time / temp / step-number prefixes). */
  const currentStepText = useMemo(
    () => scaleStepText(cleanStepText(currentStepRaw), scaleFactor),
    [currentStepRaw, scaleFactor],
  );

  /** Parse timers from the RAW cleaned step text, NOT the scaled
   *  version — scaling is amount-only and never touches durations,
   *  but indexing the timer pills against the unchanged string keeps
   *  offsets stable as the user toggles scale. */
  const stepTimers: ParsedTimer[] = useMemo(
    () => parseTimersInStep(currentStepCleaned),
    [currentStepCleaned],
  );

  /** Hydrate the persisted scale factor for this (userId, recipeId).
   *  localStorage on web; falls back to 1 silently. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const key = cookScaleStorageKey(userId, String(recipe.id));
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const parsed = Number.parseFloat(raw);
      const clamped = clampCookScale(parsed);
      if (clamped !== 1) setScale(clamped);
    } catch {
      /* localStorage unavailable / quota — leave scale at 1 */
    }
  }, [recipe.id, userId]);

  /** Hydrate the latest 3 cook-history rows for the "Last time" card.
   *  Skipped when not signed in. Network read; failures fall back
   *  silently. */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await listRecentCookHistory(supabase, userId, String(recipe.id), 3);
        if (!cancelled) setRecentHistory(rows);
      } catch {
        /* network / RLS flaky — fail closed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [recipe.id, userId]);

  /** Persist a freshly-picked scale to localStorage. Fire-and-forget;
   *  storage failures don't block the user. */
  const persistScale = useCallback(
    (next: number) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(
          cookScaleStorageKey(userId, String(recipe.id)),
          String(next),
        );
      } catch {
        /* storage flaky — fail closed */
      }
    },
    [recipe.id, userId],
  );

  const handleScaleChange = useCallback(
    (next: number) => {
      const clamped = clampCookScale(next);
      if (clamped === scale) return;
      setScale(clamped);
      persistScale(clamped);
      try {
        track(AnalyticsEvents.recipe_scale_changed, {
          recipeId: recipe.id,
          scale: clamped,
        });
      } catch {
        /* analytics fire-and-forget */
      }
    },
    [scale, persistScale, recipe.id],
  );

  /** Capture the moment the user landed in cook mode so the completion
   *  card can show "Took you Nm SSs". Set once per mount via the ref
   *  init; never resets on step navigation. */
  const sessionStartRef = useRef<number>(Date.now());
  /** Captured cook duration in seconds, set when the user reaches the
   *  done state. Null until then. */
  const [cookDurationSec, setCookDurationSec] = useState<number | null>(null);

  // Track cook mode open — includes step count so analytics can see
  // how deep the recipes users cook are.
  useEffect(() => {
    track(AnalyticsEvents.cook_mode_opened, {
      recipeId: recipe.id,
      stepCount: totalSteps,
    });
    track(AnalyticsEvents.cook_mode_first_step_advanced, { recipeTitle: recipe.title, steps: totalSteps });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wake Lock with visibility-change re-acquire.
  useEffect(() => {
    let active = true;

    const acquire = async () => {
      if (typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (!active) {
          try { await lock.release(); } catch { /* noop */ }
          return;
        }
        wakeLockRef.current = lock;
        // Browser may release on its own (e.g. low battery) — noop on release.
        lock.addEventListener("release", () => {
          if (wakeLockRef.current === lock) wakeLockRef.current = null;
        });
      } catch {
        // Not supported, denied, or out of budget — silent no-op.
      }
    };

    const onVisibilityChange = () => {
      if (!active) return;
      if (document.visibilityState === "visible" && wakeLockRef.current == null) {
        void acquire();
      }
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      if (lock) {
        try { void lock.release(); } catch { /* noop */ }
      }
    };
  }, []);

  // Single global tick drives every running timer — no leaks even if a
  // step with three timers is left behind by step navigation.
  useEffect(() => {
    if (runningTimers.length === 0) {
      if (timerTickRef.current) {
        clearInterval(timerTickRef.current);
        timerTickRef.current = null;
      }
      return;
    }
    if (timerTickRef.current) return; // already ticking
    timerTickRef.current = setInterval(() => {
      setRunningTimers((prev) => {
        const now = Date.now();
        let anyChanged = false;
        const next = prev.map((t) => {
          if (t.done) return t;
          const remaining = Math.max(0, Math.ceil((t.endsAtMs - now) / 1000));
          if (remaining === t.remainingSeconds && !t.done) return t;
          anyChanged = true;
          const done = remaining <= 0;
          if (done && !firedTimerIdsRef.current.has(t.id)) {
            firedTimerIdsRef.current.add(t.id);
            playChime();
            toast.success(`Timer done: ${t.label}`, {
              description: `Step ${t.stepIndex + 1}`,
            });
            track(AnalyticsEvents.recipe_timer_completed, {
              recipeId: recipe.id,
              seconds: t.totalSeconds,
            });
          }
          return { ...t, remainingSeconds: remaining, done };
        });
        return anyChanged ? next : prev;
      });
    }, 250); // faster cadence smooths the last-second of each countdown

    return () => {
      if (timerTickRef.current) {
        clearInterval(timerTickRef.current);
        timerTickRef.current = null;
      }
    };
  }, [runningTimers.length, recipe.id]);

  const startTimer = useCallback(
    (timer: ParsedTimer) => {
      const id = `${currentStep}:${timer.startIndex}:${Date.now()}`;
      const endsAtMs = Date.now() + timer.totalSeconds * 1000;
      setRunningTimers((prev) => [
        ...prev,
        {
          id,
          stepIndex: currentStep,
          label: timer.label,
          totalSeconds: timer.totalSeconds,
          endsAtMs,
          remainingSeconds: timer.totalSeconds,
          done: false,
        },
      ]);
      track(AnalyticsEvents.recipe_timer_started, {
        recipeId: recipe.id,
        seconds: timer.totalSeconds,
      });
    },
    [currentStep, recipe.id],
  );

  const cancelTimer = useCallback((id: string) => {
    setRunningTimers((prev) => prev.filter((t) => t.id !== id));
    firedTimerIdsRef.current.delete(id);
  }, []);

  const resetTimer = useCallback((id: string) => {
    setRunningTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        firedTimerIdsRef.current.delete(id);
        return {
          ...t,
          endsAtMs: Date.now() + t.totalSeconds * 1000,
          remainingSeconds: t.totalSeconds,
          done: false,
        };
      }),
    );
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < totalSteps) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      if (nextStep >= totalSteps) {
        track(AnalyticsEvents.cook_mode_completed, { recipeTitle: recipe.title });
        // Capture cook duration once when the user actually finishes.
        // Idempotent — guarded by `cookDurationSec == null`.
        const elapsedSec = Math.max(
          0,
          Math.round((Date.now() - sessionStartRef.current) / 1000),
        );
        setCookDurationSec((prev) => (prev == null ? elapsedSec : prev));
      }
    }
  }, [currentStep, totalSteps, recipe.title]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep]);

  const toggleIngredientChecked = useCallback((idx: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleLogMeal = useCallback(() => {
    // Build 41 (TestFlight `AB1PYpfPjbd9li7jtnlAsIE`, 2026-05-01) —
    // route through the shared `journalSlotFromMealTypes` helper so
    // mobile and web pick the same slot for the same recipe + clock.
    // The shared helper normalises common variants ("breakfast",
    // "Brunch", "supper" → Dinner) before falling back to time-of-day.
    const mealName = recipe.mealSlots?.length
      ? journalSlotFromMealTypes(recipe.mealSlots as string[])
      : fallbackSlotFromTimeOfDay();

    // Use the same `scaleFactor` that drove step-text scaling so the
    // calories logged match what the user actually cooked. A 4-serving
    // recipe at servings=8 → scaleFactor=2 → calories x 2. The Paprika
    // segmented control (0.5/1/1.5/2/4) is already composed into
    // `scaleFactor` above.
    const portionMultiplier = scaleFactor;
    const scaleVal = (v: number) => Math.round(v * portionMultiplier);

    addLoggedMeal({
      name: mealName,
      recipeTitle: recipe.title,
      time: mealName,
      calories: scaleVal(recipe.calories),
      protein: scaleVal(recipe.protein),
      carbs: scaleVal(recipe.carbs),
      fat: scaleVal(recipe.fat),
      fiberG: recipe.fiberG != null ? scaleVal(recipe.fiberG) : undefined,
      portionMultiplier: portionMultiplier !== 1 ? portionMultiplier : undefined,
    });
    setLogged(true);
    track(AnalyticsEvents.cook_mode_meal_logged, {
      recipeTitle: recipe.title,
      calories: scaleVal(recipe.calories),
      portionMultiplier,
    });
    toast.success(`Logged ${mealName} to your tracker!`);
  }, [addLoggedMeal, recipe, scaleFactor]);

  /** Save the per-cook history row (Paprika parity, 2026-04-30).
   *  Writes to `recipe_cook_history` with duration / scale / rating /
   *  note. Idempotent — disables itself once the row exists. */
  const handleSaveHistory = useCallback(async () => {
    if (historySaved || savingHistory) return;
    if (!userId) {
      toast.error("Sign in to save your cook notes.");
      return;
    }
    setSavingHistory(true);
    try {
      const note = noteDraft.trim();
      await insertCookHistory(supabase, userId, {
        recipeId: String(recipe.id),
        durationSec: cookDurationSec,
        scaleFactor: scale,
        rating,
        note: note ? note : null,
      });
      setHistorySaved(true);
      toast.success("Saved this cook");
      try {
        track(AnalyticsEvents.cook_history_saved, {
          recipeId: recipe.id,
          scale,
          rating,
          hasNote: Boolean(note),
          durationSec: cookDurationSec,
        });
      } catch {
        /* analytics fire-and-forget */
      }
    } catch (err) {
      console.warn("Cook history save failed", err);
      toast.error("Couldn't save — try again?");
    } finally {
      setSavingHistory(false);
    }
  }, [userId, recipe.id, cookDurationSec, scale, rating, noteDraft, historySaved, savingHistory]);

  // Keyboard navigation — arrows and escape, space as "advance".
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "INPUT" ||
        target?.isContentEditable;
      if (isEditable) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        onExit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onExit]);

  /**
   * Render the current step text with each timer-like phrase replaced
   * by a tappable pill. Offsets come from `parseTimersInStep`, which
   * uses the same cleaned string we render — therefore the inline-pill
   * branch reads from `currentStepCleaned`, NOT `currentStepText`.
   * When `scale !== 1` we render the scaled text instead and surface
   * any active timer phrases as standalone pill buttons below the
   * paragraph (offsets in scaled text would be unstable as units
   * resolve to different lengths). At 1x both render identically.
   */
  const renderedStep = useMemo(() => {
    const isScaled = scaleFactor !== 1;
    if (isScaled) {
      // Scaled mode — pill buttons live below the paragraph because
      // offsets in the rewritten text aren't safe to index against.
      return (
        <div className="text-2xl sm:text-3xl leading-relaxed text-foreground">
          <p>{currentStepText}</p>
          {stepTimers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              {stepTimers.map((t, i) => {
                const rangeHint = t.isRange ? ` (timer uses upper bound)` : "";
                return (
                  <button
                    key={`${i}:${t.startIndex}`}
                    type="button"
                    onClick={() => startTimer(t)}
                    aria-label={`Start ${formatTimer(t.totalSeconds)} timer${rangeHint}`}
                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors text-base font-semibold"
                  >
                    <Play className="w-3.5 h-3.5" fill="currentColor" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }
    if (stepTimers.length === 0) {
      return <p className="text-2xl sm:text-3xl leading-relaxed text-foreground">{currentStepCleaned}</p>;
    }
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    stepTimers.forEach((t, i) => {
      if (t.startIndex > cursor) {
        nodes.push(currentStepCleaned.slice(cursor, t.startIndex));
      }
      const label = t.label;
      const rangeHint = t.isRange ? ` (timer uses upper bound)` : "";
      nodes.push(
        <button
          key={`${i}:${t.startIndex}`}
          type="button"
          onClick={() => startTimer(t)}
          aria-label={`Start ${formatTimer(t.totalSeconds)} timer${rangeHint}`}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 mx-0.5 rounded-lg bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors text-[0.9em] font-semibold align-baseline"
        >
          <Play className="w-3.5 h-3.5" fill="currentColor" />
          <span>{label}</span>
        </button>,
      );
      cursor = t.endIndex;
    });
    if (cursor < currentStepCleaned.length) {
      nodes.push(currentStepCleaned.slice(cursor));
    }
    return (
      <p className="text-2xl sm:text-3xl leading-relaxed text-foreground">
        {nodes}
      </p>
    );
  }, [currentStepCleaned, currentStepText, scaleFactor, stepTimers, startTimer]);

  /** Recime parity (2026-04-30): tap "Watch original" → opens the
   *  source video URL in a new tab and emits the analytics event with
   *  the host classification. URL itself stays on-device; only the
   *  bucket (`youtube` / `instagram` / `tiktok` / `other`) is sent. */
  const watchOriginalUrl =
    typeof recipe.sourceUrl === "string" && recipe.sourceUrl.trim() !== ""
      ? recipe.sourceUrl
      : null;
  const onWatchOriginalClick = useCallback(() => {
    if (!watchOriginalUrl) return;
    const host = extractVideoHost(watchOriginalUrl);
    try {
      track(AnalyticsEvents.cook_watch_original_tapped, {
        recipeId: recipe.id,
        videoHost: host,
      });
    } catch {
      /* analytics fire-and-forget */
    }
    if (typeof window !== "undefined") {
      // `noopener,noreferrer` so the source page can't reach back into
      // the cook session via window.opener.
      window.open(watchOriginalUrl, "_blank", "noopener,noreferrer");
    }
  }, [watchOriginalUrl, recipe.id]);

  return (
    <div className="fixed inset-0 z-50 bg-background text-foreground flex flex-col">
      {/* Header — uses theme tokens so light/dark both stay readable */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors text-sm font-medium"
        >
          <Icons.back className="w-4 h-4" />
          Exit Cook Mode
        </button>
        <h2 className="text-sm font-semibold text-foreground truncate max-w-[40%]">
          {recipe.title}
        </h2>
        <div className="flex items-center gap-2">
          {/* Recime parity (2026-04-30) — "Watch original" pill,
              renders only when `recipe.sourceUrl` is set. Mirrors the
              mobile cook screen pill (Lucide `Play` + same label). */}
          {watchOriginalUrl ? (
            <button
              type="button"
              onClick={onWatchOriginalClick}
              data-testid="cook-watch-original"
              aria-label="Watch original video"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
            >
              <Play className="w-4 h-4" />
              <span className="hidden sm:inline">Watch original</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setShowIngredients(!showIngredients)}
            className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
              showIngredients
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60"
            }`}
          >
            <ListChecks className="w-4 h-4" />
            <span className="hidden sm:inline">Ingredients</span>
          </button>
        </div>
      </div>

      {/* Active timer strip — shown whenever any timer is running, so
           timers started on earlier steps remain visible and cancellable.
           role="status" so assistive tech announces new timers. */}
      {runningTimers.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="shrink-0 px-4 py-2 border-b border-border flex flex-wrap gap-2 bg-card/70"
        >
          {runningTimers.map((t) => (
            <div
              key={t.id}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                t.done
                  ? "bg-success/15 text-success border border-success/30"
                  : "bg-primary/10 text-primary border border-primary/25"
              }`}
            >
              <span className="tabular-nums">{formatTimer(t.remainingSeconds)}</span>
              <span className="text-muted-foreground font-medium">· {t.label}</span>
              {t.done && (
                <span role="alert" className="font-semibold">Done!</span>
              )}
              <button
                type="button"
                onClick={() => resetTimer(t.id)}
                className="underline text-muted-foreground hover:text-foreground"
                aria-label={`Reset ${t.label} timer`}
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => cancelTimer(t.id)}
                className="text-muted-foreground hover:text-destructive"
                aria-label={`Cancel ${t.label} timer`}
              >
                <Icons.close className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Step Area */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-y-auto">
          {!isDone ? (
            <>
              {/* Scaled-for-N-servings banner — only when the user has
                  actually scaled the recipe via the servings stepper
                  (or composed with the cook-mode Paprika scale).
                  Servings handoff (P0, 2026-05-01): step text below
                  reflects the scaled quantities, so the banner names
                  the count to confirm at a glance. */}
              {scaleFactor !== 1 && (
                <div
                  role="status"
                  aria-label={`Recipe scaled for ${servings} servings`}
                  className="mb-4 px-3 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-semibold tracking-wide"
                >
                  Scaled for {servings} serving{servings !== 1 ? "s" : ""}
                </div>
              )}
              {/* Step Counter */}
              <div className="mb-6">
                <span className="px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold">
                  Step {currentStep + 1} of {totalSteps}
                </span>
              </div>

              {/* Step Progress */}
              <div className="w-full max-w-lg mb-8">
                <div className="flex gap-1">
                  {instructionSteps.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-all ${
                        i < currentStep
                          ? "bg-primary"
                          : i === currentStep
                            ? "bg-primary"
                            : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* "Last time" preview card (Paprika parity, 2026-04-30).
                  Surfaces the most recent cook-history row above the
                  active step so users walk in reminded of last time's
                  duration / rating / note. Only renders when the user
                  has at least one prior cook on file. */}
              {recentHistory.length > 0 && (
                <div
                  role="region"
                  aria-label="Last time you cooked this"
                  className="mb-6 max-w-lg w-full px-4 py-3 rounded-xl bg-card/50 border border-border"
                >
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    Last time
                  </p>
                  <p className="text-sm text-foreground font-medium mt-1">
                    {formatCookHistoryPreview(recentHistory[0]!)}
                  </p>
                  {recentHistory.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {recentHistory.length === 2
                        ? "1 earlier cook on file."
                        : `${recentHistory.length - 1} earlier cooks on file.`}
                    </p>
                  )}
                </div>
              )}

              {/* Recipe scale segmented control (Paprika parity,
                  2026-04-30). Tap a preset to rewrite the visible
                  amounts in the step text. Persisted per (userId,
                  recipeId) to localStorage. */}
              <div className="mb-6 flex flex-col items-center gap-1.5">
                <div
                  role="radiogroup"
                  aria-label="Recipe scale"
                  // Segmented grammar (web parity 2026-06-10, ENG-1022): one
                  // track treatment — `bg-muted` rounded-full `p-0.5`, no
                  // border. Active thumb = white `bg-card` lift +
                  // `primary-solid` label + `shadow-sm` (matches the Progress
                  // + macro-detail segmented controls, treatment §8). Was a
                  // bordered `bg-card` track with a solid `bg-primary` thumb.
                  className="inline-flex p-0.5 rounded-full bg-muted gap-0.5"
                >
                  {COOK_SCALE_PRESETS.map((preset) => {
                    const active = Math.abs(scale - preset) < 1e-6;
                    return (
                      <button
                        key={preset}
                        role="radio"
                        type="button"
                        aria-checked={active}
                        aria-label={`Scale ${formatCookScaleLabel(preset)}`}
                        onClick={() => handleScaleChange(preset)}
                        className={`min-w-[44px] px-3.5 py-1.5 rounded-full text-sm font-semibold tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                          active
                            ? "bg-card text-primary-solid shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {formatCookScaleLabel(preset)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  {cookScaleCaption(scale, recipe.servings || null)}
                </p>
              </div>

              {/* Step Text with inline timer pills */}
              <div className="max-w-lg text-center mb-8">
                {renderedStep}
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentStep === 0}
                  className="p-3 rounded-xl border border-border text-muted-foreground dark:text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Previous step"
                >
                  <Icons.back className="w-6 h-6" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all text-lg"
                >
                  {isLastStep ? "Finish" : "Next"}
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={isLastStep}
                  className="p-3 rounded-xl border border-border text-muted-foreground dark:text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-0 disabled:cursor-default"
                  aria-label="Next step"
                >
                  <Icons.forward className="w-6 h-6" />
                </button>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                Use arrow keys or swipe to navigate
              </p>
            </>
          ) : (
            /* Done State — Paprika parity 2026-04-30: rating + per-cook
               notes input + Save persists to recipe_cook_history. */
            <div className="text-center max-w-md w-full">
              <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center mx-auto mb-6 shadow-lg shadow-success/30">
                <Icons.cook className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Enjoy your meal!
              </h2>
              <p className="text-muted-foreground mb-6">
                {recipe.title} · {servings} serving{servings !== 1 ? "s" : ""}
                {scale !== 1 ? ` (${formatCookScaleLabel(scale)})` : ""}
                {" — "}
                {Math.round(recipe.calories * scaleFactor)} kcal ·{" "}
                {Math.round(recipe.protein * scaleFactor)}g protein
              </p>

              {/* Rating row — 5 stars. Tap = stage in memory; Save
                  commits the row to recipe_cook_history. */}
              <div
                role="radiogroup"
                aria-label="Rate this cook"
                className="flex justify-center gap-2 mb-4"
              >
                {[1, 2, 3, 4, 5].map((n) => {
                  const filled = rating != null && n <= rating;
                  return (
                    <button
                      key={n}
                      role="radio"
                      type="button"
                      aria-checked={rating === n}
                      aria-label={`Rate ${n} star${n === 1 ? "" : "s"}`}
                      onClick={() => setRating(n)}
                      disabled={historySaved}
                      className="p-1 disabled:opacity-70"
                    >
                      <svg
                        className={`w-7 h-7 transition-colors ${
                          filled ? "text-warning" : "text-muted-foreground"
                        }`}
                        fill={filled ? "currentColor" : "none"}
                        stroke="currentColor"
                        strokeWidth={1.75}
                        viewBox="0 0 24 24"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  );
                })}
              </div>

              {/* Per-cook notes — free-form, capped at COOK_HISTORY_NOTE_MAX_LEN. */}
              <textarea
                aria-label="Notes for next time"
                placeholder="Notes for next time (optional)"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                disabled={historySaved}
                maxLength={COOK_HISTORY_NOTE_MAX_LEN}
                className="w-full mb-2 px-3 py-2 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground resize-y min-h-[64px] disabled:opacity-70"
                rows={3}
              />
              {noteDraft.length > Math.floor(COOK_HISTORY_NOTE_MAX_LEN * 0.8) && (
                <p className="text-[11px] text-muted-foreground text-right mb-2">
                  {noteDraft.length}/{COOK_HISTORY_NOTE_MAX_LEN}
                </p>
              )}

              {/* Save button — writes the row to recipe_cook_history. */}
              <button
                type="button"
                onClick={() => void handleSaveHistory()}
                disabled={historySaved || savingHistory}
                aria-label={historySaved ? "Saved this cook" : "Save this cook"}
                className={`inline-flex items-center justify-center gap-2 w-full px-6 py-3 rounded-2xl font-semibold mb-6 transition-all ${
                  historySaved
                    ? "bg-success text-white"
                    : savingHistory
                      ? "bg-primary/60 text-white cursor-wait"
                      : "bg-primary text-primary-foreground hover:shadow-lg hover:shadow-primary/25"
                } disabled:cursor-not-allowed`}
              >
                {historySaved ? (
                  <>
                    <Icons.success className="w-4 h-4" />
                    Saved
                  </>
                ) : savingHistory ? (
                  "Saving…"
                ) : (
                  "Save this cook"
                )}
              </button>

              {!logged ? (
                <button
                  type="button"
                  onClick={handleLogMeal}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-lg hover:shadow-xl hover:shadow-primary/30 transition-all mb-4"
                >
                  <Icons.success className="w-5 h-5" />
                  Log this meal
                </button>
              ) : (
                <div className="flex flex-col items-center gap-3 mb-4">
                  <div className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-success/10 text-success font-semibold">
                    <Icons.success className="w-5 h-5" />
                    Logged to tracker
                  </div>
                  {onViewTracker && (
                    <button
                      type="button"
                      onClick={() => { onExit(); onViewTracker(); }}
                      className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
                    >
                      View in Tracker
                    </button>
                  )}
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={onExit}
                  className="px-6 py-3 rounded-xl text-muted-foreground font-medium hover:bg-muted/60 transition-colors"
                >
                  Back to recipe
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Ingredients Sidebar */}
        {showIngredients && (
          <div className="w-80 shrink-0 border-l border-border bg-card overflow-y-auto p-4 hidden sm:block">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground text-sm">
                Ingredients ({servings} serving{servings !== 1 ? "s" : ""})
              </h3>
              <button
                type="button"
                onClick={() => setShowIngredients(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-muted-foreground/80"
              >
                <Icons.close className="w-4 h-4" />
              </button>
            </div>
            <ul className="space-y-2">
              {ingredients.map((ing, idx) => {
                // Scale the structured amount when it parses as a real
                // number; fall back to the raw string for free-text
                // amounts ("a pinch", "to taste"). Mirrors the
                // step-text scaling so the sidebar and the step
                // content stay in sync.
                const numericAmount =
                  typeof ing.amount === "string" ? parseFloat(ing.amount) : NaN;
                const scaledAmountText =
                  Number.isFinite(numericAmount) && scaleFactor !== 1
                    ? String(Math.round(numericAmount * scaleFactor * 100) / 100)
                    : ing.amount;
                return (
                  <li key={idx}>
                    <button
                      type="button"
                      onClick={() => toggleIngredientChecked(idx)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        checkedIngredients.has(idx)
                          ? "line-through text-muted-foreground bg-muted"
                          : "text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      <span className="font-medium">
                        {scaledAmountText} {ing.unit}
                      </span>{" "}
                      {ing.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
