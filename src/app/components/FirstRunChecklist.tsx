"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { toast } from "sonner";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useAppData } from "../../context/AppDataContext.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";

const DISMISSED_KEY = "suppr-checklist-dismissed";
/** Premium-bar audit 2026-05-17 (T1.1): once-per-user gate for the
 *  completion toast. Without this, `useEffect([allDone])` re-fires the
 *  toast on every mount while allDone is true — the auditor confirmed
 *  it surfaces across 6 captured authed surfaces in a single session
 *  (Sonner's 5s window catches every navigation). */
const TOAST_SHOWN_KEY = "suppr-checklist-toast-shown";

interface FirstRunChecklistProps {
  onNavigate: (view: string) => void;
}

const STEPS = [
  {
    id: "log",
    icon: Icons.target,
    label: "Start with your dashboard",
    description: "Log food and water on the Tracker — that's the daily home base; recipes and planning are extras when you want them",
    cta: "Open Tracker",
    view: "tracker",
  },
  {
    id: "plan",
    icon: Icons.plan,
    label: "Plan meals when you're ready",
    description: "Generate a week that lines up with your calorie and macro targets",
    cta: "Open Planner",
    view: "planner",
  },
  {
    id: "save",
    icon: Icons.saved,
    label: "Save recipes to cook later",
    description: "Build a library from the feed or imports — optional once logging feels easy",
    cta: "Browse recipes",
    view: "discover",
  },
] as const;

export function FirstRunChecklist({ onNavigate }: FirstRunChecklistProps) {
  const { savedRecipesForLibrary, mealPlan, nutritionByDay } = useAppData();
  // T1.1 gate — `useFeatureFlagEnabled` re-evaluates once PostHog
  // finishes fetching flag definitions. The imperative
  // `isFeatureEnabled` returned false on first render and the gate
  // never fired, so the toast still surfaced on every navigation.
  const toastGateOn = useFeatureFlagEnabled("premium-sweep-v2-p0-t11");
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(DISMISSED_KEY) === "1";
  });

  const completed = useMemo(
    () => ({
      save: savedRecipesForLibrary.length >= 3,
      plan: mealPlan !== null && mealPlan.length > 0,
      log: Object.values(nutritionByDay).some((meals) =>
        meals.some((m) => typeof m.id === "string" && !m.id.startsWith("seed-")),
      ),
    }),
    [savedRecipesForLibrary.length, mealPlan, nutritionByDay],
  );

  const completedCount = Object.values(completed).filter(Boolean).length;
  const allDone = completedCount === STEPS.length;

  // Persist dismissal and track completion
  useEffect(() => {
    if (allDone) {
      localStorage.setItem(DISMISSED_KEY, "1");
      // Dual-emit during rename cycle 2026-04-18 → 2026-05-18.
      // `first_run_checklist_completed` is retired in favour of
      // `onboarding_checklist_completed` — aligns with existing
      // `onboarding_completed`. See plan doc §4.
      track(AnalyticsEvents.first_run_checklist_completed);
      track(AnalyticsEvents.onboarding_checklist_completed);

      // T1.1 (premium-sweep-v2 P0): when the flag is on, fire the
      // toast at most once per user — gated by `TOAST_SHOWN_KEY` in
      // localStorage. Without the gate, this useEffect's
      // `[allDone]` dep re-fires the toast on every navigation
      // because the boolean stays `true` for the rest of the user's
      // life. The auditor confirmed this surfaces the toast on every
      // captured authed surface (Today, Discover, Library, Progress,
      // Settings, Recipes) within Sonner's 5s window.
      //
      // When the flag is OFF, behaviour is unchanged from before
      // (toast every mount). 2-week 100% ramp → cleanup PR removes
      // the gate per `feedback_session_replay_and_feature_flags.md`.
      const alreadyShown = typeof window !== "undefined" && localStorage.getItem(TOAST_SHOWN_KEY) === "1";
      if (toastGateOn && alreadyShown) return;

      toast.success("You're all set! Keep logging on the Tracker; add recipes and plans whenever you like.", { duration: 5000 });
      if (typeof window !== "undefined") localStorage.setItem(TOAST_SHOWN_KEY, "1");
    }
  }, [allDone, toastGateOn]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  }, []);

  const handleNavigate = useCallback(
    (view: string) => {
      // Dual-emit during rename cycle 2026-04-18 → 2026-05-18.
      // `first_run_step_completed` is retired in favour of
      // `onboarding_step_completed`. Same `{ step }` payload. See plan §4.
      const stepPayload = { step: view };
      track(AnalyticsEvents.first_run_step_completed, stepPayload);
      track(AnalyticsEvents.onboarding_step_completed, stepPayload);
      onNavigate(view);
    },
    [onNavigate],
  );

  if (dismissed || allDone) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 backdrop-blur-xl bg-card/95 border-2 border-border/80 rounded-2xl shadow-2xl shadow-foreground/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground text-sm">
            Getting Started
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completedCount} of {STEPS.length} complete
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="p-1 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss checklist"
        >
          <Icons.close className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="px-2 pb-3 space-y-1">
        {STEPS.map((step) => {
          const done = completed[step.id];
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => !done && handleNavigate(step.view)}
              disabled={done}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                done
                  ? "opacity-60"
                  : "hover:bg-muted/60"
              }`}
            >
              {done ? (
                <Icons.success className="w-5 h-5 text-success shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-border shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    done
                      ? "line-through text-muted-foreground"
                      : "text-foreground"
                  }`}
                >
                  {step.label}
                </p>
                {!done && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step.description}
                  </p>
                )}
              </div>
              {!done && (
                <Icons.forward className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
