"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icons } from "./ui/icons";
import { toast } from "sonner";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { useAppData } from "../../context/AppDataContext.tsx";
import { AnalyticsEvents } from "../../lib/analytics/events.ts";
import { track } from "../../lib/analytics/track.ts";

const DISMISSED_KEY = "suppr-checklist-dismissed";
/** Once-per-user gate for the completion toast so it doesn't re-fire
 *  on every navigation while allDone stays true. */
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
  const nextStep = STEPS.find((step) => !completed[step.id]);

  // Persist dismissal and track completion
  useEffect(() => {
    if (allDone) {
      localStorage.setItem(DISMISSED_KEY, "1");
      track(AnalyticsEvents.onboarding_checklist_completed);

      // When the flag is on, fire the toast at most once per user.
      const alreadyShown = typeof window !== "undefined" && localStorage.getItem(TOAST_SHOWN_KEY) === "1";
      const onToday =
        typeof window !== "undefined" &&
        (window.location.pathname === "/today" ||
          window.location.pathname.endsWith("/today"));
      if (toastGateOn && (alreadyShown || onToday)) return;

      toast.success("You're all set. Keep logging on Today — recipes and plans are there when you want them.", { duration: 5000 });
      if (typeof window !== "undefined") localStorage.setItem(TOAST_SHOWN_KEY, "1");
    }
  }, [allDone, toastGateOn]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "1");
  }, []);

  const handleNavigate = useCallback(
    (view: string) => {
      track(AnalyticsEvents.onboarding_step_completed, { step: view });
      onNavigate(view);
    },
    [onNavigate],
  );

  if (dismissed || allDone || !nextStep) return null;

  const NextIcon = nextStep.icon;

  return (
    <aside
      aria-label="Getting Started"
      data-testid="first-run-checklist"
      className="fixed inset-x-4 bottom-24 z-40 rounded-card border border-border bg-card p-4 card-slab md:inset-x-auto md:right-4 md:bottom-4 md:w-80"
    >
      <div className="flex items-start gap-3">
        <div
          className="grid h-8 w-8 shrink-0 place-items-center rounded-sm bg-primary/15 text-primary-solid"
          aria-hidden
        >
          <NextIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">
                Getting Started
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {completedCount} of {STEPS.length} complete
              </p>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dismiss checklist"
            >
              <Icons.close className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
            />
          </div>
          <button
            type="button"
            data-testid="first-run-checklist-next-step"
            onClick={() => handleNavigate(nextStep.view)}
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-md px-3 py-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {nextStep.label}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                {nextStep.description}
              </span>
            </span>
            <Icons.forward className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        </div>
      </div>
    </aside>
  );
}
