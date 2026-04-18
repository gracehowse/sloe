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

interface CookModeProps {
  recipe: RecipeCard;
  instructionSteps: string[];
  ingredients: IngredientRow[];
  servings: number;
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

export function CookMode({ recipe, instructionSteps, ingredients, servings, onExit, onViewTracker }: CookModeProps) {
  const { addLoggedMeal } = useAppData();
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [runningTimers, setRunningTimers] = useState<RunningTimer[]>([]);
  const [logged, setLogged] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const timerTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const firedTimerIdsRef = useRef<Set<string>>(new Set());

  const totalSteps = instructionSteps.length;
  const isLastStep = currentStep >= totalSteps - 1;
  const isDone = currentStep >= totalSteps;

  const currentStepRaw = currentStep < totalSteps ? instructionSteps[currentStep]! : "";
  const currentStepText = useMemo(
    () => cleanStepText(currentStepRaw),
    [currentStepRaw],
  );

  /** Parse timers from the CURRENT step's cleaned text so the offsets
   * align with the rendered substring. */
  const stepTimers: ParsedTimer[] = useMemo(
    () => parseTimersInStep(currentStepText),
    [currentStepText],
  );

  // Track cook mode open — includes step count so analytics can see
  // how deep the recipes users cook are.
  useEffect(() => {
    track(AnalyticsEvents.cook_mode_opened, {
      recipeId: recipe.id,
      stepCount: totalSteps,
    });
    // Dual-emit during rename cycle 2026-04-18 → 2026-05-18. The old
    // `cook_mode_started` name is ambiguous alongside `cook_mode_opened`;
    // `cook_mode_first_step_advanced` is the canonical name going forward.
    // See `docs/planning/analytics-dashboards-plan-2026-04-18.md` §4.
    const cookModeStartedPayload = { recipeTitle: recipe.title, steps: totalSteps };
    track(AnalyticsEvents.cook_mode_started, cookModeStartedPayload);
    track(AnalyticsEvents.cook_mode_first_step_advanced, cookModeStartedPayload);
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
    const hour = new Date().getHours();
    const fallbackMeal = hour < 11 ? "Breakfast" : hour < 15 ? "Lunch" : hour < 17 ? "Snacks" : "Dinner";
    const mealName = recipe.mealSlots?.[0] ?? fallbackMeal;

    const baseServings = recipe.servings > 0 ? recipe.servings : 1;
    const portionMultiplier = servings / baseServings;
    const scale = (v: number) => Math.round(v * portionMultiplier);

    addLoggedMeal({
      name: mealName,
      recipeTitle: recipe.title,
      time: mealName,
      calories: scale(recipe.calories),
      protein: scale(recipe.protein),
      carbs: scale(recipe.carbs),
      fat: scale(recipe.fat),
      fiberG: recipe.fiberG != null ? scale(recipe.fiberG) : undefined,
      portionMultiplier: portionMultiplier !== 1 ? portionMultiplier : undefined,
    });
    setLogged(true);
    track(AnalyticsEvents.cook_mode_meal_logged, {
      recipeTitle: recipe.title,
      calories: scale(recipe.calories),
      portionMultiplier,
    });
    toast.success(`Logged ${mealName} to your tracker!`);
  }, [addLoggedMeal, recipe, servings]);

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
   * uses the same cleaned string we render.
   */
  const renderedStep = useMemo(() => {
    if (stepTimers.length === 0) {
      return <p className="text-2xl sm:text-3xl leading-relaxed text-white">{currentStepText}</p>;
    }
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    stepTimers.forEach((t, i) => {
      if (t.startIndex > cursor) {
        nodes.push(currentStepText.slice(cursor, t.startIndex));
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
    if (cursor < currentStepText.length) {
      nodes.push(currentStepText.slice(cursor));
    }
    return (
      <p className="text-2xl sm:text-3xl leading-relaxed text-white">
        {nodes}
      </p>
    );
  }, [currentStepText, stepTimers, startTimer]);

  return (
    <div className="fixed inset-0 z-50 bg-background text-white flex flex-col">
      {/* Header — always dark for kitchen context */}
      <div className="shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
        <button
          type="button"
          onClick={onExit}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl text-muted-foreground hover:bg-muted/60 transition-colors text-sm font-medium"
        >
          <Icons.back className="w-4 h-4" />
          Exit Cook Mode
        </button>
        <h2 className="text-sm font-semibold text-white truncate max-w-[50%]">
          {recipe.title}
        </h2>
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
                  className="px-8 py-3 rounded-xl bg-primary text-white font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all text-lg"
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
            /* Done State */
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-full bg-success flex items-center justify-center mx-auto mb-6 shadow-lg shadow-success/30">
                <Icons.cook className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Enjoy your meal!
              </h2>
              <p className="text-muted-foreground mb-8">
                {recipe.title} · {servings} serving{servings !== 1 ? "s" : ""} — {Math.round(recipe.calories * servings / (recipe.servings || 1))} kcal · {Math.round(recipe.protein * servings / (recipe.servings || 1))}g protein
              </p>

              {!logged ? (
                <button
                  type="button"
                  onClick={handleLogMeal}
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-white font-semibold text-lg hover:shadow-xl hover:shadow-primary/30 transition-all mb-4"
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
                      className="px-6 py-3 rounded-xl bg-primary text-white font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all"
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
              <h3 className="font-semibold text-white text-sm">
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
              {ingredients.map((ing, idx) => (
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
                      {ing.amount} {ing.unit}
                    </span>{" "}
                    {ing.name}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
