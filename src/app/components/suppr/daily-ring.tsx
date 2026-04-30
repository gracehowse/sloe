"use client";

import * as React from "react";
import { cn } from "../ui/utils";
import { RING_LABELS } from "../../../lib/copy/today";

/**
 * DailyRing — circular progress ring for daily calorie target.
 *
 * SVG-based with CSS-variable colours so it auto-adapts to
 * light/dark mode. Used on the Today screen hero area.
 *
 * Supports expandable macro rings (protein/carbs/fat) matching
 * the mobile CalorieRing component.
 */

/**
 * Tween a displayed integer from its previous value to `target` over
 * `duration` ms with cubic-out easing. Mirrors the mobile
 * `useAnimatedNumber` helper in `CalorieRing.tsx` so the centre
 * number on Today's calorie ring counts up smoothly when the user
 * logs a meal. Same curve and duration as the SVG ring sweep
 * (`transition-[stroke-dashoffset] duration-700` + `--pm-ease`) so
 * the number and the arc finish together.
 *
 * `snapOn` is a discriminator: when its value changes, the displayed
 * number snaps to `target` instantly instead of tweening — used to
 * suppress the count animation on a display-mode toggle (long-press
 * / button press swaps between `remaining` and `consumed`, and
 * counting across two different metrics would be confusing).
 *
 * Honours `prefers-reduced-motion` via the global CSS rule that
 * collapses transition durations near-zero, but also short-circuits
 * here when the user prefers reduced motion to avoid running a RAF
 * loop at all.
 */
function useAnimatedNumber(
  target: number,
  options?: { snapOn?: unknown; duration?: number },
): number {
  const duration = options?.duration ?? 800;
  const snapOn = options?.snapOn;
  const [value, setValue] = React.useState(target);
  const valueRef = React.useRef(target);
  const lastSnapRef = React.useRef(snapOn);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);

  React.useEffect(() => {
    if (snapOn !== lastSnapRef.current) {
      lastSnapRef.current = snapOn;
      setValue(target);
      return;
    }
    if (valueRef.current === target) return;

    // Reduced-motion users: snap, no count-up animation.
    if (
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }

    const from = valueRef.current;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // cubic out
      const next = Math.round(from + (target - from) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, snapOn]);

  return value;
}

export type CalorieRingDisplayMode = "remaining" | "consumed";

interface DailyRingProps extends React.ComponentProps<"div"> {
  consumed: number;
  target: number;
  size?: number;
  strokeWidth?: number;
  /** Macro progress values 0-1 */
  proteinPct?: number;
  carbsPct?: number;
  fatPct?: number;
  /** Whether expanded state showing macro rings */
  expanded?: boolean;
  /** Toggle expanded */
  onToggle?: () => void;
  /** Center: remaining kcal vs consumed kcal (mobile CalorieRing parity). */
  displayMode?: CalorieRingDisplayMode;
}

