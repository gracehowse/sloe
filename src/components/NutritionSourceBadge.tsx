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

const CONFIG: Record<SourceTier, { label: string; abbr: string; className: string }> = {
  verified: { label: "Structured", abbr: "✓", className: "bg-green-500/15 text-green-700 dark:text-green-400" },
  estimated: { label: "Est.", abbr: "~", className: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
  manual: { label: "Manual", abbr: "✎", className: "bg-slate-500/15 text-slate-500 dark:text-slate-400" },
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
