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
 *   - `gluten-high-conf`  → green tint, Sparkles glyph + "No gluten-containing ingredients"
 *                           (Sparkles, not Check — ENG-748: a coeliac surface must not
 *                           read as a verified safety guarantee; see the persistent
 *                           disclaimer beneath the chip on recipe-detail heroes)
 *   - `gluten-uncertain`  → amber tint, Sparkles glyph + "Contains potential gluten · review"
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
import type { TrustChipVariant } from "../../../lib/types/trust";

export type { TrustChipVariant } from "../../../lib/types/trust";

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
    bg: "rgba(98, 179, 90, 0.08)",
    fg: "var(--success)",
    glyph: "check",
    label: "USDA verified",
  },
  "off-adjusted": {
    bg: "rgba(76, 108, 224, 0.12)",
    fg: "var(--primary)",
    glyph: "check",
    label: "OFF · adjusted",
  },
  estimated: {
    bg: "rgba(224, 168, 56, 0.10)",
    fg: "var(--warning)",
    glyph: "sparkles",
    label: "Estimated · verify",
  },
  manual: {
    bg: "rgba(140, 131, 120, 0.12)",
    fg: "var(--muted-foreground)",
    glyph: null,
    label: "Manual",
  },
  "gluten-high-conf": {
    bg: "rgba(98, 179, 90, 0.08)",
    fg: "var(--success)",
    // ENG-748 (legal-reviewer P0): the gluten chip must NOT read as a
    // verified safety guarantee on a coeliac surface. The `check` glyph
    // is the "verified" mark — swapped to `sparkles` (the "estimated"
    // glyph, shared with `gluten-uncertain`) so the chip reads as an
    // ingredient-name estimate, paired with the persistent disclaimer
    // caption rendered beneath it on the recipe-detail heroes.
    glyph: "sparkles",
    label: "No gluten-containing ingredients",
  },
  "gluten-uncertain": {
    bg: "rgba(224, 168, 56, 0.10)",
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
