"use client";

/**
 * TodayDesktopFrame — desktop chrome around the existing
 * `<NutritionTracker>`. At the `lg:` breakpoint (>=1024px) it adds:
 *
 *  1. A slim breadcrumb bar (Track · Today · {weekday, date}).
 *  2. The household glance bar (`<TodayHouseholdGlanceBar>`) as
 *     full-width chrome above the tracker.
 *  3. An extra right-rail card — the null-unless-data
 *     `<TodayAppleHealthCard>` — passed into the tracker's OWN rail
 *     via its `railExtra` seam.
 *
 * Below `lg:` the chrome is hidden and the tracker renders exactly as
 * it does without the frame, so the single-column mobile-web flow is
 * preserved. The sidebar already handles its own `md:` visibility;
 * the desktop frame is additive, not a replacement.
 *
 * ENG-1495 geometry (single-rail — the rework that earned default-ON):
 *  - The ENG-1494 frame wrapped the tracker in a second `lg:grid-cols-3`
 *    with its own aside. But `<NutritionTracker>` ALREADY splits at
 *    `lg:` (main `lg:max-w-[480px]` + 300px `TodayDesktopRightRail`),
 *    so the outer grid squeezed the hero column to ~316px at 1280px.
 *    The frame now renders NO grid, NO aside — the tracker's rail is
 *    the only rail, and frame extras append into it via `railExtra`.
 *  - The full `HouseholdPanel` (which mounted above the tracker and
 *    pushed the calorie ring ~1100px below the fold at 1280×800,
 *    violating the Today-centre decision) is gone — household context
 *    is the slim glance bar, which reads from `HouseholdContext`
 *    (zero extra queries) and routes to Household settings.
 *  - `TodayWeeklyInsightCard` is DELETED — the tracker's own THIS WEEK
 *    card (`TodayDesktopRightRail`) already covers it.
 *
 * Data sources:
 *  - Activity + basal burn come from `AppDataContext` (the same hooks
 *    `<NutritionTracker>` consumes, so the rail can't disagree with
 *    the main canvas).
 *  - Steps + latest weight are read directly from `profiles` because
 *    `AppDataContext` doesn't expose them yet. `<NutritionTracker>`
 *    does the same fetch; both are idempotent reads against the same
 *    row so there's no write-race risk. Absent/failed values stay
 *    null — the Apple Health card simply doesn't render without at
 *    least one real datum.
 */

import { useEffect, useState } from "react";
import { NutritionTracker } from "./NutritionTracker";
import { FeatureErrorBoundary } from "./FeatureErrorBoundary";
import { TodayAppleHealthCard } from "./suppr/today-apple-health-card";
import { TodayHouseholdGlanceBar } from "./suppr/today-household-glance-bar";
import { useAppData } from "../../context/AppDataContext";
import { useAuthSession } from "../../context/AuthSessionContext";
import { supabase } from "../../lib/supabase/browserClient";
import type { UserTier } from "../../types/recipe";
import { parseDateKey, todayKey } from "../../lib/nutrition/trackerDate";

export interface TodayDesktopFrameProps {
  userTier: UserTier;
  onOpenProgress?: () => void;
  /** ENG-1494 — forwarded to the tracker's settings avatar. */
  onOpenSettings?: () => void;
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

export function TodayDesktopFrame({ userTier, onOpenProgress, onOpenSettings }: TodayDesktopFrameProps) {
  const {
    selectedDateKey,
    activityBurnByDay,
    basalBurnByDay,
    profileMeasurementSystem,
  } = useAppData();
  const { authedUserId } = useAuthSession();

  // Default the breadcrumb to "today" when the user hasn't navigated
  // to a past/future day yet. `selectedDateKey` is the source of
  // truth once the user interacts with the date header.
  const breadcrumbKey = selectedDateKey || todayKey();

  const [stepsByDay, setStepsByDay] = useState<Record<string, number>>({});
  const [latestWeightKg, setLatestWeightKg] = useState<number | null>(null);

  // Mirrors the `profiles` read inside `<NutritionTracker>` for the
  // fields the Apple Health rail card needs. Idempotent read-only
  // query; runs once per authed session. Failures leave the values
  // null — the card doesn't render without real data, and the main
  // canvas already surfaces offline / error states.
  useEffect(() => {
    if (!authedUserId) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("steps_by_day, weight_kg")
          .eq("id", authedUserId)
          .maybeSingle();
        if (cancelled || !data) return;
        setStepsByDay(
          parseStepsDayMap((data as { steps_by_day?: unknown }).steps_by_day),
        );
        const w = (data as { weight_kg?: number | null }).weight_kg;
        const wN = w != null ? Number(w) : NaN;
        setLatestWeightKg(Number.isFinite(wN) && wN > 0 ? wN : null);
      } catch {
        // Swallow — the Health card hides itself without data.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authedUserId]);

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
          carry the date context, same as today. `product-shell` keeps
          the chrome on the same column grid as the tracker's own
          shell (the old `px-6` drifted off it). */}
      <nav
        aria-label="Breadcrumb"
        className="product-shell hidden lg:flex items-center gap-1.5 pt-5 pb-1 text-xs text-muted-foreground"
      >
        <span>Track</span>
        <span aria-hidden>·</span>
        <span className="text-foreground font-medium">Today</span>
        <span aria-hidden>·</span>
        <span>{formatBreadcrumbDate(breadcrumbKey)}</span>
      </nav>

      {/* Household glance bar — desktop only, full-width chrome above
          the tracker. Renders nothing for solo users (the bar hides
          itself). On narrower widths household stays on the Plan tab
          where it's always lived. */}
      <div className="product-shell hidden lg:block pt-3">
        <TodayHouseholdGlanceBar />
      </div>

      {/* The tracker IS the layout — it already splits into main
          column + right rail at `lg:`. The frame only appends the
          Apple Health card into that rail. */}
      <FeatureErrorBoundary feature="Nutrition Tracker">
        <NutritionTracker
          userTier={userTier}
          onOpenProgress={onOpenProgress}
          onOpenSettings={onOpenSettings}
          railExtra={
            <TodayAppleHealthCard
              stepsForSelectedDay={stepsForSelectedDay}
              activeEnergyKcal={activeEnergyKcal}
              restingBurnKcal={restingBurnKcal}
              latestWeightKg={latestWeightKg}
              useImperial={profileMeasurementSystem === "imperial"}
            />
          }
        />
      </FeatureErrorBoundary>
    </div>
  );
}
