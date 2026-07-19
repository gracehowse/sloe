"use client";

import { classifySource, type SourceTier } from "../lib/nutrition/classifySource";
import { isFeatureEnabled } from "../lib/analytics/track";
import { formatNutritionTrustTierLabel } from "../lib/nutrition/sourceLabel";

// ENG-716 — off-token Tailwind palette literals (green/yellow/slate)
// migrated to the Sloe semantic state tokens. Verified → success (sage),
// estimated → warning (amber), manual → muted (warm grey). The `-soft`
// fill + `-solid` text variants auto-swap in dark mode via the CSS vars
// (no manual `dark:` variant needed — the old slate path even dropped its
// dark override). Rendered intent is preserved: sage / amber / grey
// families, with the AA-safe `-solid` text variant carrying the label.
const CONFIG: Record<SourceTier, { label: string; abbr: string; className: string }> = {
  verified: { label: "Structured", abbr: "✓", className: "bg-success-soft text-success-solid" },
  estimated: { label: "Est.", abbr: "~", className: "bg-warning-soft text-warning-solid" },
  manual: { label: "Manual", abbr: "✎", className: "bg-muted text-muted-foreground" },
};

export default function NutritionSourceBadge({ source }: { source?: string | null }) {
  const tier = classifySource(source);
  const cfg = CONFIG[tier];
  const trustSourceName = isFeatureEnabled("trust_source_name_v1");
  const label = trustSourceName
    ? formatNutritionTrustTierLabel(tier, source)
    : cfg.label;
  const tip = trustSourceName
    ? `${label} nutrition data`
    : source?.trim()
      ? `${source.trim()} (${cfg.label})`
      : `${cfg.label} nutrition data`;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.className}`} title={tip}>
      {cfg.abbr} {label}
    </span>
  );
}

export { classifySource, type SourceTier };
