"use client";

/**
 * LogConfirmCheck — the calm log-confirm checkmark micro-animation (web).
 *
 * ENG-722 (Noom interaction teardown element D, "per-meal completion feel").
 * A subtle sage checkmark disc that scale-fades in over ~420ms then fades out,
 * mounted over the Today calorie ring at the confirm moment so a successful log
 * *lands* visually — the visual half of the commit feedback whose haptic half
 * shipped 2026-04-28. Restraint by design: NOT confetti, NOT the gold
 * win-moment (that stays reserved for the once-per-day landmark).
 *
 * Gating + reduce-motion live in the caller (`useLogConfirmCheck`): this
 * component has zero footprint until `visible` is true, and the caller never
 * flips `visible` under `prefers-reduced-motion` or when `log_confirm_check_v1`
 * is off. The global CSS reduce-motion rule in `theme.css` additionally
 * collapses the keyframe to ~instant as a belt-and-braces guard.
 *
 * Tokens only: the disc uses `bg-success-soft`, the glyph `text-success-solid`
 * (the same sage success pair the barcode saved-ack uses) — the semantic
 * "logged / confirmed" colour, never a raw hex. Sizing comes from the type/space
 * scale (`h-11 w-11` disc, `h-6 w-6` glyph).
 *
 * Mobile mirror: `apps/mobile/components/today/LogConfirmCheck.tsx` (Reanimated).
 */
import * as React from "react";
import { Check } from "lucide-react";

export interface LogConfirmCheckProps {
  /** Mount + play the check while true. The caller (`useLogConfirmCheck`) owns
   *  the ~480ms visibility window, the flag gate, and the reduce-motion gate. */
  visible: boolean;
  /** Optional test id override. */
  testID?: string;
}

/**
 * Absolute-fill overlay centred over its (relatively-positioned) parent — mount
 * inside the ring wrapper. `pointer-events-none` so it never blocks taps on the
 * ring beneath it.
 */
export function LogConfirmCheck({ visible, testID }: LogConfirmCheckProps) {
  // Bump a key each time `visible` rises so a rapid second log restarts the CSS
  // animation from frame 0 instead of holding the finished end-state.
  const playCountRef = React.useRef(0);
  const wasVisibleRef = React.useRef(false);
  if (visible && !wasVisibleRef.current) playCountRef.current += 1;
  wasVisibleRef.current = visible;

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
      aria-hidden
      data-testid={testID ?? "log-confirm-check"}
    >
      <div
        key={playCountRef.current}
        className="log-confirm-check flex h-11 w-11 items-center justify-center rounded-full bg-success-soft"
      >
        <Check className="h-6 w-6 text-success-solid" strokeWidth={2.75} />
      </div>
    </div>
  );
}

export default LogConfirmCheck;
