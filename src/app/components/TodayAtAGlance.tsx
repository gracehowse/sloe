import { useEffect, useRef } from "react";
import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";
import { DailyRing } from "./suppr/daily-ring";
import { MacroCard } from "./suppr/macro-card";

type TodayAtAGlanceProps = {
  /** e.g. "Wednesday, April 8" */
  dateLabel: string;
  caloriesEaten: number;
  calorieGoalNet: number;
  proteinEaten: number;
  proteinGoal: number;
  carbsEaten: number;
  carbsGoal: number;
  fatEaten: number;
  fatGoal: number;
  fiberEaten: number;
  fiberGoal: number;
  waterEatenLabel: string;
  waterGoalLabel: string;
  preferActivityAdjusted: boolean;
  activityBurnKcal: number;
  baseCalorieGoal: number;
  /** Current logging streak (consecutive days). Used for streak-at-risk nudge. */
  streakDays?: number;
};

export function TodayAtAGlance({
  dateLabel,
  caloriesEaten,
  calorieGoalNet,
  proteinEaten,
  proteinGoal,
  carbsEaten,
  carbsGoal,
  fatEaten,
  fatGoal,
  fiberEaten,
  fiberGoal,
  waterEatenLabel,
  waterGoalLabel,
  preferActivityAdjusted,
  activityBurnKcal,
  baseCalorieGoal,
  streakDays = 0,
}: TodayAtAGlanceProps) {
  const fiLeft = Math.max(fiberGoal - fiberEaten, 0);

  // Celebration: calories within 10% of goal AND protein hit
  const calPct = calorieGoalNet > 0 ? caloriesEaten / calorieGoalNet : 0;
  const caloriesOnTrack = calPct >= 0.9 && calPct <= 1.1;
  const proteinHit = proteinGoal > 0 && proteinEaten >= proteinGoal * 0.9;
  const allTargetsHit = caloriesOnTrack && proteinHit && caloriesEaten > 0;
  const makingProgress = caloriesEaten > 0 && calPct >= 0.5 && calPct < 0.9;

  // Fire confetti once when targets are first hit.
  // 2026-05-15: lazy-load canvas-confetti — fires on ~5% of opens, was
  // costing ~12KB on every Today web load. Critical-path JS saving.
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (allTargetsHit && !celebratedRef.current) {
      celebratedRef.current = true;
      void import("canvas-confetti").then(({ default: confetti }) => {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 },
          colors: ["#62b35a", "#df7a4e", "#e04888", "#5e574e"],
          disableForReducedMotion: true,
        });
      });
    }
    if (!allTargetsHit) celebratedRef.current = false;
  }, [allTargetsHit]);

  return (
    <section
      className={`rounded-card border px-5 py-5 mb-6 transition-colors duration-300 ${
        allTargetsHit
          ? "border-success/40 bg-success-soft"
          : "border-border bg-card"
      }`}
      aria-label="Today at a glance"
    >
      {/* Header row */}
      <div className="flex items-center gap-2.5 mb-4">
        {allTargetsHit ? (
          <IconBox size="sm" tone="success">
            <Icons.success />
          </IconBox>
        ) : makingProgress ? (
          <IconBox size="sm" tone="primary">
            <Icons.trendUp />
          </IconBox>
        ) : (
          <IconBox size="sm" tone="primary">
            <Icons.target />
          </IconBox>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-foreground">
            {allTargetsHit ? "Targets hit!" : makingProgress ? "On track" : "Today at a glance"}
          </h2>
          <span className="text-xs text-muted-foreground truncate block">{dateLabel}</span>
        </div>
      </div>

      {allTargetsHit && (
        <p className="text-sm text-success font-medium mb-4">
          You hit your calorie and protein targets today. Great work!
        </p>
      )}
      {!allTargetsHit && streakDays > 0 && caloriesEaten === 0 && (
        <p className="text-sm text-warning font-medium mb-4">
          You have a {streakDays}-day streak going. Log a meal to keep it alive!
        </p>
      )}

      {/* Hero ring + macro cards */}
      <div className="flex flex-col sm:flex-row items-center gap-5 mb-4">
        <DailyRing
          consumed={caloriesEaten}
          target={calorieGoalNet}
          size={140}
          strokeWidth={10}
        />
        <div className="grid grid-cols-3 gap-2 flex-1 w-full">
          <MacroCard macro="protein" value={proteinEaten} target={proteinGoal} />
          <MacroCard macro="carbs" value={carbsEaten} target={carbsGoal} />
          <MacroCard macro="fat" value={fatEaten} target={fatGoal} />
        </div>
      </div>

      {/* Fiber + Water row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/40 border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Fiber</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">
            {fiberEaten}g <span className="text-muted-foreground font-normal">/ {fiberGoal}g</span>
          </p>
          <p className="text-xs text-muted-foreground">{fiLeft}g left</p>
        </div>
        <div className="rounded-lg bg-muted/40 border border-border px-3 py-2">
          <p className="text-xs text-muted-foreground mb-0.5">Water</p>
          <p className="text-sm font-semibold tabular-nums text-foreground">{waterEatenLabel}</p>
          <p className="text-xs text-muted-foreground">goal {waterGoalLabel}</p>
        </div>
      </div>

      {preferActivityAdjusted && (
        <p className="text-xs text-muted-foreground mt-3">
          {activityBurnKcal > 0
            ? `${baseCalorieGoal} base + ${activityBurnKcal} activity = ${calorieGoalNet} net goal`
            : "Log activity below to increase your calorie goal for today"}
        </p>
      )}
      <p
        data-testid="today-nutrition-estimate-footer"
        className="mt-3 text-[11px] text-muted-foreground leading-snug"
      >
        Nutrition data are estimates. Not medical or dietetic advice.
      </p>
    </section>
  );
}
