import { useEffect, useRef } from "react";
import { Target, CheckCircle2, TrendingUp } from "lucide-react";
import confetti from "canvas-confetti";

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
  const calLeft = Math.max(calorieGoalNet - caloriesEaten, 0);
  const pLeft = Math.max(proteinGoal - proteinEaten, 0);
  const cLeft = Math.max(carbsGoal - carbsEaten, 0);
  const fLeft = Math.max(fatGoal - fatEaten, 0);
  const fiLeft = Math.max(fiberGoal - fiberEaten, 0);

  // Celebration: calories within 10% of goal AND protein hit
  const calPct = calorieGoalNet > 0 ? caloriesEaten / calorieGoalNet : 0;
  const caloriesOnTrack = calPct >= 0.9 && calPct <= 1.1;
  const proteinHit = proteinGoal > 0 && proteinEaten >= proteinGoal * 0.9;
  const allTargetsHit = caloriesOnTrack && proteinHit && caloriesEaten > 0;
  const makingProgress = caloriesEaten > 0 && calPct >= 0.5 && calPct < 0.9;

  // Fire confetti once when targets are first hit
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (allTargetsHit && !celebratedRef.current) {
      celebratedRef.current = true;
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.7 },
        colors: ["#7c3aed", "#6366f1", "#10b981", "#34d399"],
        disableForReducedMotion: true,
      });
    }
    if (!allTargetsHit) celebratedRef.current = false;
  }, [allTargetsHit]);

  return (
    <section
      className={`rounded-2xl border px-5 py-4 mb-6 transition-colors duration-300 ${
        allTargetsHit
          ? "border-emerald-300 dark:border-emerald-700/60 bg-emerald-50 dark:bg-emerald-950/20"
          : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950"
      }`}
      aria-label="Today at a glance"
    >
      <div className="flex items-center gap-2 mb-3">
        {allTargetsHit ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
        ) : makingProgress ? (
          <TrendingUp className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
        ) : (
          <Target className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0" />
        )}
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          {allTargetsHit ? "Targets hit!" : makingProgress ? "On track" : "Today at a glance"}
        </h2>
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{dateLabel}</span>
      </div>
      {allTargetsHit && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium mb-3">
          You hit your calorie and protein targets today. Great work!
        </p>
      )}
      {!allTargetsHit && streakDays > 0 && caloriesEaten === 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium mb-3">
          You have a {streakDays}-day streak going. Log a meal to keep it alive!
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Calories</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
            {caloriesEaten} <span className="text-slate-500 font-medium text-sm">/ {calorieGoalNet}</span>
          </p>
          <p className={`text-xs mt-1 font-medium ${
            caloriesOnTrack && caloriesEaten > 0
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}>
            {caloriesOnTrack && caloriesEaten > 0 ? "On target" : `${calLeft} kcal left`}
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Protein left</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">{pLeft}g</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">of {proteinGoal}g</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Carbs left</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">{cLeft}g</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">of {carbsGoal}g</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Fat left</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">{fLeft}g</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">of {fatGoal}g</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Fiber left</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">{fiLeft}g</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">of {fiberGoal}g</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Water</p>
          <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">{waterEatenLabel}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">goal {waterGoalLabel}</p>
        </div>
      </div>
      {preferActivityAdjusted && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
          {activityBurnKcal > 0
            ? `${baseCalorieGoal} base + ${activityBurnKcal} activity = ${calorieGoalNet} net goal`
            : "Log activity below to increase your calorie goal for today"}
        </p>
      )}
    </section>
  );
}
