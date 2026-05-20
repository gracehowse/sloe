"use client";

/**
 * HydrationStimulantsCard — three-row panel for Water, Caffeine, and Alcohol.
 *
 * Parity: mirrors the mobile component in
 * `apps/mobile/components/HydrationStimulantsCard.tsx`. Presets, labels,
 * over-target copy, and week-rolling alcohol sum come from the shared
 * pure helper `src/lib/nutrition/hydrationStimulants.ts`, so the two
 * platforms cannot drift.
 *
 * Rules:
 *   - Caffeine row is hidden when `targets.caffeineMg === 0`.
 *   - Alcohol row is hidden when `targets.alcoholGWeekly === 0`.
 *   - Over-target copy is factual — "Over limit" / "Over 400 mg" — in
 *     `amber` (warning), never the `destructive` red. No card-wide red
 *     treatment. See `docs/journeys/food-tracking.md`.
 *   - Each chip has an `aria-label` that names quantity + stimulant so
 *     screen readers announce "Add 250 ml water (quick add)" etc.
 */

import * as React from "react";
import { useCallback, useMemo } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  ALCOHOL_QUICK_ADDS,
  CAFFEINE_QUICK_ADDS,
  WATER_QUICK_ADDS_ML,
  formatWaterAmount,
  imperialWaterQuickAdds,
  isOverTarget,
  weeklyAlcoholG,
  type StimulantTargets,
} from "../../../lib/nutrition/hydrationStimulants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { cn } from "../ui/utils";

export interface HydrationStimulantsCardProps {
  selectedDateKey: string;
  weekStartDay: "monday" | "sunday";
  targets: StimulantTargets;
  waterTotalMl: number;
  waterFromMealsMl: number;
  caffeineTotalMg: number;
  alcoholByDayG: Record<string, number>;
  /** Display-unit preference; only affects water rendering. */
  measurementSystem: "metric" | "imperial";
  onAddWater: (ml: number) => void;
  onAddCaffeine: (mg: number, preset?: string | null) => void;
  onAddAlcohol: (grams: number, preset?: string | null) => void;
  onReset: (kind: "water" | "caffeine" | "alcohol") => void;
  className?: string;
}

function formatWater(ml: number, imperial: boolean): string {
  const { value, unit } = formatWaterAmount(
    ml,
    imperial ? "imperial" : "metric",
  );
  return `${value} ${unit}`;
}

