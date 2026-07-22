"use client";

import * as React from "react";
import { isFeatureEnabled } from "../../../lib/analytics/track";

/**
 * ENG-1656 — dial-legend under the hero Goal/Eaten/Bonus row (web).
 * Mirror of `apps/mobile/components/today/TodayHeroMacroLegend.tsx`.
 */
export interface TodayHeroMacroLegendProps {
  protein: { current: number; target: number };
  carbs: { current: number; target: number };
  fat: { current: number; target: number };
}

function Item({
  label,
  current,
  target,
  swatchClass,
}: {
  label: string;
  current: number;
  target: number;
  swatchClass: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums text-foreground-secondary"
      aria-label={`${label} ${Math.round(current)} of ${Math.round(target)} grams`}
    >
      <span className={`inline-block size-1.5 rounded-full ${swatchClass}`} />
      {Math.round(current)}/{Math.round(target)}g {label}
    </span>
  );
}

export function TodayHeroMacroLegend({
  protein,
  carbs,
  fat,
}: TodayHeroMacroLegendProps) {
  if (!isFeatureEnabled("today_hero_macro_legend_v1")) return null;
  return (
    <div
      data-testid="today-hero-macro-legend"
      className="flex flex-wrap items-center justify-center gap-2 pt-1"
    >
      <Item
        label="P"
        current={protein.current}
        target={protein.target}
        swatchClass="bg-macro-protein"
      />
      <Item
        label="C"
        current={carbs.current}
        target={carbs.target}
        swatchClass="bg-macro-carbs"
      />
      <Item
        label="F"
        current={fat.current}
        target={fat.target}
        swatchClass="bg-macro-fat"
      />
    </div>
  );
}

export default TodayHeroMacroLegend;
