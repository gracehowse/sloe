"use client";

import * as React from "react";
import { carbsLabel, netCarbsForRow } from "../../../lib/nutrition/netCarbs";

/**
 * TodayDashboardMacroRings — Sloe v3 macro "Rings" layout (the third option in
 * the Tiles / Bars / Rings switcher, prototype `MacroSection` `v==='rings'`).
 *
 * Three small 86px watch dials (Protein / Carbs / Fat), each a 36-segment ring
 * lit in its macro hue (light→solid gradient) with a glowing leading mark and a
 * count-up centre value. Same dial grammar as the hero `CalorieRingDial`, scaled
 * down. Mirrors `apps/mobile/components/today/TodayDashboardMacroRings.tsx`.
 */

const BASE = 86;
const CX = BASE / 2;
const N = 36;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useGrow(restartKey: string): number {
  const [grow, setGrow] = React.useState(0);
  React.useEffect(() => {
    if (prefersReducedMotion()) {
      setGrow(1);
      return;
    }
    setGrow(0);
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / 900);
      setGrow(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [restartKey]);
  return grow;
}

function useCountUp(value: number): number {
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
      const t = Math.min(1, (Date.now() - start) / 820);
      const e = 1 - Math.pow(1 - t, 3);
      setN(Math.round(from + (value - from) * e));
      if (t < 1) raf = requestAnimationFrame(tick);
      else ref.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return n;
}

function MacroDial({
  label,
  current,
  target,
  macroVar,
  grow,
  onPress,
}: {
  label: string;
  current: number;
  target: number;
  /** CSS custom-property name, e.g. `--macro-protein`. */
  macroVar: string;
  grow: number;
  onPress?: () => void;
}) {
  const p = target > 0 ? Math.min(1, current / target) : 0;
  const drawn = p * grow;
  const animated = useCountUp(Math.round(current));
  const gid = `mac-ring-${macroVar.replace(/[^a-z]/gi, "")}`;
  const solid = `var(${macroVar})`;
  const light = `color-mix(in srgb, var(${macroVar}) 52%, #fff)`;

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
        x={CX - 1.5}
        y={7}
        width={3}
        height={5}
        rx={1.5}
        fill="var(--ring-tick)"
        opacity={0.7}
        transform={rot}
      />,
    );
    lit.push(
      <rect
        key={`l${i}`}
        x={CX - 1.5}
        y={5}
        width={3}
        height={9}
        rx={1.5}
        fill={`url(#${gid})`}
        transform={rot}
        filter={lead ? `url(#${gid}-g)` : undefined}
        style={{
          opacity: on ? 1 : 0,
          transition: "opacity .4s var(--pm-ease)",
          transitionDelay: `${frac * 0.8}s`,
        }}
      />,
    );
  }

  const Wrapper = onPress ? "button" : "div";
  return (
    <Wrapper
      type={onPress ? "button" : undefined}
      onClick={onPress}
      className="flex flex-col items-center gap-1 bg-transparent border-0 p-0"
      style={{ cursor: onPress ? "pointer" : "default" }}
    >
      <div className="relative" style={{ width: BASE, height: BASE }}>
        <svg width={BASE} height={BASE} viewBox={`0 0 ${BASE} ${BASE}`} aria-hidden>
          <defs>
            <linearGradient id={gid} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={light} />
              <stop offset="100%" stopColor={solid} />
            </linearGradient>
            <filter id={`${gid}-g`} x="-180%" y="-180%" width="460%" height="460%">
              <feGaussianBlur stdDeviation="1.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {track}
          {lit}
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-[family-name:var(--font-headline)] text-[18px] tabular-nums leading-none">
          {animated}
          <small className="text-[11px] text-foreground-tertiary ml-0.5">g</small>
        </span>
      </div>
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className="text-xs tabular-nums text-foreground-tertiary">
        of {Math.round(target)}g
      </span>
    </Wrapper>
  );
}

export interface TodayDashboardMacroRingsProps {
  proteinCurrent: number;
  proteinTarget: number;
  carbsCurrent: number;
  carbsTarget: number;
  fatCurrent: number;
  fatTarget: number;
  /** ENG-1508: fibre feeds the shared net-carbs helpers. Label arbiter is
   *  `fiberTarget` (mirrors Tiles/Bars — 2026-05-04 numbers-audit #8);
   *  helpers refuse "Net carbs" when fibre is unknown. */
  fiberCurrent: number;
  fiberTarget: number;
  netCarbsLensEnabled?: boolean;
  onPressMacro?: (macro: "protein" | "carbs" | "fat") => void;
}

export function TodayDashboardMacroRings({
  proteinCurrent,
  proteinTarget,
  carbsCurrent,
  carbsTarget,
  fatCurrent,
  fatTarget,
  fiberCurrent,
  fiberTarget,
  netCarbsLensEnabled,
  onPressMacro,
}: TodayDashboardMacroRingsProps) {
  const grow = useGrow(
    `${proteinCurrent}-${carbsCurrent}-${fatCurrent}-${proteinTarget}`,
  );
  return (
    <div className="grid grid-cols-3 gap-2 py-1" data-testid="today-macro-rings">
      <MacroDial
        label="Protein"
        current={proteinCurrent}
        target={proteinTarget}
        macroVar="--macro-protein"
        grow={grow}
        onPress={onPressMacro ? () => onPressMacro("protein") : undefined}
      />
      {/* ENG-1508: shared net-carbs helpers — never label a gross value
          "Net carbs". Label arbiter is fiberTarget (mirrors Tiles/Bars). */}
      <MacroDial
        label={carbsLabel(fiberTarget, Boolean(netCarbsLensEnabled))}
        current={netCarbsForRow(
          carbsCurrent,
          fiberCurrent,
          Boolean(netCarbsLensEnabled),
        )}
        target={netCarbsForRow(
          carbsTarget,
          fiberTarget,
          Boolean(netCarbsLensEnabled),
        )}
        macroVar="--macro-carbs"
        grow={grow}
        onPress={onPressMacro ? () => onPressMacro("carbs") : undefined}
      />
      <MacroDial
        label="Fat"
        current={fatCurrent}
        target={fatTarget}
        macroVar="--macro-fat"
        grow={grow}
        onPress={onPressMacro ? () => onPressMacro("fat") : undefined}
      />
    </div>
  );
}

export default TodayDashboardMacroRings;