function Row({
  tone,
  label,
  icon,
  valueLine,
  secondaryLine,
  pct,
  overTarget,
  overCopy,
  children,
  onReset,
}: {
  tone: "water" | "caffeine" | "alcohol";
  label: string;
  icon: React.ReactNode;
  valueLine: string;
  secondaryLine?: string;
  pct: number;
  overTarget: boolean;
  overCopy: string;
  children: React.ReactNode;
  onReset: () => void;
}) {
  // Theme tokens: --macro-water (cyan), --stimulant-caffeine (violet),
  // --stimulant-alcohol (amber). See src/styles/theme.css and
  // docs/ux/brand-tokens.md. No hex at this call-site — if you need to
  // change a colour, update the token.
  const barColor =
    tone === "water"
      ? "var(--macro-water)"
      : tone === "caffeine"
      ? "var(--stimulant-caffeine)"
      : "var(--stimulant-alcohol)";
  const overlay = "var(--warning)";
  return (
    <div className="py-2.5 first:pt-0 last:pb-0 border-b border-border last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 shrink-0 min-w-[96px]">
          <span
            aria-hidden
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[13px]"
            style={{
              backgroundColor: `color-mix(in oklab, ${barColor} 15%, transparent)`,
              color: barColor,
            }}
          >
            {icon}
          </span>
          <span className="text-xs font-semibold text-foreground">{label}</span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-foreground leading-tight">
              {valueLine}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label={`${label} row more options`}
                  className="h-6 w-6 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    onReset();
                  }}
                >
                  Reset today
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div
            className="w-full max-w-[220px] h-1.5 rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(100, Math.max(0, Math.round(pct)))}
            aria-label={`${label} progress`}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, pct))}%`,
                backgroundColor: overTarget ? overlay : barColor,
              }}
            />
          </div>
          {secondaryLine ? (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {secondaryLine}
            </span>
          ) : null}
          {overTarget ? (
            <span
              className="text-[10px] font-semibold tabular-nums"
              style={{ color: overlay }}
            >
              {overCopy}
            </span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2 justify-end">{children}</div>
    </div>
  );
}

export function HydrationStimulantsCard({
  selectedDateKey,
  weekStartDay,
  targets,
  waterTotalMl,
  waterFromMealsMl,
  caffeineTotalMg,
  alcoholByDayG,
  measurementSystem,
  onAddWater,
  onAddCaffeine,
  onAddAlcohol,
  onReset,
  className,
}: HydrationStimulantsCardProps) {
  const imperial = measurementSystem === "imperial";

  const showCaffeine = targets.caffeineMg > 0;
  const showAlcohol = targets.alcoholGWeekly > 0;
  const weeklyAlcohol = useMemo(
    () => weeklyAlcoholG(alcoholByDayG, selectedDateKey, weekStartDay),
    [alcoholByDayG, selectedDateKey, weekStartDay],
  );

  const waterPct =
    targets.waterMl > 0 ? (waterTotalMl / targets.waterMl) * 100 : 0;
  const caffeinePct =
    targets.caffeineMg > 0 ? (caffeineTotalMg / targets.caffeineMg) * 100 : 0;
  const alcoholPct =
    targets.alcoholGWeekly > 0 ? (weeklyAlcohol / targets.alcoholGWeekly) * 100 : 0;

  const caffeineOver = isOverTarget(caffeineTotalMg, targets.caffeineMg);
  const alcoholOver = isOverTarget(weeklyAlcohol, targets.alcoholGWeekly);

  const handleAddCaffeine = useCallback(
    (mg: number, preset?: string | null) => {
      onAddCaffeine(mg, preset ?? null);
    },
    [onAddCaffeine],
  );
  const handleAddAlcohol = useCallback(
    (g: number, preset?: string | null) => {
      onAddAlcohol(g, preset ?? null);
    },
    [onAddAlcohol],
  );

  return (
    <section
      className={cn(
        "rounded-card bg-card border border-border p-3 mb-4",
        className,
      )}
      aria-label="Hydration and stimulants"
    >
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Hydration & stimulants
        </h3>
      </header>

      {/* Water */}
      <Row
        tone="water"
        label="Water"
        icon={<span aria-hidden>≈</span>}
        valueLine={`${formatWater(waterTotalMl, imperial)} / ${formatWater(targets.waterMl, imperial)}`}
        secondaryLine={
          waterFromMealsMl > 0
            ? `Includes ${formatWater(waterFromMealsMl, imperial)} from logged food`
            : undefined
        }
        pct={waterPct}
        overTarget={false}
        overCopy=""
        onReset={() => onReset("water")}
      >
        {(imperial
          ? imperialWaterQuickAdds()
          : WATER_QUICK_ADDS_ML.map((ml) => ({ ml, label: `${ml} ml` }))
        ).map((chip) => (
          <button
            key={chip.ml}
            type="button"
            onClick={() => onAddWater(chip.ml)}
            aria-label={
              imperial
                ? `Add ${chip.label} water`
                : `Add ${chip.ml} millilitres water`
            }
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-macro-water-soft text-macro-water border border-macro-water/30 hover:bg-macro-water/20 transition-colors"
          >
            +{chip.label}
          </button>
        ))}
      </Row>

      {/* Caffeine — hidden when target == 0 (parity with alcohol) */}
      {showCaffeine ? (
        <Row
          tone="caffeine"
          label="Caffeine"
          icon={<span aria-hidden>☕</span>}
          valueLine={`${Math.round(caffeineTotalMg)} / ${targets.caffeineMg} mg`}
          pct={caffeinePct}
          overTarget={caffeineOver}
          overCopy={`Over ${targets.caffeineMg} mg`}
          onReset={() => onReset("caffeine")}
        >
          {CAFFEINE_QUICK_ADDS.slice(0, 4).map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleAddCaffeine(preset.mg, preset.label)}
              aria-label={`Add ${preset.label}: ${preset.mg} milligrams caffeine`}
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--stimulant-caffeine) 15%, transparent)",
                color: "var(--stimulant-caffeine)",
                borderColor:
                  "color-mix(in oklab, var(--stimulant-caffeine) 30%, transparent)",
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors hover:brightness-110"
            >
              +{preset.label} ({preset.mg}mg)
            </button>
          ))}
        </Row>
      ) : null}

      {/* Alcohol — hidden when target == 0 */}
      {showAlcohol ? (
        <Row
          tone="alcohol"
          label="Alcohol"
          icon={<span aria-hidden>🍷</span>}
          valueLine={`${weeklyAlcohol} / ${targets.alcoholGWeekly} g this week`}
          pct={alcoholPct}
          overTarget={alcoholOver}
          overCopy="Over limit"
          onReset={() => onReset("alcohol")}
        >
          {ALCOHOL_QUICK_ADDS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => handleAddAlcohol(preset.grams, preset.label)}
              aria-label={`Add ${preset.label}: ${preset.grams} grams alcohol`}
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--stimulant-alcohol) 15%, transparent)",
                color: "var(--stimulant-alcohol)",
                borderColor:
                  "color-mix(in oklab, var(--stimulant-alcohol) 30%, transparent)",
              }}
              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors hover:brightness-110"
            >
              +{preset.label} ({preset.grams}g)
            </button>
          ))}
        </Row>
      ) : null}
    </section>
  );
}
