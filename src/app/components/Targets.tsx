"use client";

/**
 * Targets — desktop-web content pane for the Claude Design 2026-04-20
 * prototype's Targets page. Mirrors
 * `docs/ux/claude-design-bundles/prototype/project/screens-web.jsx`
 * (`WebTargets`) and the mobile `TargetsPage` flow:
 *
 *  - Breadcrumb: Account · Targets · <Wed, 14 May>
 *  - Title "Targets" + gloss-gated TDEE subtitle · activity label (tracks
 *    `activity_level` — NOT hardcoded "moderate"; ENG-1469 gloss pairs).
 *  - 2-col top row:
 *      • LEFT: DAILY CALORIE TARGET — overline + big kcal number +
 *        "kcal / day · {deficit|surplus|maintenance} kcal ..." sub.
 *      • RIGHT: GOAL — overline + "Reach {goalKg} kg" + "Currently
 *        {currentKg} kg · could reach by ≈ {date}" sub.
 *  - Macros label.
 *  - 4-col grid of macro tiles: PROTEIN / CARBS / FAT / FIBER. Each:
 *    overline + macro lucide glyph top-right + `{current} / {target} g`
 *    + progress bar (coloured to the macro) + `{remaining} g remaining`.
 *
 * This surface reads the same source of truth as `Profile` / `Progress`:
 *  - `nutritionTargets`      from AppDataContext (the active daily plan)
 *  - `nutritionByDay`        from AppDataContext (today's logs drive the
 *                            current-macro values in each tile)
 *  - `profiles.weight_kg`    for "Currently {n} kg"
 *  - `profiles.goal_weight_kg` for "Reach {n} kg"
 *  - `profiles.weight_kg_by_day` for the projected reach-date via the
 *    shared `calcGoalTimeline` helper (same pattern as ProgressDashboard).
 *
 * The per-macro card's edit flow currently deep-links to the Profile
 * view's manual-targets editor via `onEdit(macro)` → planner page owner
 * (`App.tsx`) navigates to `profile`. A dedicated per-macro slider sheet
 * lives in `apps/mobile/app/targets.tsx`; a desktop-native editor is a
 * separate design task and is out of scope for this port.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { HelpCircle, ChevronRight, type LucideIcon } from "lucide-react";
import { MACRO_ICONS } from "../../lib/macroIconsLucide";
import { supabase } from "../../lib/supabase/browserClient.ts";
import { useAppData } from "../../context/AppDataContext.tsx";
import { useAuthSession } from "../../context/AuthSessionContext.tsx";
import { normalizeMacroTargets } from "../../types/profile.ts";
import { calcGoalTimeline, resolveLatestWeightKg } from "../../lib/weightProjection.ts";
import { todayKey } from "../../lib/nutrition/trackerDate.ts";
import { kgToLb } from "../../lib/units/imperial.ts";
import { carbsLabel, netCarbsForRow } from "../../lib/nutrition/netCarbs.ts";
import { activityLevelCaption, deficitSurplusCaption } from "../../lib/targets/targetsView.ts";
import { WhyThisNumberDialog } from "./suppr/why-this-number-dialog.tsx";
import { GoalPaceEditorDialog } from "./suppr/goal-pace-editor-dialog.tsx";
import { paceKgPerWeekFromPreset, whyThisNumberGoalFromDb } from "../../lib/nutrition/whyThisNumber.ts";
import { ENERGY_NUMBERS_V1_FLAG, selectMaintenance, type EnergyProfileRow } from "../../lib/nutrition/energyNumbers.ts";
import { MEASURED_TDEE_CHECK_IN_FLAG } from "../../lib/nutrition/measuredTdee.ts";
import type { ResolvedMaintenance } from "../../lib/nutrition/resolveMaintenance.ts";
import { TargetsMaintenanceRow } from "./suppr/targets-maintenance-row.tsx";
import { isFeatureEnabled } from "../../lib/analytics/track.ts";
import { useSettingsWinMoment } from "../../lib/preferences/useSettingsWinMoment.ts";
import { TARGETS_HOW_CALCULATED_CAPTION_GLOSS, TARGETS_HOW_CALCULATED_CAPTION_PLAIN, TARGETS_RECALIBRATE_FOOTNOTE_TAIL_GLOSS, TARGETS_RECALIBRATE_FOOTNOTE_TAIL_PLAIN, TARGETS_SUBTITLE_STATIC_TDEE_GLOSS, TARGETS_SUBTITLE_STATIC_TDEE_PLAIN } from "../../lib/onboarding/figmaCopy.ts";

export interface TargetsProps {
  /**
   * Navigate the whole app somewhere else. Used for the per-macro tile
   * edit affordance and the "edit goal" CTA — both currently deep-link
   * into the `profile` view's manual-targets editor. Kept around for
   * callers who want the full view-name flexibility.
   */
  onNavigate?: (view: string) => void;
  /** Back affordance (e.g. on mobile-web / narrow viewports). */
  onBack?: () => void;
  /** Tap a macro tile → deep link into the Profile manual-targets editor. */
  onEdit?: () => void;
}

