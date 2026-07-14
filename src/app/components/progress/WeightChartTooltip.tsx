"use client";

import type { TooltipProps } from "recharts";

/**
 * ENG-1526 — bespoke callout for the web weight chart (was a stock default
 * Recharts tooltip: `<Tooltip contentStyle={{ fontSize: 11 }} />`, which
 * rendered an unstyled white box off the token scale). Small tokenised card —
 * `bg-card` / `border-border` / `rounded-lg`, scale padding, tabular-nums —
 * showing the hovered point's DATE and WEIGHT value with its unit. Matches the
 * register of the mobile scrubber callout (`WeightChart.tsx` `floatingLabel`).
 *
 * `unit` is passed through (kg / lb) since the numeric value is already
 * unit-converted upstream in `weightChartData`.
 */
export function WeightChartTooltip({
  unit,
  active,
  payload,
  label,
}: TooltipProps<number, string> & { unit: "kg" | "lb" }) {
  if (!active || !payload || payload.length === 0) return null;
  const value = payload[0]?.value;
  if (value == null) return null;
  return (
    <div className="ph-mask rounded-lg border border-border bg-card px-3 py-2 shadow-sm">
      <p className="text-[11px] leading-none text-muted-foreground">{label}</p>
      <p className="mt-1 text-[13px] font-semibold leading-none tabular-nums text-foreground">
        {value} <span className="font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}
