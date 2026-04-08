import { CalendarRange, Flame, Target, TrendingUp } from "lucide-react";

type TrackerSummaryCardProps = {
  /** Selected calendar date label */
  dateLabel: string;
  caloriesToday: number;
  calorieTarget: number;
  streakDays: number;
  weekLogged: { logged: number; total: number };
  goalFitPercent: number | null;
};

export function TrackerSummaryCard({
  dateLabel,
  caloriesToday,
  calorieTarget,
  streakDays,
  weekLogged,
  goalFitPercent,
}: TrackerSummaryCardProps) {
  const pctOfGoal =
    calorieTarget > 0 ? Math.min(100, Math.round((caloriesToday / calorieTarget) * 100)) : null;

  return (
    <div className="backdrop-blur-xl bg-gradient-to-br from-violet-50/90 to-indigo-50/90 dark:from-violet-950/40 dark:to-indigo-950/40 border-2 border-violet-200/50 dark:border-violet-800/50 rounded-2xl p-6 mb-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <CalendarRange className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Today &amp; this week</h2>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Snapshot for <span className="font-medium text-slate-800 dark:text-slate-200">{dateLabel}</span> — same
        metrics as the cards below, in one place.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-violet-200/40 dark:border-violet-900/40 p-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-medium mb-1">
            <Target className="w-4 h-4" />
            Calories vs goal
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {caloriesToday} / {calorieTarget}
          </p>
          {pctOfGoal != null ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{pctOfGoal}% of daily goal</p>
          ) : null}
        </div>
        <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-violet-200/40 dark:border-violet-900/40 p-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-medium mb-1">
            <Flame className="w-4 h-4" />
            Logging streak
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {streakDays > 0 ? `${streakDays}d` : "—"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Consecutive days with a log</p>
        </div>
        <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-violet-200/40 dark:border-violet-900/40 p-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-medium mb-1">
            <CalendarRange className="w-4 h-4" />
            Week logged
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {weekLogged.logged}/{weekLogged.total}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Mon–Sun with ≥1 meal</p>
        </div>
        <div className="rounded-xl bg-white/70 dark:bg-slate-900/50 border border-violet-200/40 dark:border-violet-900/40 p-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-xs font-medium mb-1">
            <TrendingUp className="w-4 h-4" />
            7-day calorie fit
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
            {goalFitPercent != null ? `${goalFitPercent}%` : "—"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Avg closeness to target</p>
        </div>
      </div>
    </div>
  );
}
