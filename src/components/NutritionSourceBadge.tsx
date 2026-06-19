"use client";

type SourceTier = "verified" | "estimated" | "manual";

function classifySource(source?: string | null): SourceTier {
  if (source == null || typeof source !== "string") return "manual";
  const s = source.trim().toLowerCase();
  if (!s) return "manual";
  if (s.includes("adjusted")) return "estimated";
  if (s.includes("quick") || s.includes("barcode")) return "estimated";
  if (s.includes("usda") || s.includes("fdc") || s.includes("openfoodfacts") || s.includes("open food facts") || s.includes("fatsecret") || s.includes("edamam") || s === "off") return "verified";
  if (s.includes("ai") || s.includes("photo") || s.includes("voice") || s.includes("import") || s.includes("openai") || s.includes("recipe")) return "estimated";
  return "manual";
}

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
  const tip = source?.trim() ? `${source.trim()} (${cfg.label})` : `${cfg.label} nutrition data`;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold ${cfg.className}`} title={tip}>
      {cfg.abbr} {cfg.label}
    </span>
  );
}

export { classifySource, type SourceTier };
