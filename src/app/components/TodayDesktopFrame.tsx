"use client";

/**
 * TodayDesktopFrame — wraps the existing `<NutritionTracker>` for the
 * 2026-04-20 Claude Design desktop prototype Grace sent. At the `lg:`
 * breakpoint (>=1024px) it renders:
 *
 *  1. A slim breadcrumb bar (Track · Today · {weekday, date}).
 *  2. A household card at the top of the main canvas.
 *  3. A two-column body: the full `<NutritionTracker>` in the left
 *     ~2/3 column, and a right-rail stack (Weekly Insight + Apple
 *     Health Today) in the right ~1/3 column.
 *
 * Below `lg:` — i.e. tablet and mobile-web — the frame renders only
 * `<NutritionTracker>` so the existing single-column flow is
 * preserved. The sidebar already handles its own `md:` visibility;
 * the desktop frame is additive, not a replacement.
 *
 * Data sources:
 *  - Nutrition + activity burn + meal plan come from `AppDataContext`
 *    (the same hooks `<NutritionTracker>` consumes, so the right rail
 *    can't disagree with the main canvas).
 *  - Steps + latest weight are read directly from `profiles` because
 *    `AppDataContext` doesn't expose them yet. `<NutritionTracker>`
 *    does the same fetch; both are idempotent reads against the same
 *    row so there's no write-race risk. When the read fails or the
 *    values are absent the cards show "—" placeholders (no faux zeros).
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { NutritionTracker } from "./NutritionTracker";
import { FeatureErrorBoundary } from "./FeatureErrorBoundary";
import { AppLoadingSkeleton } from "./AppLoadingSkeleton";
import { TodayWeeklyInsightCard } from "./suppr/today-weekly-insight-card";
import { TodayAppleHealthCard } from "./suppr/today-apple-health-card";
import { useAppData } from "../../context/AppDataContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import { supabase } from "../../lib/supabase/browserClient";
import type { UserTier } from "../../types/recipe";
import { normalizeMacroTargets } from "../../types/profile";
import { parseDateKey, todayKey } from "../../lib/nutrition/trackerDate";

const HouseholdPanel = dynamic(
  () => import("./HouseholdPanel").then((m) => ({ default: m.HouseholdPanel })),
  { ssr: false },
);

export interface TodayDesktopFrameProps {
  userTier: UserTier;
  onOpenProgress?: () => void;
}

/**
 * Seven date keys (YYYY-MM-DD) for the selected week, aligned to the
 * user's week-start preference. Mirrors the rolling-7 computation in
 * `<NutritionTracker>` so the insight card's bars represent the same
 * week as the main canvas.
 */
function buildWeekKeys(anchorKey: string, weekStartDay: "monday" | "sunday"): string[] {
  const anchor = parseDateKey(anchorKey) ?? new Date();
  const dayOfWeek = anchor.getDay(); // 0=Sun ... 6=Sat
  const startOffset = weekStartDay === "monday" ? (dayOfWeek + 6) % 7 : dayOfWeek;
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - startOffset);
  const keys: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    keys.push(`${yyyy}-${mm}-${dd}`);
  }
  return keys;
}

function formatBreadcrumbDate(dateKey: string): string {
  const d = parseDateKey(dateKey) ?? new Date();
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function parseStepsDayMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n) && n >= 0) out[k] = Math.round(n);
  }
  return out;
}

