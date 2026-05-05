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
  const isOverBudget = consumed > target;
  // Build 41 (2026-05-01) — the legacy `ringColor` ladder (warning /
  // success / macro-calories per displayMode + over-budget) was used
  // to colour the ring stroke before the gradient was introduced.
  // Post-59cc821 the stroke is gradient-or-success, so the ladder is
  // unused. Centre text colour still flips to warning when over.
  //
  // B6 (2026-05-03): when over-budget in `remaining` mode, show the
  // *amount over* (positive integer). Previous code rendered the
  // clamped `remaining` value (always 0 once over-budget) beneath
  // the "OVER" label — Grace's screenshot showed `0 / OVER / of
  // 1,132 kcal` when she was actually 506 kcal over. "0 OVER" reads
  // as "you're at goal", which is the opposite of the truth.
  const overBy = Math.max(Math.round(consumed - target), 0);
  const remaining = Math.max(Math.round(target - consumed), 0);
  const centerValue =
    displayMode === "consumed"
      ? Math.round(consumed)
      : isOverBudget
        ? overBy
        : remaining;
  const centerLabel =
    displayMode === "consumed"
      ? RING_LABELS.logged
      : isOverBudget
        ? RING_LABELS.over
        : RING_LABELS.remaining;
  const centerValueColor = isOverBudget ? "var(--destructive)" : undefined;
  const centerLabelColor = isOverBudget ? "var(--destructive)" : undefined;
  // Premium-feel papercut #2 (audit 2026-04-29): empty-state ring
  // dominated Today's first impression. Soft-mode the centre when
  // consumed is exactly 0 so the suggestion card + macro tiles can
  // lead the visual hierarchy instead of a giant ring number.
  // N5 (2026-05-03): extended to fire in `remaining` mode too — the
  // original guard only triggered in `consumed` mode, which left the
  // default Today view (REMAINING) showing `1,132 / REMAINING / of
  // 1,132 kcal` for users who hadn't logged yet. The empty state
  // should look the same regardless of which display mode the user
  // has selected. Mirror of the same change in mobile `CalorieRing.tsx`.
  // 2026-05-05 (audit R03) — also treat `target <= 0` as empty (no
  // profile target yet). Without this guard, mobile renders gradient
  // stroke ("calibrating") while web renders destructive red over for
  // the same input — cross-platform contradiction. Both platforms now
  // fall into the calibrating-empty state until a profile target is
  // set.
  const isEmpty = consumed === 0 || target <= 0;

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
        {/* Brand gradient — same indigo→pink stops as the mobile
            CalorieRing (`apps/mobile/components/charts/CalorieRing.tsx`)
            and the onboarding reveal ring. Audit 2026-04-30 ui-critic
            flagged that the solid green ring read as functional rather
            than aesthetic. Pulling the gradient onto web closes the
            cross-platform visual-language gap. Over-budget keeps the
            destructive solid colour so the "you went over" signal stays
            unambiguous. Stops use the literal hex from `Accent.primaryLight`
            (#6c8cff) → `MacroColors.fat` (#e04888). */}
        <defs>
          <linearGradient id="daily-ring-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#6c8cff" />
            <stop offset="1" stopColor="#e04888" />
          </linearGradient>
        </defs>
        {/* Main calorie ring track. Empty state (consumed=0,
            displayMode="consumed") draws the track with the brand
            gradient at low opacity so the brand is always present;
            mirrors mobile `CalorieRing.tsx` ~L298-306. */}
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={isEmpty ? "url(#daily-ring-gradient)" : "var(--ring-bg)"}
          strokeWidth={strokeWidth}
          opacity={isEmpty ? 0.18 : 1}
        />
        {/* Main calorie ring progress.
            Three-state colour mapping (Grace 2026-05-05 audit feedback —
            supersedes Build 41 two-state):
              1. Empty (consumed === 0) → brand gradient at full opacity
              2. Logged-and-under (0 < consumed <= target) → `--success`
              3. Logged-and-over (consumed > target) → `--warning`
                 (matches the centre digit, which already flips to
                 `--warning` when over via centerValueColor above).

            Build 41's mapping had under = gradient + over = green which
            inverted the cue: a user who'd gone OVER saw a green ring
            while the centre digit read amber, and a user who'd logged
            UNDER saw the welcome gradient as if they hadn't started.
            Mirrored in mobile `CalorieRing.tsx`. */}
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={
            isEmpty
              ? "url(#daily-ring-gradient)"
              : isOverBudget
                ? "var(--destructive)"
                : "var(--success)"
          }
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
              {animatedCenterValue.toLocaleString()}
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
                modes so the centre of the ring always carries its target.
                Hidden when target <= 0 (no profile target yet) so the
                ring doesn't render "of 0 kcal" — 2026-05-05 audit R03. */}
            {target > 0 ? (
              <span className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                of {Math.round(target).toLocaleString()} kcal
              </span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export { DailyRing };
