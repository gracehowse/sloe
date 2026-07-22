"use client";

import * as React from "react";

/**
 * CalorieRingDial — Sloe v3 "jewel dial" calorie ring (web SVG).
 *
 * The signature Today hero element from the consolidated v3 prototype
 * (`docs/ux/redesign/v3/Sloe-App.html`, RingHero `segments` variant): a
 * 48-segment watch dial. Frost graduation ticks form the full dial; the
 * progressed segments light with the state gradient (`--ring-{state}-a/b`)
 * and stagger in on mount, and the leading segment glows as a luminous gem
 * (`--ring-cap-core` + blur). A soft radial bloom sits behind.
 *
 * State (locked rule, 2026-07-01 re-ratification ENG-1296): empty → frost
 * bloom, under → sage gradient, over → AMBER family (arc `--ring-over-a/b` =
 * warning-solid → warning; numeral `--accent-warning-solid` — red retired).
 * Mirrors mobile `CalorieRing` (Skia) — keep the geometry (48 ticks, base 224
 * viewBox) identical across platforms.
 *
 * Drop-in for `<DailyRing>` inside `TodayHeroRing` behind `sloe_v3_ring`.
 */

const BASE = 224; // viewBox space — internal coords are authored here and scale
const CX = BASE / 2;
const N = 48;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Tween an integer 0 → value (cubic-out), reduced-motion aware. */
function useCountUp(value: number, duration = 1050): number {
  const [n, setN] = React.useState(0);
  const ref = React.useRef(0);
  React.useEffect(() => {
    if (prefersReducedMotion()) {
      setN(value);
      ref.current = value;
      return;
    }
    const from = ref.current;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (value - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return n;
}

export interface CalorieRingDialProps {
  consumed: number;
  target: number;
  /** Rendered diameter in px (default 224). Geometry scales from the 224 base. */
  size?: number;
  /**
   * Ring-only mode (ENG-1225 onboarding reveal): render just the jewel
   * tick-ring + grow, no centre value/label — the host overlays its own centre
   * (the reveal's "Crunching…" beat → serif count-up). Parity with the mobile
   * dial's `hideCenter`.
   */
  hideCenter?: boolean;
  /** De-carded v3 hero (ENG-1247): render the centre value as the 56px serif-
   *  MEDIUM `.ring-big` numeral instead of the default 44/normal. */
  numeralLarge?: boolean;
  /** ENG-1465 — tap/click (or Enter/Space) toggles the host-owned macro-rings
   *  state, restoring the legacy `DailyRing` gesture the v3 swap dropped.
   *  Mirrors the mobile dial's `onToggle` (there: tap AND long-press). */
  onToggle?: () => void;
  /** ENG-1465 / ENG-798 — win-moment ring pulse. True for ~200ms after a Today
   *  landmark fires; lights a brief gold glow on the dial (same as the
   *  legacy ring). */
  pulse?: boolean;
  /** ENG-1465 / ENG-1016 — per-COMMIT pulse: true for ~160ms after an ordinary
   *  log lands. Brief scale-up + soft plum glow — the web analog of mobile's
   *  commit haptic, same treatment the legacy `DailyRing` carried. */
  commitPulse?: boolean;
  /** ENG-1653 — dial-view switch (prototype ring-tap): "remaining" shows the
   *  budget arithmetic (kcal left / kcal over); "consumed" shows what's been
   *  eaten (kcal eaten). Default "remaining" (today's behaviour). Mobile
   *  twin: `CalorieRingDial.tsx` `displayMode`. */
  displayMode?: "remaining" | "consumed";
}

export function CalorieRingDial({
  consumed,
  target,
  size = BASE,
  hideCenter = false,
  numeralLarge = false,
  onToggle,
  displayMode = "remaining",
  pulse = false,
  commitPulse = false,
}: CalorieRingDialProps) {
  // ENG-1477 — the ENG-1372 warm-tint tick measured 1.02:1/1.14:1 against
  // the real background, worse than this token's own pre-fix baseline.
  // Grace's call (2026-07-09): every empty day uses this tick colour, no
  // warm variant (the warm token itself was deleted by ENG-1496).
  const tickFill = "var(--ring-tick)";
  const isEmpty = consumed === 0 || target <= 0;
  const isOver = target > 0 && consumed > target;
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;

  // Mount-grow drives both the bloom fade-in and the staggered segment reveal.
  const [grow, setGrow] = React.useState(0);
  React.useEffect(() => {
    if (prefersReducedMotion()) {
      setGrow(1);
      return;
    }
    setGrow(0);
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => setGrow(1)),
    );
    return () => cancelAnimationFrame(id);
  }, [consumed, target]);

  const drawn = (isEmpty ? 0.004 : pct) * grow;

  const stateKey = isOver ? "over" : isEmpty ? "empty" : "under";
  // Namespace the gradient/filter ids PER INSTANCE (ENG-1225): `TodayHeroStats`
  // mounts two dials at once (mobile-web + desktop, one hidden per breakpoint).
  // A shared `cr-dial-<state>` id made every `url(#…)` resolve to the FIRST
  // (hidden) instance's defs, so the visible dial's lit segments never painted.
  // `useId()` gives each instance its own stable ids. (SVG-safe: strip colons.)
  const uid = React.useId().replace(/:/g, "");
  const gid = `cr-dial-${stateKey}-${uid}`;
  const ca = `var(--ring-${stateKey}-a)`;
  const cb = `var(--ring-${stateKey}-b)`;

  // ENG-1465 — win celebration: a target-hit is by definition the
  // at/under-budget state, so the gold glow only ever lights an under-budget
  // dial.
  const celebrating = pulse && !isEmpty && !isOver;

  // ENG-1653: consumed view shows the eaten total; the arc + the status line
  // below the ring still carry the over/under verdict.
  const showConsumed = displayMode === "consumed";
  const centerValue = showConsumed
    ? Math.round(consumed)
    : isOver
      ? Math.round(consumed - target)
      : Math.max(0, Math.round(target - consumed));
  const animated = useCountUp(centerValue);
  const label = showConsumed ? "kcal eaten" : isOver ? "kcal over" : "kcal left";

  const track: React.ReactNode[] = [];
  const lit: React.ReactNode[] = [];
  for (let i = 0; i < N; i++) {
    const ang = i * (360 / N);
    const frac = i / N;
    const on = frac <= drawn + 0.0001;
    const lead = on && (i + 1) / N > drawn;
    const rot = `rotate(${ang} ${CX} ${CX})`;
    track.push(
      // ENG-1485 (2026-07-10): NO opacity attenuation on track ticks — the
      // `--ring-tick` token already carries its alpha, and the extra 0.7 this
      // rect used to apply double-discounted it to an effective 0.14, which
      // measured 1.29:1 on the light card/ground (below the 1.3:1 decorative-
      // track floor) while mobile rendered the same token at full strength.
      // Gate: tests/unit/ringTickContrastWeb.test.ts.
      <rect
        key={`t${i}`}
        x={CX - 2.1}
        y={11}
        width={4.2}
        height={14}
        rx={2.1}
        fill={tickFill}
        transform={rot}
      />,
    );
    lit.push(
      <rect
        key={`l${i}`}
        x={CX - 2.1}
        y={8.5}
        width={4.2}
        height={19}
        rx={2.1}
        fill={`url(#${gid})`}
        transform={rot}
        filter={lead ? `url(#${gid}-glow)` : undefined}
        style={{
          opacity: on ? 1 : 0,
          transition: "opacity .42s var(--pm-ease)",
          transitionDelay: `${frac * 1.05}s`,
        }}
      />,
    );
    if (lead) {
      lit.push(
        <rect
          key={`g${i}`}
          x={CX - 1.1}
          y={9.5}
          width={2.2}
          height={6}
          rx={1.1}
          fill="var(--ring-cap-core)"
          opacity={0.92}
          transform={rot}
        />,
      );
    }
  }

  return (
    // ENG-1465 — the legacy `DailyRing` interaction contract, restored on the
    // v3 dial: click/Enter/Space toggles the host-owned macro-rings state
    // (role=button only when a handler is wired — the labelled "Show macros"
    // button below the hero stays the accessible-name path), and the per-commit
    // pulse is the same brief scale-up + settle the legacy ring carried.
    <div
      data-testid="calorie-ring-dial"
      data-pulse={celebrating ? "true" : undefined}
      data-commit-pulse={commitPulse ? "true" : undefined}
      className={[
        "relative",
        onToggle ? "cursor-pointer" : "",
        "transition-transform ease-[cubic-bezier(0.18,0.89,0.32,1.28)]",
        commitPulse ? "scale-[1.03] duration-150" : "scale-100 duration-300",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ width: size, height: size }}
      onClick={onToggle}
      role={onToggle ? "button" : undefined}
      tabIndex={onToggle ? 0 : undefined}
      onKeyDown={
        onToggle
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onToggle();
              }
            }
          : undefined
      }
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${BASE} ${BASE}`}
        aria-hidden="true"
        style={{
          // ENG-1465 — the gold win-glow takes priority; otherwise a brief soft
          // plum glow on a per-commit pulse (ENG-1016), mirroring the legacy
          // ring's filters so the commit beat reads distinct from the landmark
          // celebration.
          filter: celebrating
            ? "drop-shadow(0 0 8px var(--accent-win))"
            : commitPulse && !isEmpty
              ? "drop-shadow(0 0 6px var(--macro-calories))"
              : undefined,
        }}
      >
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={cb} />
            <stop offset="100%" stopColor={ca} />
          </linearGradient>
          <filter
            id={`${gid}-glow`}
            x="-160%"
            y="-160%"
            width="420%"
            height="420%"
          >
            <feGaussianBlur stdDeviation="3.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {/* White-background variant (Grace 2026-06-22): the jewel `.ring-wrap`
            bloom (the radial-gradient halo seated beneath the dial) is dropped —
            same segments + leading-cap glow, on a clean white ground. */}
        {track}
        {lit}
      </svg>
      {hideCenter ? null : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className={`font-[family-name:var(--font-headline)] leading-none tabular-nums ${
              numeralLarge ? "text-[56px] font-medium" : "text-[44px] font-normal"
            }`}
            style={isOver ? { color: "var(--accent-warning-solid)" } : undefined}
          >
            {animated.toLocaleString()}
          </span>
          <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

export default CalorieRingDial;
