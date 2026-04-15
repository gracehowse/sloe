"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "./ui/icons";
import { ListChecks } from "lucide-react";
import { toast } from "sonner";
import type { IngredientRow, RecipeCard } from "../../types/recipe.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";

interface CookModeProps {
  recipe: RecipeCard;
  instructionSteps: string[];
  ingredients: IngredientRow[];
  servings: number;
  onExit: () => void;
  /** Navigate to the nutrition tracker after logging a meal. */
  onViewTracker?: () => void;
}

/** Parse seconds from step text like "cook for 5 minutes" or "bake 20–25 minutes". */
function parseTimerSeconds(text: string): number | null {
  const patterns = [
    /(\d+)\s*–\s*(\d+)\s*min/i,
    /(\d+)\s*-\s*(\d+)\s*min/i,
    /(\d+)\s*min/i,
    /(\d+)\s*hour/i,
    /(\d+)\s*second/i,
  ];
  for (const pat of patterns) {
    const m = text.match(pat);
    if (!m) continue;
    if (pat.source.includes("hour")) return parseInt(m[1]!) * 3600;
    if (pat.source.includes("second")) return parseInt(m[1]!);
    // For range like "20-25 minutes", take the higher value
    const val = m[2] ? parseInt(m[2]!) : parseInt(m[1]!);
    return val * 60;
  }
  return null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Strip leading step numbers like "1. " or "Step 1: " */
function cleanStepText(text: string): string {
  return text.replace(/^\s*(?:step\s*)?\d+[\.\)\:\-]\s*/i, "").trim();
}

export function CookMode({ recipe, instructionSteps, ingredients, servings, onExit, onViewTracker }: CookModeProps) {
  const { addLoggedMeal } = useAppData();
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [timerActive, setTimerActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState(0);
  const [logged, setLogged] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const totalSteps = instructionSteps.length;
  const isLastStep = currentStep >= totalSteps - 1;
  const isDone = currentStep >= totalSteps;

  const currentStepText = useMemo(
    () => (currentStep < totalSteps ? cleanStepText(instructionSteps[currentStep]!) : ""),
    [currentStep, instructionSteps, totalSteps],
  );

  const stepTimerSeconds = useMemo(
    () => (currentStep < totalSteps ? parseTimerSeconds(instructionSteps[currentStep]!) : null),
    [currentStep, instructionSteps, totalSteps],
  );

  // Track cook mode start
  useEffect(() => {
    track(AnalyticsEvents.cook_mode_started, { recipeTitle: recipe.title, steps: totalSteps });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Wake Lock
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    (async () => {
      try {
        if ("wakeLock" in navigator) {
          lock = await navigator.wakeLock.request("screen");
          wakeLockRef.current = lock;
        }
      } catch {
        // Wake Lock not supported or denied — non-critical
      }
    })();
    return () => {
      lock?.release();
      wakeLockRef.current = null;
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timerActive && timerRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimerRemaining((prev) => {
          if (prev <= 1) {
            setTimerActive(false);
            toast.success("Timer done!");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerActive, timerRemaining]);

  const startTimer = useCallback(() => {
    if (stepTimerSeconds) {
      setTimerRemaining(stepTimerSeconds);
      setTimerActive(true);
    }
  }, [stepTimerSeconds]);

  const stopTimer = useCallback(() => {
    setTimerActive(false);
    setTimerRemaining(0);
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < totalSteps) {
      stopTimer();
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      if (nextStep >= totalSteps) {
        track(AnalyticsEvents.cook_mode_completed, { recipeTitle: recipe.title });
      }
    }
  }, [currentStep, totalSteps, stopTimer, recipe.title]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      stopTimer();
      setCurrentStep((s) => s - 1);
    }
  }, [currentStep, stopTimer]);

  const toggleIngredientChecked = useCallback((idx: number) => {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const handleLogMeal = useCallback(() => {
    // Infer meal name from recipe's tagged slots or time of day
    const hour = new Date().getHours();
    const fallbackMeal = hour < 11 ? "Breakfast" : hour < 15 ? "Lunch" : hour < 17 ? "Snacks" : "Dinner";
    const mealName = recipe.mealSlots?.[0] ?? fallbackMeal;

    // Scale macros by servings relative to recipe base (e.g. cooking 2 servings of a 1-serving recipe)
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

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
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

              {/* Step Text */}
              <div className="max-w-lg text-center mb-8">
                <p className="text-2xl sm:text-3xl leading-relaxed text-white">
                  {currentStepText}
                </p>
              </div>

              {/* Timer */}
              {stepTimerSeconds && (
                <div className="mb-8">
                  {timerActive ? (
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-mono font-bold text-primary tabular-nums">
                        {formatTime(timerRemaining)}
                      </div>
                      <button
                        type="button"
                        onClick={stopTimer}
                        className="px-4 py-2 rounded-xl border border-border text-muted-foreground text-sm font-medium hover:bg-muted/60 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : timerRemaining === 0 ? (
                    <button
                      type="button"
                      onClick={startTimer}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary font-medium hover:bg-primary/20 transition-colors"
                    >
                      <Icons.timer className="w-4 h-4" />
                      Start {formatTime(stepTimerSeconds)} timer
                    </button>
                  ) : null}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={goPrev}
                  disabled={currentStep === 0}
                  className="p-3 rounded-xl border border-border text-muted-foreground dark:text-muted-foreground hover:bg-muted/60 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