export function TodayDesktopFrame({ userTier, onOpenProgress }: TodayDesktopFrameProps) {
  const {
    selectedDateKey,
    nutritionByDay,
    activityBurnByDay,
    basalBurnByDay,
    nutritionTargets,
    profileMeasurementSystem,
  } = useAppData();
  const { authedUserId } = useAuthSession();

  // Default the breadcrumb to "today" when the user hasn't navigated
  // to a past/future day yet. `selectedDateKey` is the source of
  // truth once the user interacts with the date header.
  const breadcrumbKey = selectedDateKey || todayKey();

  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null);
  const [weekStartDay, setWeekStartDay] = useState<"monday" | "sunday">("monday");

  // Mirrors the `profiles` read inside `<NutritionTracker>` for the
  // fields the right rail needs. Idempotent read-only query; runs
  // once per authed session. Failures fall back to "—" placeholders —
  // we deliberately don't toast here because the main canvas already
  // surfaces offline / error states, and a second toast would be noise.
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("steps_by_day, weight_kg, week_start_day")
          .eq("id", authedUserId)
          .maybeSingle();
        if (cancelled || !data) return;
        setStepsByDay(
          parseStepsDayMap((data as { steps_by_day?: unknown }).steps_by_day),
        );
        const w = (data as { weight_kg?: number | null }).weight_kg;
        const wN = w != null ? Number(w) : NaN;
        setLatestWeightKg(Number.isFinite(wN) && wN > 0 ? wN : null);
        const wsd = (data as { week_start_day?: string }).week_start_day;
        if (wsd === "sunday" || wsd === "monday") setWeekStartDay(wsd);
      } catch {
        // Swallow — fallback to placeholder values.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

  const weekKeys = useMemo(
    () => buildWeekKeys(breadcrumbKey, weekStartDay),
    [breadcrumbKey, weekStartDay],
  );

  const weekDailyKcal = useMemo(() => {
    return weekKeys.map((k) => {
      const meals = nutritionByDay[k] ?? [];
      return meals.reduce((sum, m) => sum + (m.calories ?? 0), 0);
    });
  }, [weekKeys, nutritionByDay]);

  const loggedDaysInWeek = weekDailyKcal.filter((v) => v > 0).length;
  const weekTotalKcal = weekDailyKcal.reduce((s, v) => s + v, 0);
  const weekAvgKcal =
    loggedDaysInWeek > 0 ? Math.round(weekTotalKcal / loggedDaysInWeek) : null;

  const dailyKcalTarget = normalizeMacroTargets(nutritionTargets).calories;

  // Household size is not yet exposed on the data context; until it
  // is, the insight card shows "Planning for you this week" for
  // solo accounts. Joining a household is visible via the Household
  // panel directly above — the insight line is decorative, not a
  // source of truth.
  const householdSize = 1;

  const stepsForSelectedDay = Object.prototype.hasOwnProperty.call(stepsByDay, breadcrumbKey)
    ? (stepsByDay[breadcrumbKey] ?? 0)
    : null;
  const activeEnergyKcal = Object.prototype.hasOwnProperty.call(activityBurnByDay, breadcrumbKey)
    ? Math.round(activityBurnByDay[breadcrumbKey] ?? 0)
    : null;
  const restingBurnKcal = Object.prototype.hasOwnProperty.call(basalBurnByDay, breadcrumbKey)
    ? Math.round(basalBurnByDay[breadcrumbKey] ?? 0)
    : null;

  return (
    <div className="flex flex-col">
      {/* Breadcrumb — desktop only. Muted, single-row, no actions.
          Below `lg:` we let the TodayDateHeader inside the tracker
          carry the date context, same as today. */}
      <nav
        aria-label="Breadcrumb"
        className="hidden lg:flex items-center gap-1.5 px-6 pt-5 pb-1 text-xs text-muted-foreground"
      >
        <span>Track</span>
        <span aria-hidden>·</span>
        <span className="text-foreground font-medium">Today</span>
        <span aria-hidden>·</span>
        <span>{formatBreadcrumbDate(breadcrumbKey)}</span>
      </nav>

      {/* Desktop-only household bar. On narrower widths the Household
          card stays on the Meal Plan tab where it's always lived, so
          we don't duplicate it on mobile-web Today. */}
      <div className="hidden lg:block px-6 pt-3">
        <FeatureErrorBoundary feature="Household">
          <React.Suspense fallback={<AppLoadingSkeleton label="Loading household..." />}>
            <HouseholdPanel />
          </React.Suspense>
        </FeatureErrorBoundary>
      </div>

      {/* Main body — 1-col at mobile/tablet, 2-col at `lg:`. */}
      <div className="lg:grid lg:grid-cols-3 lg:gap-6 lg:px-6 lg:pb-6">
        <div className="lg:col-span-2 min-w-0">
          <FeatureErrorBoundary feature="Nutrition Tracker">
            <NutritionTracker userTier={userTier} onOpenProgress={onOpenProgress} />
          </FeatureErrorBoundary>
        </div>

        {/* Right rail — desktop only. Hidden at < lg so we never
            show these cards duplicating data the mobile-web layout
            already renders inline (TodayStepsCard, etc.). */}
        <aside
          aria-label="Today insights"
          className="hidden lg:flex lg:flex-col lg:gap-4 lg:pt-5"
        >
          <TodayWeeklyInsightCard
            householdSize={householdSize}
            loggedDaysInWeek={loggedDaysInWeek}
            weekAvgKcal={weekAvgKcal}
            weekDailyKcal={weekDailyKcal}
            dailyKcalTarget={dailyKcalTarget}
          />
          <TodayAppleHealthCard
            stepsForSelectedDay={stepsForSelectedDay}
            activeEnergyKcal={activeEnergyKcal}
            restingBurnKcal={restingBurnKcal}
            latestWeightKg={latestWeightKg}
            useImperial={profileMeasurementSystem === "imperial"}
          />
        </aside>
      </div>
    </div>
  );
}
