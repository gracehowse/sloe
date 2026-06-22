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
 * State (locked rule): empty → frost bloom, under → sage gradient, over →
 * destructive→warm. Mirrors mobile `CalorieRing` (Skia) — keep the geometry
 * (48 ticks, base 224 viewBox) identical across platforms.
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
}

export function CalorieRingDial({
  consumed,
  target,
  size = BASE,
}: CalorieRingDialProps) {
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

  const centerValue = isOver
    ? Math.round(consumed - target)
    : Math.max(0, Math.round(target - consumed));
  const animated = useCountUp(centerValue);
  const label = isOver ? "kcal over" : "kcal left";

  const track: React.ReactNode[] = [];
  const lit: React.ReactNode[] = [];
  for (let i = 0; i < N; i++) {
    const ang = i * (360 / N);
    const frac = i / N;
    const on = frac <= drawn + 0.0001;
    const lead = on && (i + 1) / N > drawn;
    const rot = `rotate(${ang} ${CX} ${CX})`;
    track.push(
      <rect
        key={`t${i}`}
        x={CX - 2.1}
        y={11}
        width={4.2}
        height={14}
        rx={2.1}
        fill="var(--ring-tick)"
        opacity={0.7}
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
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${BASE} ${BASE}`}
        aria-hidden="true"
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
          <radialGradient id={`${gid}-core`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={cb} stopOpacity="0.22" />
            <stop offset="42%" stopColor={cb} stopOpacity="0.07" />
            <stop offset="72%" stopColor={cb} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${gid}-rim`} cx="50%" cy="50%" r="50%">
            <stop offset="62%" stopColor={cb} stopOpacity="0" />
            <stop offset="88%" stopColor={cb} stopOpacity="0.10" />
            <stop offset="100%" stopColor={cb} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle
          cx={CX}
          cy={CX}
          r={96}
          fill={`url(#${gid}-rim)`}
          style={{ opacity: grow, transition: "opacity 1.1s var(--pm-ease)" }}
        />
        <circle
          cx={CX}
          cy={CX}
          r={80}
          fill={`url(#${gid}-core)`}
          style={{ opacity: grow, transition: "opacity 1.2s var(--pm-ease)" }}
        />
        {track}
        {lit}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-[family-name:var(--font-headline)] text-[44px] font-normal leading-none tabular-nums"
          style={isOver ? { color: "var(--warning)" } : undefined}
        >
          {animated.toLocaleString()}
        </span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-foreground-tertiary">
          {label}
        </span>
      </div>
    </div>
  );
}

export default CalorieRingDial;