function DailyRing({
  consumed,
  target,
  size = 160,
  strokeWidth = 10,
  className,
  proteinPct = 0,
  carbsPct = 0,
  fatPct = 0,
  expanded = false,
  onToggle,
  displayMode = "remaining",
  ...props
}: DailyRingProps) {
  const cx = size / 2;
  const radius = (size - strokeWidth) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const offset = circumference * (1 - pct);
  const remaining = Math.max(Math.round(target - consumed), 0);
  const isOverBudget = consumed > target;
  const ringColor =
    displayMode === "consumed"
      ? isOverBudget
        ? "var(--warning)"
        : "var(--success)"
      : isOverBudget
        ? "var(--warning)"
        : "var(--macro-calories)";
  const centerValue = displayMode === "consumed" ? Math.round(consumed) : remaining;
  const centerLabel =
    displayMode === "consumed"
      ? RING_LABELS.logged
      : isOverBudget
        ? RING_LABELS.over
        : RING_LABELS.remaining;
  const centerValueColor = isOverBudget ? "var(--warning)" : undefined;
  const centerLabelColor = isOverBudget ? "var(--warning)" : undefined;
  // Premium-feel papercut #2 (audit 2026-04-29): empty-state ring
  // dominated Today's first impression. Soft-mode the centre when
  // consumed is exactly 0 (in "consumed" displayMode) so the
  // suggestion card + macro tiles can lead the visual hierarchy
  // instead of a giant `0`. Mirror of the same change in mobile
  // `CalorieRing.tsx`.
  const isEmpty = consumed === 0 && displayMode === "consumed";

  // Tween the displayed centre value over 800ms / cubic-out — same
  // curve as the SVG ring sweep so the number and arc finish
  // together. Snaps on display-mode toggle.
  const animatedCenterValue = useAnimatedNumber(centerValue, {
    snapOn: displayMode,
  });

  const macroStroke = 5;
  const macroRadii = [radius - 13, radius - 24, radius - 35];

  const macroRings = [
    { r: macroRadii[0], pct: proteinPct, color: "var(--macro-protein)" },
    { r: macroRadii[1], pct: carbsPct, color: "var(--macro-carbs)" },
    { r: macroRadii[2], pct: fatPct, color: "var(--macro-fat)" },
  ];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center cursor-pointer", className)}
      style={{ width: size, height: size }}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onToggle?.(); }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* Main calorie ring track */}
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke="var(--ring-bg)"
          strokeWidth={strokeWidth}
        />
        {/* Main calorie ring progress */}
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-700"
          style={{ transitionTimingFunction: "var(--pm-ease)" }}
        />
        {/* Macro rings (shown when expanded) */}
        {expanded && macroRings.map((ring, i) => {
          const c = 2 * Math.PI * ring.r;
          const o = c * (1 - Math.min(ring.pct, 0.999));
          return (
            <g key={i}>
              <circle
                cx={cx}
                cy={cx}
                r={ring.r}
                fill="none"
                stroke="var(--ring-bg)"
                strokeWidth={macroStroke}
                opacity={0.4}
              />
              <circle
                cx={cx}
                cy={cx}
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={macroStroke}
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={o}
                className="transition-[stroke-dashoffset] duration-700"
                style={{
                  transitionTimingFunction: "var(--pm-ease)",
                  transitionDelay: `${(i + 1) * 80}ms`,
                }}
              />
            </g>
          );
        })}
      </svg>

      {/* Centre text — number tweens to `centerValue` via
          `useAnimatedNumber`. Counts up smoothly when consumed
          changes; snaps on displayMode toggle. Empty state (audit
          2026-04-29 papercut #2) replaces the giant `0` with a
          softer "Start your day" invitation so the empty ring stops
          dominating Today's first impression. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {isEmpty ? (
          <span
            className="font-medium leading-tight text-center text-muted-foreground"
            style={{ fontSize: expanded ? "14px" : "16px" }}
          >
            Start your day
          </span>
        ) : (
          <>
            <span
              className="tabular-nums font-bold leading-none transition-[font-size] duration-300 text-foreground"
              style={{
                fontSize: expanded ? "22px" : "var(--text-display)",
                color: centerValueColor,
              }}
            >
              {animatedCenterValue}
            </span>
            {/* Centre label ("REMAINING" / "LOGGED" / "OVER"). Grace
                2026-04-28: mobile flagged the label clipping inner-most
                macro ring at the label's y. Web's ring is bigger
                (160 vs 140) so the inner-most macro ring at r≈38 has
                more horizontal room at the label's y (~±33 vs the label
                width of ~54px → ±27, fits with margin). Web doesn't
                have the same overlap, but for symmetry with the mobile
                shrink we use a smaller `text-[9px]` + drop tracking
                when expanded so the label always sits comfortably
                inside the inner ring instead of grazing it. */}
            <span
              className={`font-semibold mt-0.5 uppercase ${expanded ? "text-[9px] tracking-normal" : "text-[11px] tracking-wider"}`}
              style={{ color: centerLabelColor ?? "var(--muted-foreground)" }}
            >
              {centerLabel}
            </span>
            {/* Budget line renders in BOTH expanded + collapsed states
                (parity with mobile `CalorieRing` — commit 26a63bf, 2026-04-20).
                ui-critic called out that the expanded view hid the
                denominator and left the user looking at a number with no
                anchor. We keep the same 10px tabular caption in both
                modes so the centre of the ring always carries its target. */}
            <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
              of {Math.round(target).toLocaleString()} kcal
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export { DailyRing };
