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
  /** Sloe geometry override — mobile parity radii from `calorieRingGeometry`. */
  ringRadius?: number;
  macroRadii?: [number, number, number];
  macroStroke?: number;
  /** Macro progress values 0-1 */
  proteinPct?: number;
  carbsPct?: number;
  fatPct?: number;
  /** Whether expanded state showing macro rings */
  expanded?: boolean;
  /** Toggle expanded */
  onToggle?: () => void;
  /** @deprecated 2026-06-10 (web ring parity 2026-06-10) — the
   *  Remaining/Consumed toggle is retired; long-press matches tap (macro
   *  toggle) and this handler is ignored. Kept for call-site stability. */
  onLongPressToggleDisplayMode?: () => void;
  /** @deprecated 2026-06-10 (web ring parity 2026-06-10) — the
   *  Remaining/Consumed toggle is retired; the centre always reads
   *  remaining/over. Ignored. Kept for call-site stability. */
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
   * here.
   */
  pulse?: boolean;
  /**
   * ENG-1016 — the per-COMMIT pulse: `true` for ~160ms
   * (`WEB_COMMIT_PULSE_MS`) right after an ordinary log lands, driven by
   * `useCommitPulse`. This is the web colour/scale analog of mobile's Medium
   * "confirm" commit haptic (web has no haptics) — DISTINCT from `pulse`
   * above (the loud once-per-day gold win celebration). While true the ring
   * gives a brief, subtle scale-up + soft brand glow so a successful log
   * "lands" visually. The hook already suppresses it under
   * `prefers-reduced-motion` and behind the `redesign_motion` flag — the same
   * gate mobile's `confirmLog` uses — so no extra guard is needed here.
   */
  commitPulse?: boolean;
}

