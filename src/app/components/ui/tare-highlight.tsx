/**
 * <TareHighlight> — one-word italic + sage-wash highlight primitive.
 *
 * Source: Phase W0 of the Tare aesthetic rollout
 * (docs/decisions/2026-05-19-suppr-design-direction-v1.md).
 *
 * Per the 2026-05-18 Noom comparative read, the italic isn't the lift —
 * the wash is. Use this to mark ONE word per headline that the reader
 * should land on, so the wash earns its place and italic doesn't drift
 * into "fashion magazine".
 *
 * Usage:
 *   <h1 className="tare-title-serif">
 *     Your <TareHighlight>steadiest</TareHighlight> week yet
 *   </h1>
 *
 * Discipline:
 *   - One per headline maximum
 *   - Never on body / UI labels / data points / button copy
 *   - Pair with serif heavy titles — the surrounding weight gives the
 *     wash room to land as the editorial accent, not the dominant
 *     register
 *
 * Tokens: `.tare-highlight` CSS class in src/styles/tare-aesthetic.css
 * resolves `--highlight-wash` (#c8d4b8 light / #3a4e2f dark) +
 * `--highlight-ink`. Visual only renders when `body.tare-on` is set —
 * outside the flag the wrapper renders as plain italic (graceful
 * degrade) so the markup is safe to ship before the flag flips.
 */

import type { ReactNode } from "react";
import { cn } from "./utils";

export interface TareHighlightProps {
  children: ReactNode;
  /**
   * Optional className override — defaults to the canonical
   * `.tare-highlight` treatment. Pass extras for one-off spacing.
   */
  className?: string;
}

export function TareHighlight({ children, className }: TareHighlightProps) {
  return <span className={cn("tare-highlight", className)}>{children}</span>;
}

export default TareHighlight;
