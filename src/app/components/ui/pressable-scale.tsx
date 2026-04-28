"use client";

/**
 * PressableScale — production-design-spec §1.1 micro-interaction primitive
 * (web).
 *
 * Web mirror of `apps/mobile/components/ui/PressableScale.tsx`. Renders a
 * `<button>` with the same visual press feedback (scale 1 → 0.97 over
 * 150ms ease-pm) so every consumer gets a consistent press posture
 * without re-implementing `transition-transform active:scale-[0.97]` at
 * each call site. Web has no haptics, so the `haptic` prop is accepted
 * but ignored (kept for API parity with mobile).
 *
 * Per spec §1.8: includes the focus-visible ring by default.
 */
import * as React from "react";

import { cn } from "./utils";

export type PressableScaleHaptic = "selection" | "confirm" | "success" | "none";

export interface PressableScaleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Scale to drop to on press-in. Default 0.97 (per spec §1.1). */
  scaleTo?: number;
  /** Haptic intent for API parity with mobile. Web ignores it. */
  haptic?: PressableScaleHaptic;
  children?: React.ReactNode;
}

const SCALE_CLASS_MAP: Record<string, string> = {
  "0.94": "active:scale-[0.94]",
  "0.95": "active:scale-[0.95]",
  "0.96": "active:scale-[0.96]",
  "0.97": "active:scale-[0.97]",
  "0.98": "active:scale-[0.98]",
};

export const PressableScale = React.forwardRef<
  HTMLButtonElement,
  PressableScaleProps
>(function PressableScale(
  { scaleTo = 0.97, haptic: _haptic, className, children, type = "button", ...rest },
  ref,
) {
  void _haptic;
  const scaleClass =
    SCALE_CLASS_MAP[scaleTo.toFixed(2)] ?? "active:scale-[0.97]";
  return (
    <button
      ref={ref}
      type={type}
      {...rest}
      className={cn(
        "transition-transform duration-150 ease-out",
        scaleClass,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
    >
      {children}
    </button>
  );
});

export default PressableScale;
