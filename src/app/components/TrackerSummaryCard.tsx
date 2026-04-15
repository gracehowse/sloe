import { Icons } from "./ui/icons";
import { IconBox } from "./ui/icon-box";

type TrackerSummaryCardProps = {
  /** Selected calendar date label */
  dateLabel: string;
  caloriesToday: number;
  calorieTarget: number;
  streakDays: number;
  weekLogged: { logged: number; total: number };
  goalFitPercent: number | null;
  /** Mon–Sun days meeting fiber / water goals (optional). */
  weekFiberWater?: { fiberDaysMet: number; waterDaysMet: number; total: 7 };
  /** Total distinct days with at least one logged meal (across all time). */
  totalDaysLogged?: number;
};

function StatTile({
  icon,
  label,
  value,
  sub,
  tone = "primary",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone?: "primary" | "success" | "warning";
}) {
  return (
    <div className="rounded-card bg-card border border-border p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1.5">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

export function TrackerSummaryCard({
  dateLabel,
  caloriesToday,
  calorieTarget,
  streakDays,
  weekLogged,
  goalFitPercent,
  weekFiberWater,
  totalDaysLogged = 0,
}: TrackerSummaryCardProps) {
  const pctOfGoal =
    calorieTarget > 0 ? Math.min(100, Math.round((caloriesToday / calorieTarget) * 100)) : null;

  // Don't show weekly stats until at least 1 full day has been logged
  const hasEnoughData = totalDaysLogged >= 1;

  return (
    <div className="rounded-card bg-card border border-border p-5 mb-6">
      <div className="flex items-center gap-2.5 mb-4">
        <IconBox size="sm" tone="primary">
          <Icons.calendarCheck />
        </IconBox>
        <div>
          <h2 className="text-base font-semibold text-foreground">Today &amp; this week</h2>
          <p className="text-xs text-muted-foreground">
            Snapshot for <span className="font-medium text-foreground">{dateLabel}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile
          icon={<Icons.target className="size-4" />}
          label="Calories vs goal"
          value={`${caloriesToday} / ${calorieTarget}`}
          sub={pctOfGoal != null ? `${pctOfGoal}% of daily goal` : ""}
        />
        <StatTile
          icon={<Icons.streak className="size-4" />}
          label="Logging streak"
          value={streakDays > 0 ? `${streakDays}d` : "—"}
          sub="Consecutive days with a log"
        />
        <StatTile
          icon={<Icons.calendarCheck className="size-4" />}
          label="Week logged"
          value={hasEnoughData ? `${weekLogged.logged}/${weekLogged.total}` : "—"}
          sub={hasEnoughData ? "Mon–Sun with ≥1 meal" : "Log a full day to start tracking"}
        />
        <StatTile
          icon={<Icons.trendUp className="size-4" />}
          label="7-day calorie fit"
          value={hasEnoughData && goalFitPercent != null ? `${goalFitPercent}%` : "—"}
          sub={hasEnoughData && goalFitPercent != null ? "Avg closeness to target" : "Not enough data yet"}
        />
      </div>

      {weekFiberWater ? (
        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-lg bg-muted/40 border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Fiber goal (Mon–Sun)</p>
            <p className="font-semibold text-foreground tabular-nums">
              {weekFiberWater.fiberDaysMet}/{weekFiberWater.total} days
            </p>
          </div>
          <div className="rounded-lg bg-muted/40 border border-border px-3 py-2">
            <p className="text-xs text-muted-foreground">Water goal (Mon–Sun)</p>
            <p className="font-semibold text-foreground tabular-nums">
              {weekFiberWater.waterDaysMet}/{weekFiberWater.total} days
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
