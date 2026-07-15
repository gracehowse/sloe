"use client";

/**
 * SourceDot — colour-coded provenance dot for macro-bearing rows.
 *
 * Production design spec — 2026-04-27 §1.6.
 * Carries the source colour (USDA / OFF / FatSecret / Manual / AI) at
 * 6 / 8 / 10 pt. AI gets a `Sparkles` 8pt glyph immediately to the left
 * of the dot.
 *
 * Phase 1: primitive only. Callers are swept later (Phase 2 trust
 * posture pass).
 *
 * Mirror: `apps/mobile/components/ui/SourceDot.tsx`.
 */

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "./utils";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import type { SourceDotSource, SourceDotSize } from "../../../lib/types/source";

export type { SourceDotSource, SourceDotSize } from "../../../lib/types/source";

export interface SourceDotProps extends React.ComponentProps<"span"> {
  source: SourceDotSource;
  /** Pixel diameter. Defaults to 8. */
  size?: SourceDotSize;
}

const sourceVar: Record<SourceDotSource, string> = {
  usda: "var(--source-usda)",
  off: "var(--source-off)",
  fatsecret: "var(--source-fatsecret)",
  manual: "var(--source-manual)",
  ai: "var(--source-ai)",
};

const sourceLabel: Record<SourceDotSource, string> = {
  usda: "USDA verified",
  off: "Open Food Facts",
  fatsecret: "FatSecret",
  manual: "Manual entry",
  ai: "AI estimated",
};

export function SourceDot({
  source,
  size = 8,
  className,
  style,
  ...props
}: SourceDotProps) {
  const dot = (
    <span
      aria-hidden
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        backgroundColor: sourceVar[source],
      }}
    />
  );

  // ENG-1464: the top tier shows the source NAME ("USDA") rather than the
  // "USDA verified" over-promise. Flag-off keeps the legacy label (kill switch).
  const displayLabel =
    source === "usda" && isFeatureEnabled("trust_source_name_v1")
      ? "USDA"
      : sourceLabel[source];

  if (source === "ai") {
    // AI source pairs the dot with a sparkle glyph (spec §1.6).
    return (
      <span
        data-slot="source-dot"
        data-source={source}
        role="img"
        className={cn("inline-flex items-center gap-1", className)}
        style={style}
        aria-label={sourceLabel[source]}
        title={sourceLabel[source]}
        {...props}
      >
        <Sparkles
          aria-hidden
          width={8}
          height={8}
          style={{ color: sourceVar[source] }}
        />
        {dot}
      </span>
    );
  }

  return (
    <span
      data-slot="source-dot"
      data-source={source}
      role="img"
      className={cn("inline-flex items-center", className)}
      style={style}
      aria-label={displayLabel}
      title={displayLabel}
      {...props}
    >
      {dot}
    </span>
  );
}

export default SourceDot;