function DailyRing({
  consumed,
  target,
  size = 160,
  strokeWidth = 10,
  ringRadius,
  macroRadii: macroRadiiProp,
  macroStroke: macroStrokeProp,
  className,
  proteinPct = 0,
  carbsPct = 0,
  fatPct = 0,
  expanded = false,
  onToggle,
  // 2026-06-10 (web ring parity 2026-06-10): the Remaining/Consumed toggle is
  // retired. These two props are accepted for call-site stability but ignored —
  // long-press now matches tap (macro toggle), and the centre always reads
  // remaining/over. Mirrors mobile `CalorieRing.tsx`'s deprecated `displayMode`.
  onLongPressToggleDisplayMode: _onLongPressToggleDisplayMode,
  displayMode: _displayMode,
  pulse = false,
  commitPulse = false,
  ...props
}: DailyRingProps) {
  const cx = size / 2;
  const radius = ringRadius ?? Math.round(size * 0.44);
  const circumference = 2 * Math.PI * radius;
  const pct = target > 0 ? Math.min(consumed / target, 1) : 0;
  const offset = circumference * (1 - pct);
  const isOverBudget = consumed > target;
  // 2026-06-10 (web ring parity 2026-06-10 — mobile ring wave): the
  // Remaining/Consumed toggle is RETIRED. It duplicated the EATEN stat
  // directly below the ring, and the collapsed ring ignored it anyway.
  // One centre grammar — `Math.abs(target − consumed)` with a LEFT/OVER
  // verdict — exactly mirrors mobile `CalorieRing.tsx`'s `centerValue` /
  // `centerLabel` block.
  //   - target > 0, under  → "{n} LEFT"
  //   - target > 0, over   → "{n} OVER"   (the over amount, positive)
  //   - target <= 0        → "{consumed} LOGGED" (no profile target yet —
  //     judging LEFT/OVER against a zero goal would lie; R03 contract kept).
  const diff = Math.round(target - consumed);
  const centerValue = target > 0 ? Math.abs(diff) : Math.round(consumed);
  const centerLabel =
    target <= 0
      ? RING_LABELS.logged
      : isOverBudget
        ? RING_LABELS.over
        : RING_LABELS.remaining;
  const isEmpty = consumed === 0 || target <= 0;
  // ENG-1086 — paint the empty cold-open ring as a confident brand-gradient
  // loop instead of a grey skeleton (mobile CalorieRing parity). Default-on;
  // off → the legacy grey track + 1px hairline empty render. The empty ring
  // also wears the bold collapsed-hero stroke (0.085·S) so the loop reads as
  // intentional, not a thin outline.
  const emptyGradientOn = isFeatureEnabled("ring_empty_gradient_v1");
  const emptyBoldStroke = Math.round(size * 0.085);
  // ENG-1093 — empty + Show-macros parity (mobile CalorieRing parity). When the
  // user shows macros on an EMPTY day, render the populated multi-ring
  // unpopulated (calorie track + 3 grey macro tracks) rather than the single
  // bold cold-open loop, so it looks exactly like a populated day, just empty
  // (Grace 2026-06-13). The ENG-1086 loop is therefore scoped to the COLLAPSED
  // empty state. Default-on; off → empty always shows the single loop.
  const emptyMacroParityOn = isFeatureEnabled("ring_empty_macro_parity_v1");
  const emptyShowsMacros = isEmpty && expanded && emptyMacroParityOn;
  const showEmptyGradient = isEmpty && emptyGradientOn && !emptyShowsMacros;
  /** Centre copy stays ink — the plum ring (always plum, never recoloured)
   *  is the only state surface; the LEFT/OVER verdict carries the rest. */
  const centerValueColor = "var(--foreground)";
  const centerLabelColor = centerValueColor;
  // 2026-06-10 (web ring parity 2026-06-10 — mobile ring wave): the empty
  // hero now matches a populated day — the FULL-size ring with REAL numbers
  // ("{goal} LEFT") instead of the retired "Start your day" soft copy. This
  // supersedes the 2026-04-29 papercut-#2 / N5 soft-empty experiment. The
  // empty ring still earns the stronger track + inner hairline below
  // (`isEmpty` track contrast, audit gap 1) so its shape reads on a cold
  // open; only the centre copy changes.
  // 2026-05-05 (audit R03) — `target <= 0` (no profile target yet) still
  // falls into the calibrating-empty state, and the centre shows what's
  // logged with the LOGGED label rather than a verdict against a zero goal
  // (handled by the `centerValue` / `centerLabel` block above). Mirrors
  // mobile `CalorieRing.tsx`.

  const premiumMotion = isPremiumMotionV1Enabled();
  // Design Direction 2026 (ENG-812): the calorie total is the "counting
  // hero" — under `redesign_motion` it renders at display size and odometers
  // up on change via the CANONICAL `useOdometer` (shared 900ms cubic-out
  // curve, the same one mobile reads). Flag OFF keeps the bespoke
  // `useAnimatedNumber` path byte-for-byte (incl. the existing premium-motion
  // 500ms variant). Both hooks are called unconditionally to satisfy the
  // rules of hooks; only the flagged one's output is rendered.
  const motionEnabled = isFeatureEnabled("redesign_motion");

  // Tween the displayed centre value over 800ms / cubic-out — same curve as
  // the SVG ring sweep so the number and arc finish together. The
  // display-mode toggle that this used to snap across is retired (web ring
  // parity 2026-06-10), so `snapOn` is a stable constant — mirrors mobile
  // `CalorieRing.tsx` (`snapOn: "remaining"`).
  const animatedLegacy = useAnimatedNumber(centerValue, {
    snapOn: "remaining",
    duration: premiumMotion ? PREMIUM_MOTION_COUNT_MS : 800,
    animateFromZeroOnMount: premiumMotion,
  });
  // Canonical odometer (ODOMETER_MS / cubic-out). Counts up from zero on
  // mount; honours `prefers-reduced-motion` itself.
  const animatedOdometer = useOdometer(centerValue, {
    snapOn: "remaining",
    animateFromZeroOnMount: true,
  });
  const animatedCenterValue = motionEnabled ? animatedOdometer : animatedLegacy;

  // ENG-798 — gold celebration treatment. A target-hit is by definition the
  // at/under-budget green state, so the celebration only ever lights an
  // otherwise-green arc — never over-budget red or the empty track.
  const celebrating = pulse && !isEmpty && !isOverBudget;

  // 2026-05-12 (premium-bar DC1, web parity with mobile CalorieRing):
  // macro arc stroke 5 → 7. The web ring is bigger than mobile
  // (160 vs 140) so it can carry the same proportional bump
  // comfortably. Audit flagged the macro arcs as "too thin to read at
  // a glance" — fattening reads them as macros, not hairlines.
  const macroStroke = macroStrokeProp ?? Math.max(4, Math.round(size * 0.028));
  // Fallback kept in lockstep with calorieRingGeometry.ts (F-164/165 stroke
  // parity, 2026-06-12) so a prop-less consumer can never silently
  // re-introduce the old fat-ring geometry.
  const macroRadii: [number, number, number] = macroRadiiProp ?? [
    Math.round(size * 0.3855),
    Math.round(size * 0.331),
    Math.round(size * 0.2765),
  ];

  const macroRings = [
    { r: macroRadii[0], pct: proteinPct, color: "var(--macro-protein)" },
    { r: macroRadii[1], pct: carbsPct, color: "var(--macro-carbs)" },
    { r: macroRadii[2], pct: fatPct, color: "var(--macro-fat)" },
  ];

  // 2026-06-10 (web ring parity 2026-06-10): the long-press gesture only ever
  // toggled the retired Remaining/Consumed display mode — with that gone, tap
  // is the single macro-rings toggle (mobile parity: there, tap and long-press
  // both fire the macro toggle). The long-press timer machinery is removed.
  const interactive = Boolean(onToggle);

  return (
    <div
      data-commit-pulse={commitPulse ? "true" : undefined}
      className={cn(
        "relative inline-flex items-center justify-center",
        interactive && "cursor-pointer",
        // ENG-1016 — the per-commit pulse: a brief, subtle scale-up that
        // settles back, the web analog of mobile's Medium commit haptic. The
        // transform + spring easing are token-fitted; the source hook already
        // gates this behind `redesign_motion` + reduced-motion.
        "transition-transform ease-[cubic-bezier(0.18,0.89,0.32,1.28)]",
        commitPulse ? "scale-[1.03] duration-150" : "scale-100 duration-300",
        className,
      )}
      style={{ width: size, height: size }}
      onClick={onToggle ? onToggle : undefined}
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
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
        <defs>
          {/* Win-moment celebration gradient — mirrors the
              `--accent-win-gradient` token (Sloe brand gradient plum → clay →
              amber, 120°; Phase 0 dossier D-3). SVG `stroke` can't take a CSS
              `linear-gradient()`, so the celebration arc references this def;
              the plum → clay → amber stops stay in lockstep with that token +
              the mobile `AccentWinGradient`. Only painted while `celebrating`.
              (The Frost secondary-colour exploration was retired 2026-06-08,
              ENG-997 — clay is the unconditional accent, so these are the
              constant clay-mid stops, no longer flag-dependent.) */}
          <linearGradient id="winSpectrum" x1="0%" y1="0%" x2="86%" y2="50%">
            <stop offset="0%" stopColor="#3B2A4D" />
            <stop offset="50%" stopColor="#C8794E" />
            <stop offset="100%" stopColor="#C9892C" />
          </linearGradient>
          {/* ENG-1086 — empty cold-open ring brand-gradient (NOT winSpectrum,
              which is the warm celebration variant). The plum → aubergine →
              lift stops stay in lockstep with `--accent-win-gradient` + mobile
              `AccentWinGradient`. ~120° via the bbox vector (the whole svg is
              -rotate-90, so the painted angle rotates with it). */}
          <linearGradient id="ringEmptyGradient" x1="0%" y1="100%" x2="86%" y2="0%">
            <stop offset="0%" stopColor="#3B2A4D" />
            <stop offset="50%" stopColor="#5B3B6E" />
            <stop offset="100%" stopColor="#7E5C92" />
          </linearGradient>
        </defs>
        {/* Outer track. On the EMPTY state the track lifts to the stronger
            `--border-strong` (#C9C2D6 light) so the ring's shape reads on a
            cold open instead of disappearing into the near-tonal card (audit
            gap 1, mobile CalorieRing parity); the filled state keeps the soft
            `--ring-bg` frost-mist so the plum arc holds contrast. */}
        <circle
          cx={cx}
          cy={cx}
          r={radius}
          fill="none"
          stroke={isEmpty ? "var(--border-strong)" : "var(--ring-track-bold)"}
          strokeWidth={showEmptyGradient ? emptyBoldStroke : strokeWidth}
          opacity={1}
        />
        {/* ENG-1086 — empty cold-open ring. Flag-on (default): a full-circle
            brand-gradient loop at ~0.36 over the track, so the largest object on
            the most-viewed screen reads as a confident brand loop, not a grey
            skeleton. Flag-off: the legacy 1px inner hairline (audit gap 1). */}
        {showEmptyGradient ? (
          <circle
            cx={cx}
            cy={cx}
            r={radius}
            fill="none"
            stroke="url(#ringEmptyGradient)"
            strokeWidth={emptyBoldStroke}
            strokeLinecap="round"
            style={{ opacity: "var(--ring-empty-gradient-opacity)" }}
          />
        ) : isEmpty && !emptyShowsMacros ? (
          <circle
            cx={cx}
            cy={cx}
            r={radius - strokeWidth / 2 - 1}
            fill="none"
            stroke="var(--border-strong)"
            strokeWidth={1}
            opacity={0.7}
          />
        ) : null}
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
                ? "var(--ring-bg)"
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
            // The gold win-glow takes priority; otherwise a brief soft brand
            // glow on a per-commit pulse (ENG-1016) — the calorie arc's own
            // plum hue, not gold, so the commit beat reads distinct from the
            // landmark celebration.
            filter: celebrating
              ? "drop-shadow(0 0 8px var(--accent-win))"
              : commitPulse && !isEmpty
                ? "drop-shadow(0 0 6px var(--macro-calories))"
                : undefined,
          }}
        />
        {/* Over-budget: the ring CAPS AT FULL — one complete plum lap, NO
            second overage lap, NO red recolour of the ring itself (the centre
            "{n} OVER" verdict + the hero status chip carry the over-budget
            signal). web ring parity 2026-06-10 — mobile decisions apply to web
            (2026-06-10 ring wave): mobile's `calorieRingColor` is `navPrimary`
            (plum) at ALL times and its 2026-06-04 Apple-wrap overage lap was
            retired in the same wave. This supersedes BOTH the old 3-state
            colour map (empty=gradient / under=green / over=destructive-red) and
            the web overage lap — neither is the current state.
            The `--macro-calories` stroke above is plum (#3B2A4D light / #815E91
            dark), so the arc is already plum-always; `pct` is clamped to 1, so
            the plum arc is a full circle when over.
            // deferred: overage texture pending Grace's call on docs/ux/research/2026-06-10-overage-treatments-survey.md
        */}
        {/* Macro rings (shown when expanded).
            2026-05-14 — Grace's call: macro arcs always render in
            their own colour at full opacity, even when over-budget.
            The plum overage lap on the outer ring carries the over-budget
            signal — the inner arcs don't need to repeat it, and dimming
            them collapsed the multi-colour language. */}
        {expanded && (!isEmpty || emptyShowsMacros) && macroRings.map((ring, i) => {
          const c = 2 * Math.PI * ring.r;
          const o = c * (1 - Math.min(ring.pct, 0.999));
          return (
            <g key={i}>
              {/* Macro track = a tint of its OWN hue (Apple Fitness grammar,
                  design-director 2026-06-16), matching mobile — not frost-mist. */}
              <circle
                cx={cx}
                cy={cx}
                r={ring.r}
                fill="none"
                stroke={ring.color}
                strokeWidth={macroStroke}
                opacity={0.28}
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

      {/* Centre text — one grammar for every state (web ring parity
          2026-06-10 — mobile ring wave): the big number tweens to
          `centerValue` via the odometer / `useAnimatedNumber`, then the
          LEFT / OVER / LOGGED label, then (collapsed only) the "of {goal}
          kcal" budget line. The EMPTY day renders the SAME way — real
          numbers ("{goal} LEFT"), no "Start your day" soft copy — so a cold
          open mirrors a populated day. Mirrors mobile `CalorieRing.tsx`. */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {/* ENG-534 P1 (2026-05-16): centre kcal value is MEDIUM-class
            (running daily total — high frequency in replays). Mask so
            PostHog replay renders the number as a grey block; the label +
            budget line are also masked. See
            `docs/operations/session-replay-masking-audit.md`. */}
        {/* Centre value scales WITH the ring (like its radii/strokes/arcs,
            all `size * k`) so it holds mobile's proportion at every ring
            size. A fixed 48px — tuned for the ~207-230px mobile ring —
            overflowed the smaller 160px DESKTOP ring and crowded the macro
            arcs (Grace, 2026-06-07). 0.23 ≈ mobile's 48/207 ratio: 160 → 37. */}
        <span
          className="font-[family-name:var(--font-headline)] font-normal tabular-nums tracking-[-0.02em] leading-none text-foreground ph-mask"
          style={{ fontSize: Math.round(size * 0.23), color: centerValueColor }}
        >
          {animatedCenterValue.toLocaleString()}
        </span>
        <span
          className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-foreground ph-mask"
          style={{ color: centerLabelColor }}
        >
          {centerLabel}
        </span>
        {/* Budget line — collapsed only (Grace 2026-06-10: macros hidden =
            more room, show the goal context; expanded keeps just the label
            and the hero stats row carries the explicit goal). */}
        {target > 0 && !expanded ? (
          <span className="text-[11px] text-muted-foreground mt-0.5 tabular-nums ph-mask">
            of {Math.round(target).toLocaleString()} kcal
          </span>
        ) : null}
      </div>
    </div>
  );
}

export { DailyRing };
