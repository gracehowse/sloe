"use client";

import { kgToLb } from "@/lib/nutrition/tdee";
import {
  COMPLETE_DAY_V3_COPY,
  buildCompleteDayCoachQuote,
  completeDayTrendlinePoints,
  formatCompleteDayVsTarget,
} from "@/lib/completeDayV3";

export interface CompleteDayV3SectionProps {
  dayLabel: string;
  eatenKcal: number;
  targetKcal: number;
  proteinG: number;
  proteinTargetG?: number;
  currentWeightKg: number;
  projectedWeightKg: number;
  projectionWeeks: number;
  measurementSystem: "metric" | "imperial";
}

export function CompleteDayV3Section({
  dayLabel,
  eatenKcal,
  targetKcal,
  proteinG,
  proteinTargetG,
  currentWeightKg,
  projectedWeightKg,
  projectionWeeks,
  measurementSystem,
}: CompleteDayV3SectionProps) {
  const vsTarget = formatCompleteDayVsTarget(eatenKcal, targetKcal);
  const coach = buildCompleteDayCoachQuote({
    eatenKcal,
    targetKcal,
    proteinG,
    proteinTargetG,
  });
  const { baseline, projected, endY } = completeDayTrendlinePoints();
  const fmtWeight = (kg: number) =>
    measurementSystem === "imperial"
      ? `${Math.round(kgToLb(kg) * 10) / 10} lb`
      : `${kg} kg`;

  return (
    <div className="text-left w-full" data-testid="complete-day-v3">
      <p className="text-[15px] leading-relaxed text-muted-foreground mb-4 px-0.5">
        {COMPLETE_DAY_V3_COPY.intro(dayLabel)}
      </p>

      <div className="flex gap-2.5 mb-3" data-testid="complete-day-v3-stats">
        {[
          { value: Math.round(eatenKcal).toLocaleString(), label: COMPLETE_DAY_V3_COPY.statLabels.eaten },
          {
            value: vsTarget.label,
            label: COMPLETE_DAY_V3_COPY.statLabels.vsTarget,
            tone: vsTarget.tone,
          },
          {
            value: `${Math.round(proteinG)}`,
            suffix: "g",
            label: COMPLETE_DAY_V3_COPY.statLabels.protein,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex-1 rounded-[var(--radius-card)] bg-muted/40 border border-border/60 px-3 py-3 text-center"
          >
            <p
              className={`font-headline text-[22px] tabular-nums leading-none ${
                stat.tone === "under"
                  ? "text-success-solid"
                  : stat.tone === "over"
                    ? "text-destructive"
                    : "text-foreground"
              }`}
            >
              {stat.value}
              {stat.suffix ? <span className="text-base">{stat.suffix}</span> : null}
            </p>
            <p className="section-label mt-2 text-[10px]">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-card p-4 mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="section-label">{COMPLETE_DAY_V3_COPY.projectionOverline}</span>
          <span className="text-xs text-muted-foreground">{COMPLETE_DAY_V3_COPY.projectionCaption}</span>
        </div>
        <svg
          className="w-full h-20"
          viewBox="0 0 300 80"
          preserveAspectRatio="none"
          aria-hidden
          data-testid="complete-day-v3-trendline"
        >
          <polyline
            points={baseline}
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth={2}
            strokeDasharray="4 4"
          />
          <polyline
            points={projected}
            fill="none"
            stroke="var(--success-solid)"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={300} cy={endY} r={4} fill="var(--success-solid)" />
        </svg>
        <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground tabular-nums">
          <span>{fmtWeight(currentWeightKg)} now</span>
          <span className="text-success-solid">
            {fmtWeight(projectedWeightKg)} in {projectionWeeks} wks
          </span>
        </div>
      </div>

      <p className="text-[15px] italic font-medium text-primary text-center px-2" data-testid="complete-day-v3-coach">
        &ldquo;{coach}&rdquo;
      </p>
    </div>
  );
}