type MacroTileMeta = {
  key: "protein" | "carbs" | "fat" | "fiber";
  label: string;
  Icon: LucideIcon;
  /** Current intake (g) — today's logged macro value. */
  current: number;
  /** Target (g). */
  target: number;
  /** CSS var for the progress fill + icon colour. */
  fillVar: string;
};

function parseNumMap(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

// Numbers audit 2026-05-04 #18: web previously had its own
// ACTIVITY_LABEL with different wording from mobile (`light` →
// "lightly active" vs "light activity"; `active` → "very active" vs
// "active lifestyle"). Same `activity_level=active` rendered as
// "very active" on web but "active lifestyle" on mobile — the same
// level read as a different intensity bucket on each surface. Now both
// platforms route through `activityLevelCaption` from the shared
// `targetsView` helper.

export function Targets({ onNavigate, onBack, onEdit }: TargetsProps) {
  // `onBack` kept for future mobile-web narrow-width treatment; not
  // rendered by the desktop-content-pane port (sidebar + breadcrumb
  // already anchor location). Silence the unused warning without
  // dropping the prop from the public shape.
  void onBack;
  // ENG goal-editor (2026-05-25): when the `goal-editor` flag is on, the
  // Goal card's edit affordance opens the in-place "Edit goal & pace"
  // dialog (recompute + goal-weight). When off, it keeps the old
  // behaviour — deep-link to the Profile screen (which has no goal
  // control, the gap this feature closes). The flag gates only the new
  // UI entry; the recompute logic itself is unconditional.
  const goalEditorEnabled = isFeatureEnabled("goal_editor");
  // ENG-1469 — Targets gloss (ENG-1461 follow-up); pairs in figmaCopy.ts.
  const glossOn = isFeatureEnabled("onboarding_jargon_gloss_v1");
  const energyNumbersOn = isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG); // ENG-1506 review round — tracked separately from `resolvedMaint` (null is ambiguous: off vs on-but-rejected); ON-null renders the honest empty state, never the rejected raw read
  const [goalEditorOpen, setGoalEditorOpen] = useState(false);
  // ENG-824 — quiet win-moment (win-colour wash on the calorie card) when
  // targets are saved via the goal/pace editor. Gated behind
  // `redesign_winmoment`; inert when off. Web parity with the mobile hook.
  const winMoment = useSettingsWinMoment();
  // Goal / pace edit affordance (Goal card, "Set a goal", "Why this
  // number" → Adjust). Opens the in-place editor when the flag is on,
  // else deep-links to the Profile screen.
  const goEdit = () => {
    if (goalEditorEnabled) {
      setGoalEditorOpen(true);
      return;
    }
    if (onEdit) onEdit();
    else onNavigate?.("profile");
  };
  // Macro tiles (incl. Fibre) ALWAYS route to the manual /profile editor —
  // the goal editor recomputes macros from goal/pace but doesn't own the
  // fibre goal or per-macro overrides. The `goal-editor` flag had orphaned
  // this path; macro tiles restore it directly (thread C, target-recompute
  // unification 2026-05-26).
  const goEditMacros = () => {
    if (onEdit) onEdit();
    else onNavigate?.("profile");
  };
  const { nutritionTargets, nutritionByDay, profileMeasurementSystem, netCarbsLensEnabled, preferActivityAdjustedCalories, refreshProfileBasics } = useAppData();
  const { authedUserId } = useAuthSession();

  const [weightKg, setWeightKg] = useState<number | null>(null);
  const [goalWeightKg, setGoalWeightKg] = useState<number | null>(null);
  const [weightKgByDay, setWeightKgByDay] = useState<Record<string, number>>({});
  const [activityLevel, setActivityLevel] = useState<string>("moderate");
  const [maintenanceTdee, setMaintenanceTdee] = useState<number | null>(null);
  // 2026-05-12 round 4 (web parity with mobile Targets): hydrate the
  // inputs the WhyThisNumberDialog needs. confidence drives the
  // "calibrating / early estimate / strong estimate" copy; plan_pace
  // + goal drive the "Lose / Maintain / Gain" line.
  const [adaptiveTdeeConfidence, setAdaptiveTdeeConfidence] = useState<string | null>(null);
  const [profileGoal, setProfileGoal] = useState<string | null>(null);
  const [profilePlanPace, setProfilePlanPace] = useState<string | null>(null);
  // ENG-1506 — RESOLVED maintenance (full gates + canonical inputs), set only
  // behind `energy_numbers_v1`; replaces the legacy raw-adaptive read.
  const [resolvedMaint, setResolvedMaint] = useState<ResolvedMaintenance | null>(null);
  const [whyOpen, setWhyOpen] = useState(false);

  // Extracted so the goal-editor `onSaved` callback can re-run it after a
  // save — the goal card's goal/goalWeight/plan_pace must refresh in
  // place once the user changes their plan (mirrors the mobile sheet's
  // onSaved → reload contract). `cancelled` is optional so the manual
  // re-run from onSaved doesn't need a sentinel.
  const loadGoalProfile = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!authedUserId) return;
      const { data, error } = await supabase
        .from("profiles")
        .select(
          // ENG-1506 — basics + updated_at + measured_* for the full gate set.
          "weight_kg, goal_weight_kg, weight_kg_by_day, sex, age, height_cm, activity_level, adaptive_tdee, adaptive_tdee_confidence, adaptive_tdee_updated_at, measured_tdee, measured_tdee_confidence, measured_tdee_updated_at, goal, plan_pace",
        )
        .eq("id", authedUserId)
        .maybeSingle();
      if (error || !data || signal?.cancelled) return;
      setResolvedMaint(isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG) ? selectMaintenance(data as EnergyProfileRow, { enableMeasured: isFeatureEnabled(MEASURED_TDEE_CHECK_IN_FLAG) }) : null);
      const w = data.weight_kg != null ? Number(data.weight_kg) : null;
      const gw = data.goal_weight_kg != null ? Number(data.goal_weight_kg) : null;
      setWeightKg(Number.isFinite(w) ? w : null);
      setGoalWeightKg(Number.isFinite(gw) ? gw : null);
      setWeightKgByDay(parseNumMap((data as { weight_kg_by_day?: unknown }).weight_kg_by_day));
      const act = (data as { activity_level?: string }).activity_level;
      if (act === "sedentary" || act === "light" || act === "moderate" || act === "active" || act === "very_active") {
        setActivityLevel(act);
      }
      const aTdee = (data as { adaptive_tdee?: unknown }).adaptive_tdee;
      const aConf = (data as { adaptive_tdee_confidence?: string }).adaptive_tdee_confidence;
      // Use adaptive TDEE when the confidence bucket is meaningful
      // (same guard `getEffectiveTDEE` applies in Progress). When it's
      // absent or low we leave `maintenanceTdee` null and fall back to
      // "deficit/surplus from target" inference in the subline below.
      if (typeof aTdee === "number" && Number.isFinite(aTdee) && (aConf === "high" || aConf === "medium")) {
        setMaintenanceTdee(aTdee);
      }
      setAdaptiveTdeeConfidence(typeof aConf === "string" ? aConf : null);
      const g = (data as { goal?: string }).goal;
      setProfileGoal(typeof g === "string" ? g : null);
      const pp = (data as { plan_pace?: string }).plan_pace;
      setProfilePlanPace(typeof pp === "string" ? pp : null);
    },
    [authedUserId],
  );

  useEffect(() => {
    if (!authedUserId) return;
    const signal = { cancelled: false };
    void loadGoalProfile(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [authedUserId, loadGoalProfile]);

  const targets = useMemo(() => normalizeMacroTargets(nutritionTargets), [nutritionTargets]);

  // Today's logged macros — drives the "N / target g" value on each
  // macro tile. Mirrors `today-dashboard-macro-tiles.tsx` so the two
  // surfaces stay in lockstep for the same day.
  const todayMacros = useMemo(() => {
    const key = todayKey();
    const meals = nutritionByDay[key] ?? [];
    let protein = 0;
    let carbs = 0;
    let fat = 0;
    let fiber = 0;
    for (const m of meals) {
      protein += m.protein ?? 0;
      carbs += m.carbs ?? 0;
      fat += m.fat ?? 0;
      fiber += m.fiberG ?? 0;
    }
    return { protein, carbs, fat, fiber };
  }, [nutritionByDay]);

  const todayCrumbLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  }, []);

  // Numbers audit 2026-05-04 #17: "500 kcal deficit" / "500 kcal
  // surplus" / "maintenance" line was computed inline on web with
  // integer rounding + ±100 maintenance-band, while mobile (via the
  // shared `deficitSurplusCaption`) used nearest-50 rounding + ±50 band.
  // Same target/maintenance produced different captions on web vs
  // mobile — at delta=75 mobile said "100 kcal deficit", web said
  // "kcal / day" (suppressed). Now both platforms share the helper.
  // Goal arg currently doesn't change output text — passed null.
  const calorieSubline = useMemo(() => {
    const cal = targets.calories;
    if (!Number.isFinite(cal) || cal <= 0) return "kcal / day";
    // ENG-1506 — flag ON: delta vs the SAME resolved maintenance the row shows,
    // basis named; ON + null resolver: NO caption; OFF: legacy raw-adaptive read.
    const fragment = deficitSurplusCaption({
      targetCalories: cal,
      tdeeKcal: energyNumbersOn ? (resolvedMaint?.kcal ?? null) : maintenanceTdee,
      vsCurrentMaintenance: resolvedMaint != null,
    });
    if (fragment) return `kcal / day · ${fragment}`;
    return "kcal / day";
  }, [targets.calories, maintenanceTdee, resolvedMaint, energyNumbersOn]);

  // Numbers audit 2026-05-04 #1 (cross-platform parity): "current weight"
  // must mirror Progress + mobile Targets, both of which read the latest
  // entry in `weight_kg_by_day` (Health Sync writes the by-day map first;
  // `profile.weight_kg` lags). Without this, web Targets shows the stale
  // value while web Progress and every mobile surface show the fresh one
  // — the original symptom from full-sweep audit #5.
  const latestWeightKg = useMemo(
    () => resolveLatestWeightKg(weightKgByDay, weightKg),
    [weightKgByDay, weightKg],
  );

  // Projected reach-date: use the same shared `calcGoalTimeline` helper
  // Progress uses. When we don't have enough weight history to infer a
  // trend, we suppress the estimate (honest empty state) rather than
  // invent a linear default.
  const projectedDateLabel = useMemo<string | null>(() => {
    if (latestWeightKg == null || goalWeightKg == null) return null;
    if (latestWeightKg === goalWeightKg) return "You are at your goal";
    const timeline = calcGoalTimeline({
      currentWeightKg: latestWeightKg,
      goalWeightKg,
      weightKgByDay,
    });
    if (timeline.daysToGoal == null) {
      if (timeline.cappedAtMaxDays) return "more than a year at current rate";
      return null;
    }
    const d = new Date();
    d.setDate(d.getDate() + timeline.daysToGoal);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "long" });
  }, [latestWeightKg, goalWeightKg, weightKgByDay]);

  const formatWeight = (kg: number): string => {
    if (profileMeasurementSystem === "imperial") {
      return `${Math.round(kgToLb(kg) * 10) / 10} lb`;
    }
    return `${Math.round(kg * 10) / 10} kg`;
  };

  const macroTiles: MacroTileMeta[] = useMemo(
    () => [
      {
        key: "protein",
        label: "Protein",
        Icon: MACRO_ICONS.protein,
        current: todayMacros.protein,
        target: targets.protein,
        fillVar: "var(--macro-protein)",
      },
      {
        key: "carbs",
        // Numbers audit 2026-05-04 #7: web Targets carb tile previously
        // showed gross carbs target/value regardless of the net-carbs
        // lens. Mobile Targets fixed this on 2026-04-30; web was missed.
        // With lens on the user saw gross carbs on Targets while every
        // other web surface (Today macro tile, Recipe detail) showed net.
        // Mirror the mobile rule: subtract fibre from both `current` and
        // `target` when the lens is on (using `netCarbsForRow`), and use
        // the *target* fibre value as label arbiter so the label doesn't
        // flicker to "Carbs" while no fibre has been logged yet (cf. #8).
        label: carbsLabel(targets.fiber, netCarbsLensEnabled),
        Icon: MACRO_ICONS.carbs,
        current: netCarbsForRow(todayMacros.carbs, todayMacros.fiber, netCarbsLensEnabled),
        target: netCarbsForRow(targets.carbs, targets.fiber, netCarbsLensEnabled),
        fillVar: "var(--macro-carbs)",
      },
      {
        key: "fat",
        label: "Fat",
        Icon: MACRO_ICONS.fat,
        current: todayMacros.fat,
        target: targets.fat,
        fillVar: "var(--macro-fat)",
      },
      {
        key: "fiber",
        label: "Fiber",
        Icon: MACRO_ICONS.fiber,
        current: todayMacros.fiber,
        target: targets.fiber,
        fillVar: "var(--success)",
      },
    ],
    [todayMacros, targets, netCarbsLensEnabled],
  );

  return (
    <div className="max-w-5xl mx-auto px-pm-6 py-pm-5">
      {/* Breadcrumb (desktop-only) */}
      <nav
        aria-label="Breadcrumb"
        className="hidden md:flex items-center gap-1.5 text-[13px] text-muted-foreground mb-3"
      >
        <span>Account</span>
        <span aria-hidden>·</span>
        <span className="font-semibold text-foreground">Targets</span>
        <span aria-hidden>·</span>
        <span className="tabular-nums">{todayCrumbLabel}</span>
      </nav>

      {/* Title + subtitle */}
      <div className="mb-5">
        <h1 className="text-[24px] md:text-[28px] font-bold text-foreground -tracking-[0.02em]">
          Targets
        </h1>
        <p className="text-[13px] text-muted-foreground mt-1">
          {glossOn ? TARGETS_SUBTITLE_STATIC_TDEE_GLOSS : TARGETS_SUBTITLE_STATIC_TDEE_PLAIN} · {activityLevelCaption(activityLevel)}
        </p>
      </div>

      {/* Top row: Daily calorie target + Goal */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-6">
        {/* Daily calorie target — 2026-04-30 audit visual-qa P1 #10:
            mirror the onboarding reveal's gradient ring and the mobile
            Targets screen (`apps/mobile/app/targets.tsx` L422-470) so
            the "what's my target" surface has the same premium-tier
            visual ceiling as the first-time delight moment. The ring
            renders at 100% (full sweep) since this is a target display,
            not a progress display — Today owns the "how am I doing"
            view. Gradient id (`targets-ring-gradient`) is distinct from
            the daily-ring gradient to avoid SVG id collision when both
            mount together. */}
        <div
          data-testid="targets-calorie-card"
          className={`bg-card border rounded-2xl p-5 shadow-sm flex flex-col items-center transition-colors duration-500 ${winMoment.flashClass || "border-border"}`}
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground self-start">
            Daily calorie target
          </p>
          <div
            // Audit 2026-04-30 visual-qa P2 #15 — fixed 200x200px box
            // overflowed narrow mobile-web viewports. `max-w-full` lets
            // it shrink, `aspect-square` keeps the ring round, and the
            // SVG's `viewBox` already handles the inner scaling.
            className="relative my-3 w-[200px] max-w-full h-auto aspect-square"
          >
            <svg
              width="100%"
              height="100%"
              viewBox="0 0 200 200"
              preserveAspectRatio="xMidYMid meet"
              className="absolute inset-0 -rotate-90"
            >
              <defs>
                {/* Decorative target-display ring (always a full 100% sweep —
                    NOT the calorie progress ring, which keeps its plum state in
                    `daily-ring.tsx`). Brand-manager 2026-06-08: the functional
                    accent is clay; this ring must tint from it, never hardcode
                    plum/damson. Sources `--primary` (clay) so it stays in
                    lockstep with the accent token. Mirrors mobile's
                    `accent.primaryLight → accent.primary` clay gradient. */}
                <linearGradient id="targets-ring-gradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="var(--primary)" />
                  <stop offset="1" stopColor="var(--primary-solid)" />
                </linearGradient>
              </defs>
              <circle
                cx={100}
                cy={100}
                r={84}
                stroke="var(--ring-bg)"
                strokeWidth={10}
                fill="none"
              />
              <circle
                cx={100}
                cy={100}
                r={84}
                stroke="url(#targets-ring-gradient)"
                strokeWidth={10}
                fill="none"
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* SLOE Phase 0: hero calorie numeral reads in Newsreader serif
                  (design system reserves big numerals for serif). `.font-display`
                  is the canonical serif-numeral opt-in (same class the Progress
                  adherence + Today display numerals use). Drop the sans
                  `font-extrabold`; the serif carries its own weight at 48px.
                  Mirrors mobile `Type.ringValue`. */}
              <span className="font-display text-[48px] font-normal text-foreground tabular-nums -tracking-[0.03em] leading-none">
                {targets.calories > 0 ? targets.calories.toLocaleString("en-US") : "—"}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums mt-1">
                kcal / day
              </span>
            </div>
          </div>
          <p className="text-[13px] text-muted-foreground mt-1 text-center">{calorieSubline}</p>
          {/* ENG-1506 — MAINTENANCE row + qualifier (flag-gated via resolvedMaint). */}
          {resolvedMaint ? <TargetsMaintenanceRow resolved={resolvedMaint} /> : null}
          {/* Numbers audit 2026-05-04 #3 — see mobile Targets for the
              same breadcrumb. When activity-adjustment is on, Today's
              ring goal silently adds an active-burn bonus on top of
              this static base, which a user can mis-read as a number
              divergence. */}
          {preferActivityAdjustedCalories ? (
            <p className="text-[11px] text-muted-foreground mt-1 text-center">
              Today&apos;s goal adjusts upward by your active-burn calories.
            </p>
          ) : null}
          {/* 2026-05-12 (premium-bar audit web parity, DC14 polish):
              amber safety-floor warning when the calorie target is
              below the 1,200 kcal threshold we enforce in the weekly
              check-in safety helper. Mobile parity with
              `apps/mobile/app/profile.tsx`. Without this warning, a
              user who manually set a sub-floor target has no signal
              from this screen that the number is below recommended
              adult intake. */}
          {targets.calories > 0 && targets.calories < 1200 ? (
            <div
              role="alert"
              aria-label="Calorie target is below the 1,200 kcal safety floor we recommend."
              className="mt-3 mx-auto max-w-md rounded-xl border border-warning/40 bg-warning/10 px-3.5 py-2.5 flex items-start gap-2"
              data-testid="targets-safety-floor-warning"
            >
              <span
                aria-hidden
                className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-warning shrink-0"
              />
              <p className="text-[11px] text-foreground leading-snug flex-1">
                <span className="font-bold">Below 1,200 kcal.</span> This is
                under the safety floor we recommend for adults. Consider
                raising your target — or talk to a clinician if a lower
                target is medically necessary.
              </p>
            </div>
          ) : null}
        </div>

        {/* Goal */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
            Goal
          </p>
          {goalWeightKg != null ? (
            <>
              {/* ENG-534 (2026-05-16): goal-weight + current-weight are
                  HIGH-class. Mask the actual numbers so session-replay
                  renders them as grey blocks; keep the surrounding
                  copy + projected-date label visible. */}
              <p className="text-[18px] font-bold text-foreground mt-2">
                Reach <span className="ph-mask">{formatWeight(goalWeightKg)}</span>
              </p>
              <p className="text-[13px] text-muted-foreground mt-1">
                {latestWeightKg != null ? (
                  <>Currently <span className="ph-mask">{formatWeight(latestWeightKg)}</span></>
                ) : (
                  "Log a weight to start tracking"
                )}
                {projectedDateLabel ? ` · could reach by ≈ ${projectedDateLabel}` : ""}
              </p>
            </>
          ) : (
            <>
              <p className="text-[18px] font-bold text-foreground mt-2">No goal set</p>
              <p className="text-[13px] text-muted-foreground mt-1">
                Add a goal weight in your profile to see a projected reach-date.
              </p>
              <button
                type="button"
                onClick={goEdit}
                className="mt-3 inline-flex items-center text-[13px] font-semibold text-primary-solid hover:underline"
              >
                Set a goal →
              </button>
            </>
          )}
        </div>
      </div>

      {/* Macros section label */}
      <div className="mb-3">
        <h2 className="text-[13px] font-bold text-foreground -tracking-[0.01em]">Macros</h2>
      </div>

      {/* Macro tiles — 4 across on desktop, 2 across on sm, 1 on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {macroTiles.map((tile) => {
          const pct =
            tile.target > 0 ? Math.min(100, Math.round((tile.current / tile.target) * 100)) : 0;
          const remaining = Math.max(0, Math.round(tile.target - tile.current));
          const over = Math.max(0, Math.round(tile.current - tile.target));
          const remainingCaption = over > 0 ? `${over} g over` : `${remaining} g remaining`;
          const { Icon } = tile;
          return (
            <button
              key={tile.key}
              type="button"
              onClick={goEditMacros}
              aria-label={`Edit ${tile.label} target`}
              className="group text-left bg-card border border-border rounded-2xl p-4 shadow-sm hover:border-primary/40 hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  {tile.label}
                </span>
                <Icon
                  size={16}
                  strokeWidth={1.75}
                  style={{ color: tile.fillVar }}
                  aria-hidden
                />
              </div>
              <div className="flex items-baseline">
                {/* SLOE Phase 0: macro target numerals read in Newsreader serif
                    on the Targets review surface (parity with mobile). The
                    serif `.font-display` replaces the sans `font-bold`. */}
                <span className="font-display text-[22px] font-normal tabular-nums text-foreground -tracking-[0.02em]">
                  {Math.round(tile.current)}
                </span>
                <span className="text-xs text-muted-foreground ml-1">/ {tile.target} g</span>
              </div>
              <div className="mt-2.5 h-[5px] rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-[width] duration-700"
                  style={{ width: `${pct}%`, background: tile.fillVar }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 tabular-nums">
                {remainingCaption}
              </p>
            </button>
          );
        })}
      </div>

      {/* 2026-05-12 round 4 (Grace TF, web parity with mobile): "Why this
          number?" moved off Today's hero ring (low-confidence signal);
          explainer lives here now, same row treatment as mobile. */}
      <button
        type="button"
        onClick={() => setWhyOpen(true)}
        data-testid="targets-how-is-this-calculated"
        aria-label="How is this calculated? Open calorie target explanation"
        className="flex items-center gap-3 w-full max-w-3xl rounded-2xl border border-border bg-card hover:bg-accent/30 transition-colors px-4 py-3.5 mb-pm-3 text-left"
      >
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary-solid shrink-0">
          <HelpCircle size={14} strokeWidth={2} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[13px] font-semibold text-foreground">
            How is this calculated?
          </span>
          <span className="block text-[11px] text-muted-foreground mt-0.5">
            {glossOn ? TARGETS_HOW_CALCULATED_CAPTION_GLOSS : TARGETS_HOW_CALCULATED_CAPTION_PLAIN}
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={1.75} className="text-muted-foreground shrink-0" />
      </button>

      <p className="text-[11px] text-muted-foreground leading-relaxed max-w-3xl">
        Projections assume your recent trend continues. Targets update when you edit your plan or{" "}
        {glossOn ? TARGETS_RECALIBRATE_FOOTNOTE_TAIL_GLOSS : TARGETS_RECALIBRATE_FOOTNOTE_TAIL_PLAIN}
      </p>

      <WhyThisNumberDialog
        open={whyOpen}
        onOpenChange={setWhyOpen}
        targetCalories={targets.calories}
        // ENG-1506 — ON: resolved basis/confidence/source (null → honest calibrating copy, formula wording honest — never the raw read the resolver rejected); OFF: legacy reads.
        maintenanceTdee={energyNumbersOn ? (resolvedMaint?.kcal ?? null) : maintenanceTdee}
        confidence={energyNumbersOn ? (resolvedMaint?.confidence ?? null)
          : adaptiveTdeeConfidence === "low" || adaptiveTdeeConfidence === "medium" || adaptiveTdeeConfidence === "high"
            ? adaptiveTdeeConfidence : null}
        source={energyNumbersOn ? (resolvedMaint?.source ?? null) : null}
        loggingDays={null}
        // ENG-1507 — shared normaliser; unknown goal → "Goal not set", never "lose".
        goal={whyThisNumberGoalFromDb(profileGoal)}
        paceKgPerWeek={paceKgPerWeekFromPreset(profilePlanPace, whyThisNumberGoalFromDb(profileGoal))}
        mealLogDays={null}
        weightLogCount={Object.keys(weightKgByDay).length}
        onAdjustTarget={() => {
          setWhyOpen(false);
          // When the goal editor is live, "Adjust target" opens it in
          // place rather than deep-linking to Profile (no goal control).
          if (goalEditorEnabled) {
            setGoalEditorOpen(true);
          } else {
            onNavigate?.("profile");
          }
        }}
      />

      {/* ENG goal-editor (2026-05-25): the post-onboarding "Edit goal &
          pace" editor. Reachable from the Goal card's edit affordance and
          the "Why this number" adjust action. Recompute + goal-weight +
          provenance all run through the shared `persistRecomputedTargets`
          helper. On save we refresh both the AppData targets (calorie +
          macro tiles) and this screen's local goal/goalWeight/plan_pace
          state so the change shows in place. */}
      <GoalPaceEditorDialog
        open={goalEditorOpen}
        onOpenChange={setGoalEditorOpen}
        onSaved={() => {
          void refreshProfileBasics();
          void loadGoalProfile();
          // ENG-824 — goal/pace saved → quiet win-moment on the calorie card.
          winMoment.celebrate();
        }}
        // Fibre + per-macro overrides live on the manual /profile editor;
        // the goal editor only recomputes macros from the goal/pace. This
        // link restores the path the `goal-editor` flag had orphaned
        // (thread C, target-recompute unification 2026-05-26).
        onCustomiseMacros={() => {
          if (onEdit) onEdit();
          else onNavigate?.("profile");
        }}
      />

      {/*
       * ENG-67 (2026-05-16, Grace decision = "Onboarding + Targets
       * only"): the methodology / safety-floor disclaimer that lives
       * inline at the foot of the onboarding pace step (see
       * `src/app/components/onboarding/steps/pace.tsx`) also lives
       * here — Targets is the dedicated review surface for the
       * numbers, so the user gets the same hedge any time they're
       * looking at those numbers, not just at the original setup.
       * Removed from Today / Progress / Recipes per the same
       * decision.
       */}
      <p className="mt-8 mb-2 text-xs leading-relaxed text-muted-foreground text-center max-w-md mx-auto">
        Estimate uses ~7,700 kcal ≈ 1 kg of body mass. Safety floors reference NIH/NHS
        guidance. Sloe is not a substitute for medical advice — consult your doctor before
        any significant dietary change, especially if you&apos;re pregnant, under 18, or
        managing a medical condition.
      </p>
    </div>
  );
}

export default Targets;
