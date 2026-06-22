import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { MacroColors, Type } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * TodayDashboardMacroRings — Sloe v3 macro "Rings" layout (mobile, the third
 * Tiles / Bars / Rings option). Three small 86px macro watch-dials
 * (Protein / Carbs / Fat) in the macro hue, mirroring the web
 * `src/app/components/suppr/today-dashboard-macro-rings.tsx`. Same dial grammar
 * as `CalorieRingDial` — each lit segment carries `rotation`/`originX`/`originY`.
 */

const BASE = 86;
const CX = BASE / 2;
const N = 36;

/** Lighten a hex toward white by `t` (0..1) — the top gradient stop. */
function lighten(hex: string, t: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const to2 = (c: number) =>
    Math.round(c + (255 - c) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

function useGrow(reduce: boolean, restartKey: string): number {
  const [grow, setGrow] = useState(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey, reduce]);
  return grow;
}

function useCountUp(value: number, reduce: boolean): number {
  const [n, setN] = useState(reduce ? value : 0);
  const ref = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) {
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
  }, [value, reduce]);
  return n;
}

function MacroDial({
  label,
  current,
  target,
  color,
  tickColor,
  textColor,
  subColor,
  grow,
  reduce,
  idKey,
}: {
  label: string;
  current: number;
  target: number;
  color: string;
  tickColor: string;
  textColor: string;
  subColor: string;
  grow: number;
  reduce: boolean;
  idKey: string;
}) {
  const p = target > 0 ? Math.min(1, current / target) : 0;
  const drawn = p * grow;
  const animated = useCountUp(Math.round(current), reduce);
  const gid = `macd-${idKey}`;
  const light = lighten(color, 0.48);

  const track: React.ReactNode[] = [];
  const lit: React.ReactNode[] = [];
  for (let i = 0; i < N; i++) {
    const ang = i * (360 / N);
    const frac = i / N;
    const on = frac <= drawn + 0.0001;
    track.push(
      <Rect
        key={`t${i}`}
        x={CX - 1.5}
        y={7}
        width={3}
        height={5}
        rx={1.5}
        fill={tickColor}
        rotation={ang}
        originX={CX}
        originY={CX}
      />,
    );
    lit.push(
      <Rect
        key={`l${i}`}
        x={CX - 1.5}
        y={5}
        width={3}
        height={9}
        rx={1.5}
        fill={`url(#${gid})`}
        opacity={on ? 1 : 0}
        rotation={ang}
        originX={CX}
        originY={CX}
      />,
    );
  }

  return (
    <View style={styles.dial}>
      <View style={{ width: BASE, height: BASE }}>
        <Svg width={BASE} height={BASE} viewBox={`0 0 ${BASE} ${BASE}`}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={light} />
              <Stop offset="1" stopColor={color} />
            </LinearGradient>
          </Defs>
          {track}
          {lit}
        </Svg>
        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.value, { color: textColor }]}>
            {animated}
            <Text style={[styles.unit, { color: subColor }]}> g</Text>
          </Text>
        </View>
      </View>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      <Text style={[styles.goal, { color: subColor }]}>
        of {Math.round(target)}g
      </Text>
    </View>
  );
}

export interface TodayDashboardMacroRingsProps {
  totals: { protein: number; carbs: number; fat: number; fiber: number };
  targets: { protein: number; carbs: number; fat: number; fiber: number };
  netCarbsLensEnabled?: boolean;
  onPressMacro?: (macro: "protein" | "carbs" | "fat") => void;
}

export function TodayDashboardMacroRings({
  totals,
  targets,
  netCarbsLensEnabled,
}: TodayDashboardMacroRingsProps) {
  const colors = useThemeColors();
  const reduce = useReduceMotion();
  const grow = useGrow(reduce, `${totals.protein}-${totals.carbs}-${totals.fat}`);

  return (
    <View style={styles.row} testID="today-macro-rings">
      <MacroDial
        label="Protein"
        current={totals.protein}
        target={targets.protein}
        color={MacroColors.protein}
        tickColor={colors.ringTick}
        textColor={colors.text}
        subColor={colors.textTertiary}
        grow={grow}
        reduce={reduce}
        idKey="protein"
      />
      <MacroDial
        label={netCarbsLensEnabled ? "Net carbs" : "Carbs"}
        current={totals.carbs}
        target={targets.carbs}
        color={MacroColors.carbs}
        tickColor={colors.ringTick}
        textColor={colors.text}
        subColor={colors.textTertiary}
        grow={grow}
        reduce={reduce}
        idKey="carbs"
      />
      <MacroDial
        label="Fat"
        current={totals.fat}
        target={targets.fat}
        color={MacroColors.fat}
        tickColor={colors.ringTick}
        textColor={colors.text}
        subColor={colors.textTertiary}
        grow={grow}
        reduce={reduce}
        idKey="fat"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 4,
  },
  dial: { alignItems: "center", gap: 4 },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  value: { ...Type.macroValue },
  unit: { ...Type.statLabel },
  label: { ...Type.body },
  goal: { ...Type.caption },
});

export default TodayDashboardMacroRings;
