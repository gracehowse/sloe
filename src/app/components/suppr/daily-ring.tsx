"use client";

import * as React from "react";
import { cn } from "../ui/utils";
import { RING_LABELS } from "../../../lib/copy/today";
import { isPremiumMotionV1Enabled } from "../../../lib/preferences/premiumMotionWeb";
import { PREMIUM_MOTION_COUNT_MS } from "../../../lib/preferences/premiumMotion";
import { isFeatureEnabled } from "../../../lib/analytics/track.ts";
import { useOdometer } from "../../../lib/useOdometer.ts";

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
  options?: { snapOn?: unknown; duration?: number; animateFromZeroOnMount?: boolean },
): number {
  const duration = options?.duration ?? 800;
  const snapOn = options?.snapOn;
  const animateFromZeroOnMount = options?.animateFromZeroOnMount ?? false;
  const [value, setValue] = React.useState(animateFromZeroOnMount ? 0 : target);
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
  /**
   * ENG-798 (Redesign — Design Direction 2026) win-moment ring pulse.
   * `true` for ~200ms (`WEB_WIN_PULSE_MS`) right after a Today landmark
   * fires — the web colour/motion analog of mobile's success haptic (web
   * has no haptics).
   *
   * Treatment (Design Direction 2026 §"goal-hit is the shared delight
   * peak"): while true the progress arc fills with the **gold celebration
   * gradient** (`--accent-win-gradient`) instead of plain success-green,
   * thickens slightly, and gains a soft **gold glow** (`--accent-win`) — so
   * the ring visibly "celebrates" the target-hit. Paired with the odometer
   * settling onto the final number, this is the web peak. The
   * `useWebWinMoment` hook already suppresses the pulse under
   * `prefers-reduced-motion`, so no extra reduced-motion guard is needed
   * here. Inert (no-op) when the `redesign_winmoment` flag is off because
   * the hook only ever emits `pulse=true` behind that gate.
   */
  pulse?: boolean;
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
  pulse = false,
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
  const isEmpty = consumed === 0 || target <= 0;
  /** Centre copy stays ink — ring stroke carries green/red budget state. */
  const centerValueColor = isEmpty ? undefined : "var(--foreground)";
  const centerLabelColor = centerValueColor;
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
  // stroke ("calibrating") while web renders over-budget amber for
  // the same input — cross-platform contradiction. Both platforms now
  // fall into the calibrating-empty state until a profile target is
  // set.

  const premiumMotion = isPremiumMotionV1Enabled();
  // Design Direction 2026 (ENG-812): the calorie total is the "counting
  // hero" — under `redesign_motion` it renders at display size and odometers
  // up on change via the CANONICAL `useOdometer` (shared 900ms cubic-out
  // curve, the same one mobile reads). Flag OFF keeps the bespoke
  // `useAnimatedNumber` path byte-for-byte (incl. the existing premium-motion
  // 500ms variant). Both hooks are called unconditionally to satisfy the
  // rules of hooks; only the flagged one's output is rendered.
  const motionEnabled = isFeatureEnabled("redesign_motion");

  // Tween the displayed centre value over 800ms / cubic-out — same
  // curve as the SVG ring sweep so the number and arc finish
  // together. Snaps on display-mode toggle.
  const animatedLegacy = useAnimatedNumber(centerValue, {
    snapOn: displayMode,
    duration: premiumMotion ? PREMIUM_MOTION_COUNT_MS : 800,
    animateFromZeroOnMount: premiumMotion,
  });
  // Canonical odometer (ODOMETER_MS / cubic-out). Snaps across a display-mode
  // switch (remaining ↔ consumed) and counts up from zero on mount; honours
  // `prefers-reduced-motion` itself.
  const animatedOdometer = useOdometer(centerValue, {
    snapOn: displayMode,
    animateFromZeroOnMount: true,
  });
  const animatedCenterValue = motionEnabled ? animatedOdometer : animatedLegacy;

  // ENG-798 — gold celebration treatment is gated explicitly behind
  // `redesign_winmoment` (the same flag the `pulse` source lives behind, read
  // here too so the ring never lights gold while the win-moment is off). A
  // target-hit is by definition the at/under-budget green state, so the
  // celebration only ever lights an otherwise-green arc — never over-budget
  // red or the empty track.
  const winEnabled = isFeatureEnabled("redesign_winmoment");
  const celebrating = pulse && winEnabled && !isEmpty && !isOverBudget;

  // 2026-05-12 (premium-bar DC1, web parity with mobile CalorieRing):
  // macro arc stroke 5 → 7. The web ring is bigger than mobile
  // (160 vs 140) so it can carry the same proportional bump
  // comfortably. Audit flagged the macro arcs as "too thin to read at
  // a glance" — fattening reads them as macros, not hairlines.
  const macroStroke = 7;
  const macroRadii = [radius - 13, radius - 24, radius - 35];

  const macroRings = [
    { r: macroRadii[0], pct: proteinPct, color: "var(--macro-protein)" },
    { r: macroRadii[1], pct: carbsPct, color: "var(--macro-carbs)" },
    { r: macroRadii[2], pct: fatPct, color: "var(--macro-fat)" },
  ];

  const interactive = Boolean(onToggle);

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        interactive && "cursor-pointer",
        className,
      )}
      style={{ width: size, height: size }}
      onClick={interactive ? onToggle : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") onToggle?.();
            }
          : undefined
      }
      {...props}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        {/* MFP-style diagonal hash pattern — mirrors mobile
            `CalorieRing.tsx`. Hue matches --destructive so the
            pattern reads as part of the red arc, not a new colour
            layer. Grace 2026-05-22: own green/red + hashed overage. */}
        <defs>
          <pattern
            id="overHash"
            patternUnits="userSpaceOnUse"
            width={6}
            height={6}
            patternTransform="rotate(45)"
          >
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={6}
              stroke="var(--destructive)"
              strokeWidth={3}
            />
          </pattern>
          {/* Win-moment celebration gradient — mirrors the
              `--accent-win-gradient` token (Sloe brand gradient #3B2A4D →
              #C8794E → #C9892C, 120°; Phase 0 dossier D-3). SVG `stroke` can't
              take a CSS `linear-gradient()`, so the celebration arc references
              this def. Only painted while `celebrating`. */}
          <linearGradient id="winSpectrum" x1="0%" y1="0%" x2="86%" y2="50%">
            <stop offset="0%" stopColor="#3B2A4D" />
            <stop offset="50%" stopColor="#C8794E" />
            <stop offset="100%" stopColor="#C9892C" />
          </linearGradient>
          {/* ENG-826 — calm "calibrating" idle gradient for the EMPTY ring
              (zero logged / no target yet): a soft brand-blue tonal arc instead
              of a flat grey track, matching the prototype's brand-gradient idle.
              Deliberately NOT the win spectrum (reserved for celebration). */}
          <linearGradient id="ringIdle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#588CE4" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#7BA3EA" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={isEmpty ? "url(#ringIdle)" : "var(--ring-bg)"}
          strokeWidth={strokeWidth}
          opacity={1}
        />
        <circle
          data-testid="daily-ring-progress"
          data-pulse={pulse ? "true" : undefined}
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={
            celebrating
              ? "url(#winSpectrum)"
              : isEmpty
                ? "url(#ringIdle)"
                : isOverBudget
                  ? "var(--destructive)"
                  : "var(--macro-calories)"
          }
          // ENG-798 win-moment: a target-hit is by definition the
          // at/under-budget state, so the celebration only ever lights an
          // otherwise-green arc (never over-budget red / empty). For ~200ms
          // the arc fills with the gold gradient, thickens slightly, and
          // gains a soft gold glow — the web colour/motion analog of
          // mobile's success haptic.
          strokeWidth={celebrating ? strokeWidth + 3 : strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn(
            "transition-[stroke-dashoffset,stroke-width,filter]",
            premiumMotion ? "duration-500" : "duration-700",
          )}
          style={{
            transitionTimingFunction: premiumMotion
              ? "cubic-bezier(0.32, 0.72, 0, 1)"
              : "var(--pm-ease)",
            filter: celebrating
              ? "drop-shadow(0 0 8px var(--accent-win))"
              : undefined,
          }}
        />
        {/* Hashed overage segment — only when over budget. Starts at
            top (12 o'clock after the parent's -rotate-90) and runs
            clockwise for `(over / target) * circumference`. Capped
            at one full lap. */}
        {!isEmpty && isOverBudget && target > 0
          ? (() => {
              const overFraction = Math.min(
                (consumed - target) / target,
                1,
              );
              const overLen = circumference * overFraction;
              return (
                <circle
                  cx={cx}
                  cy={cx}
                  r={radius}
                  fill="none"
                  stroke="url(#overHash)"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${overLen} ${circumference}`}
                  strokeDashoffset={0}
                  strokeLinecap="butt"
                />
              );
            })()
          : null}
        {/* Macro rings (shown when expanded).
            2026-05-14 — Grace's call: macro arcs always render in
            their own colour at full opacity, even when over-budget.
            The red outer kcal ring carries the over-budget signal
            — the inner arcs don't need to repeat it, and dimming
            them collapsed the multi-colour language. */}
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
          <div className="flex flex-col items-center justify-center gap-1 px-2">
            <span className="text-lg font-bold leading-none text-center text-foreground tracking-tight">
              Start your day
            </span>
            {target > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {Math.round(target).toLocaleString()} kcal goal
              </span>
            ) : null}
          </div>
        ) : (
          <>
            {/* ENG-534 P1 (2026-05-16): centre kcal value is MEDIUM-class
                (running daily total — high frequency in replays). Mask
                so PostHog replay renders the number as a grey block;
                the label below + budget line are also masked. The
                "Start your day" empty-state copy above is intentionally
                NOT masked (generic UI string). See
                `docs/operations/session-replay-masking-audit.md`. */}
            <span
              className={cn(
                "tabular-nums text-foreground -tracking-[0.02em] leading-none ph-mask",
                // Design Direction 2026 — under `redesign_motion` the calorie
                // total is the "counting hero": render it at display size,
                // heavy. Flag OFF keeps the prior 22px / font-bold treatment
                // byte-for-byte.
                motionEnabled
                  ? "text-[36px] font-extrabold"
                  : "text-[22px] font-bold",
              )}
              style={{ color: centerValueColor ?? undefined }}
            >
              {animatedCenterValue.toLocaleString()}
            </span>
            <span
              className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-foreground ph-mask"
              style={{ color: centerLabelColor ?? undefined }}
            >
              {centerLabel}
            </span>
            {/* Budget anchor only when macro rings are hidden (collapsed
                ring). Parity with mobile `CalorieRing` — expanded +
                "of X kcal" squished the centre copy. */}
            {!expanded && target > 0 ? (
              <span className="text-xs text-muted-foreground mt-0.5 tabular-nums ph-mask">
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
