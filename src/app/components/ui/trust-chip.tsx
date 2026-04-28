"use client";

/**
 * TrustChip — provenance pill for detail surfaces.
 *
 * Production design spec — 2026-04-27 §1.6.
 * Variants:
 *   - `usda`              → green tint, Check glyph + "USDA verified"
 *   - `off-adjusted`      → blue tint, Check glyph + "OFF · adjusted"
 *   - `estimated`         → amber tint, Sparkles glyph + "Estimated · verify"
 *   - `manual`            → grey tint, no glyph + "Manual"
 *   - `gluten-high-conf`  → green tint, Check glyph + "Gluten-free · high confidence"
 *   - `gluten-uncertain`  → amber tint, Sparkles glyph + "Gluten contamination risk · review"
 *
 * Pill geometry: 24px height, padding 3px x 8px, radius 999px.
 *
 * Phase 1: primitive only. Callers swept Phase 2 (D-2026-04-27-16
 * trust posture sweep).
 *
 * Mirror: `apps/mobile/components/ui/TrustChip.tsx`.
 */

import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "./utils";

export type TrustChipVariant =
  | "usda"
  | "off-adjusted"
  | "estimated"
  | "manual"
  | "gluten-high-conf"
  | "gluten-uncertain";

export interface TrustChipProps extends React.ComponentProps<"span"> {
  variant: TrustChipVariant;
  /** Optional override for the visible label. Defaults to the spec
   *  copy listed in §1.6. */
  label?: string;
}

interface VariantConfig {
  bg: string;
  fg: string;
  glyph: "check" | "sparkles" | null;
  label: string;
}

const config: Record<TrustChipVariant, VariantConfig> = {
  usda: {
    bg: "rgba(34, 168, 96, 0.08)",
    fg: "var(--success)",
    glyph: "check",
    label: "USDA verified",
  },
  "off-adjusted": {
    bg: "rgba(76, 108, 224, 0.08)",
    fg: "var(--primary)",
    glyph: "check",
    label: "OFF · adjusted",
  },
  estimated: {
    bg: "rgba(232, 160, 32, 0.10)",
    fg: "var(--warning)",
    glyph: "sparkles",
    label: "Estimated · verify",
  },
  manual: {
    bg: "rgba(148, 163, 184, 0.10)",
    fg: "var(--muted-foreground)",
    glyph: null,
    label: "Manual",
  },
  "gluten-high-conf": {
    bg: "rgba(34, 168, 96, 0.08)",
    fg: "var(--success)",
    glyph: "check",
    label: "No gluten-containing ingredients",
  },
  "gluten-uncertain": {
    bg: "rgba(232, 160, 32, 0.10)",
    fg: "var(--warning)",
    glyph: "sparkles",
    label: "Contains potential gluten · review",
  },
};

export function TrustChip({
  variant,
  label,
  className,
  style,
  ...props
}: TrustChipProps) {
  const cfg = config[variant];
  const displayLabel = label ?? cfg.label;

  return (
    <span
      data-slot="trust-chip"
      data-variant={variant}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        // 24px h × auto w — see spec §1.6 pill geometry.
        "h-6 px-2 text-[11px] leading-none",
        className,
      )}
      style={{
        backgroundColor: cfg.bg,
        color: cfg.fg,
        ...style,
      }}
      {...props}
    >
      {cfg.glyph === "check" ? (
        <Check aria-hidden width={10} height={10} strokeWidth={2.5} />
      ) : null}
      {cfg.glyph === "sparkles" ? (
        <Sparkles aria-hidden width={10} height={10} strokeWidth={2} />
      ) : null}
      <span>{displayLabel}</span>
    </span>
  );
}

export default TrustChip;
