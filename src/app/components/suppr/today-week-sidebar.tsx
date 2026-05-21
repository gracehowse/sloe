"use client";

/**
 * `<TodayWeekSidebar>` — compact 7-day strip for desktop's Today
 * right rail.
 *
 * Authority: `docs/ux/teardown-2026-04-28-daily-loop.md` §2 ("Today,
 * desktop") and Next-10 #14.
 *
 * Background: the teardown's §2 desktop sketch was —
 *   "Left column (440px): the entire mobile Today as defined above.
 *    Same composition. Don't fork.
 *    Right column: week-at-a-glance. A 7-row strip showing each
 *    day's calories vs. target, the dominant macro hit/miss, and
 *    a 'tap to drill' affordance."
 *
 * Pre-Phase-4 desktop: Today rendered the same composition as
 * mobile-web at desktop breakpoint, leaving the right side of the
 * canvas empty. This component fills that real estate with a
 * compact week-at-a-glance strip — last 7 calendar days, each row
 * a tappable day with calories vs target.
 *
 * Wired in `NutritionTracker.tsx` (ENG-590): `md:flex` row (matches
 * desktop app sidebar breakpoint) with the main Today column capped
 * at 440px and this sidebar sticky on the right when `viewMode === "day"`.
 *
 * The sidebar is intentionally read-only — it does not own the
 * calendar pickers, the week aggregates, or any state. It reads
 * `byDay` and renders the last 7 days, calls `onSelectDayKey` on
 * tap. The host owns selection state.
 *
 * Mobile parity: mobile Today already supports the existing
 * `<TodayWeekView>` via the day/week toggle. The desktop sidebar
 * is a desktop-only addition; mobile-web below `lg` continues to
 * use the day/week toggle — different viewport, different
 * interaction model, both achieve "look at the week".
 */

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../ui/utils";

export interface TodayWeekSidebarMeal {
  /** Only the calorie field is read; meal shape is intentionally
   *  minimal so the host can pass a slim projection of its
   *  `nutrition_entries` row. */
  calories: number;
}

export interface TodayWeekSidebarProps {
  /** Map of `YYYY-MM-DD` date-key → array of meals for that day.
   *  The sidebar reads only the last 7 keys ending at `todayDateKey`;
   *  any older or future keys in the map are ignored. */
  byDay: Record<string, ReadonlyArray<TodayWeekSidebarMeal>>;
  /** Daily calorie target. Used as the denominator on each row. */
  calorieTarget: number;
  /** The date the user is currently viewing on Today. The matching
   *  row is highlighted with a primary-tinted background. */
  activeDateKey: string;
  /** Today's date key. Used to render a subtle "Today" tag on that
   *  row even when it's not the active selection. */
  todayDateKey: string;
  /** Tapping a row fires this with the row's date key. The host
   *  flips Today's selectedDateKey to that value. */
  onSelectDayKey: (dateKey: string) => void;
  /** Optional outer-wrapper class — host typically adds `sticky top-4
   *  self-start` and visibility (`hidden lg:block`) here without
   *  forking the primitive. */
  className?: string;
}

/** Computes the last 7 calendar dates ending at `endKey` (inclusive),
 *  oldest first. Date math is local-timezone via Date constructor;
 *  the host already uses `dateKeyFromDate` for parity with
 *  `nutrition_entries.date_key`. */
function lastSevenDateKeys(endKey: string): string[] {
  const [y, m, d] = endKey.split("-").map(Number);
  if (!y || !m || !d) return [];
  const end = new Date(y, m - 1, d);
  const out: string[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dt = new Date(end);
    dt.setDate(end.getDate() - i);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out;
}

const SHORT_DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatShortDay(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return "";
  return SHORT_DAY[new Date(y, m - 1, d).getDay()] ?? "";
}

export function TodayWeekSidebar({
  byDay,
  calorieTarget,
  activeDateKey,
  todayDateKey,
  onSelectDayKey,
  className,
}: TodayWeekSidebarProps) {
  const dateKeys = lastSevenDateKeys(todayDateKey);

  return (
    <aside
      className={cn(
        "rounded-card border border-border bg-card p-3",
        className,
      )}
      aria-label="Last 7 days"
    >
      <header className="mb-2 flex items-baseline justify-between px-1">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
          Last 7 days
        </h2>
      </header>
      <ol className="space-y-0.5" role="list">
        {dateKeys.map((key) => {
          const meals = byDay[key] ?? [];
          const calories = meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
          const pct = calorieTarget > 0 ? Math.min(calories / calorieTarget, 1) : 0;
          const isActive = key === activeDateKey;
          const isToday = key === todayDateKey;
          const isOver = calorieTarget > 0 && calories > calorieTarget;
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => onSelectDayKey(key)}
                aria-current={isActive ? "true" : undefined}
                aria-label={`${formatShortDay(key)}, ${Math.round(calories)} of ${calorieTarget} kcal`}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
                  isActive
                    ? "bg-primary/[0.08]"
                    : "hover:bg-muted/40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                )}
              >
                {/* Day label — three letters, fixed width for clean
                    column alignment across rows. */}
                <span
                  className={cn(
                    "w-9 shrink-0 text-[12px] font-semibold tabular-nums",
                    isActive ? "text-primary" : "text-foreground",
                  )}
                >
                  {formatShortDay(key)}
                </span>

                {/* Today tag — sits between day label and the bar
                    when the row IS today AND not the active selection
                    (active selection has its own visual). */}
                {isToday && !isActive ? (
                  <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    Today
                  </span>
                ) : null}

                {/* Calorie bar — success green for in-range,
                    destructive red for over-target. */}
                <div className="relative h-2 flex-1 min-w-0 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${pct * 100}%`,
                      background: isOver ? "var(--destructive)" : "var(--success)",
                    }}
                  />
                </div>

                {/* Calorie total — small tabular text right-aligned,
                    or em-dash when nothing logged for the day. */}
                <span
                  className={cn(
                    "w-12 shrink-0 text-right text-[10px] tabular-nums",
                    calories === 0 ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {calories === 0 ? "—" : Math.round(calories)}
                </span>

                {/* Chevron only on the active row to avoid a column
                    of 7 chevrons (visual noise). */}
                {isActive ? (
                  <ChevronRight
                    width={12}
                    height={12}
                    className="shrink-0 text-primary"
                    aria-hidden
                  />
                ) : (
                  <span className="w-3 shrink-0" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

export default TodayWeekSidebar;
