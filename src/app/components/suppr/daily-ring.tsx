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
        ? "var(--destructive)"
        : "var(--success)"
      : isOverBudget
        ? "var(--destructive)"
        : "var(--macro-calories)";
  const centerValue = displayMode === "consumed" ? Math.round(consumed) : remaining;
  const centerLabel =
    displayMode === "consumed"
      ? RING_LABELS.logged
      : isOverBudget
        ? RING_LABELS.over
        : RING_LABELS.remaining;
  const centerValueColor = isOverBudget ? "var(--destructive)" : undefined;
  const centerLabelColor = isOverBudget ? "var(--destructive)" : undefined;

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

      {/* Centre text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="tabular-nums font-bold leading-none transition-[font-size] duration-300 text-foreground"
          style={{
            fontSize: expanded ? "22px" : "var(--text-display)",
            color: centerValueColor,
          }}
        >
          {centerValue}
        </span>
        <span
          className="text-[11px] font-semibold mt-0.5 uppercase tracking-wider"
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
      </div>
    </div>
  );
}

export { DailyRing };
