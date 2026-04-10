import { Target, CheckCircle2, TrendingUp } from "lucide-react";

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

  return (
    <section
      className={`rounded-2xl border-2 backdrop-blur-xl px-5 py-4 mb-6 shadow-sm ${
        allTargetsHit
          ? "border-emerald-300/80 dark:border-emerald-700/60 bg-emerald-50/90 dark:bg-emerald-950/20"
          : "border-slate-200/80 dark:border-slate-700/80 bg-white/90 dark:bg-slate-900/80"
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Calories</p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
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
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{pLeft}g</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">of {proteinGoal}g</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Carbs left</p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{cLeft}g</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">of {carbsGoal}g</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Fat left</p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fLeft}g</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">of {fatGoal}g</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Fiber left</p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{fiLeft}g</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">of {fiberGoal}g</p>
        </div>
        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2 border border-slate-200/60 dark:border-slate-700/60">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">Water</p>
          <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">{waterEatenLabel}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">goal {waterGoalLabel}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
        Net calorie goal: {baseCalorieGoal} kcal base
        {preferActivityAdjusted && activityBurnKcal > 0
          ? ` + ${activityBurnKcal} kcal activity (this day)`
          : preferActivityAdjusted
            ? " — add activity burn below for this day to raise your budget"
            : ""}
        .
      </p>
    </section>
  );
}
