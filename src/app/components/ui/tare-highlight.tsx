/**
 * <TareHighlight> — one-word italic + sage-wash highlight primitive.
 *
 * Source: Phase 0.5 of the Tare aesthetic rollout
 * (docs/decisions/2026-05-18-tare-aesthetic-foundation.md).
 *
 * Visual rationale: per the 2026-05-18 Noom comparative read, the
 * italic isn't the lift — the wash is. Use this to mark ONE word per
 * headline that the reader should land on, so the wash earns its
 * place and italic doesn't drift into "fashion magazine".
 *
 * Usage:
 *   <h1 className="tare-title-serif">
 *     Your <TareHighlight>steadiest</TareHighlight> week yet
 *   </h1>
 *
 * Discipline:
 *   - One per headline maximum
 *   - Never on body / UI labels / data points / button copy
 *   - Pair with .tare-title-serif (Spectral 600) — the heavy serif
 *     gives the surrounding words authority so the highlighted word
 *     stands out as the editorial accent, not the dominant register
 *
 * The wash colour is forest sage at ~18% alpha (light) / 22% alpha
 * (dark), driven by .tare-highlight in src/styles/tare-aesthetic.css.
 * The visual only activates when `body.tare-on` is set — feature flag
 * `tare-aesthetic-v1`. Outside the flag, the highlight renders as
 * plain italic with no wash (graceful degrade).
 */

import type { ReactNode } from "react";
import { cn } from "./utils";

export interface TareHighlightProps {
  children: ReactNode;
  /**
   * Optional className override — defaults to the canonical
   * `.tare-highlight` treatment. Pass extras for one-off spacing or
   * to swap the wash colour via inline style (rare — restrict to
   * editorial-bundle moments approved by Grace).
   */
  className?: string;
}

export function TareHighlight({ children, className }: TareHighlightProps) {
  return <span className={cn("tare-highlight", className)}>{children}</span>;
}

export default TareHighlight;
