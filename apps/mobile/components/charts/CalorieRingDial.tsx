import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";

import { Type } from "@/constants/theme";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * CalorieRingDial — Sloe v3 "jewel dial" calorie ring (mobile, react-native-svg).
 *
 * Parity twin of `src/app/components/suppr/calorie-ring-dial.tsx`: a 48-segment
 * watch dial. Frost graduation ticks form the dial; progressed segments light
 * with the state gradient (Colors.ringUnder/Over/Empty A/B), reveal as `grow`
 * sweeps 0→1 on mount, and the leading segment carries a luminous white gem
 * core; a soft radial bloom sits behind.
 *
 * Geometry is authored in a 224 base viewBox (identical to web) and scales to
 * `size`. NOTE: every lit tick MUST carry the `rotation` transform around the
 * centre — without it the lit segments stack at 12 o'clock (the bug SEEing the
 * web ring caught).
 */

const BASE = 224;
const CX = BASE / 2;
const N = 48;

/** Tween a value 0→1 (cubic-out) over `duration`, reduced-motion aware. */
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
      const t = Math.min(1, (Date.now() - start) / 1050);
      setGrow(1 - Math.pow(1 - t, 3));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restartKey, reduce]);
  return grow;
}

/** Count an integer 0→value (cubic-out), reduced-motion aware. */
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
      const t = Math.min(1, (Date.now() - start) / 1050);
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
  const colors = useThemeColors();
  const reduce = useReduceMotion();

  const isEmpty = consumed === 0 || target <= 0;
  const isOver = target > 0 && consumed > target;
  const pct = target > 0 ? Math.min(1, consumed / target) : 0;

  const grow = useGrow(reduce, `${consumed}-${target}`);
  const drawn = (isEmpty ? 0.004 : pct) * grow;

  const stateKey = isOver ? "over" : isEmpty ? "empty" : "under";
  const gid = `crd-${stateKey}`;
  const [ca, cb] =
    stateKey === "over"
      ? [colors.ringOverA, colors.ringOverB]
      : stateKey === "under"
        ? [colors.ringUnderA, colors.ringUnderB]
        : [colors.ringEmptyA, colors.ringEmptyB];

  const centerValue = isOver
    ? Math.round(consumed - target)
    : Math.max(0, Math.round(target - consumed));
  const animated = useCountUp(centerValue, reduce);
  const label = isOver ? "KCAL OVER" : "KCAL LEFT";

  const track: React.ReactNode[] = [];
  const lit: React.ReactNode[] = [];
  for (let i = 0; i < N; i++) {
    const ang = i * (360 / N);
    const frac = i / N;
    const on = frac <= drawn + 0.0001;
    const lead = on && (i + 1) / N > drawn;
    track.push(
      <Rect
        key={`t${i}`}
        x={CX - 2.1}
        y={11}
        width={4.2}
        height={14}
        rx={2.1}
        fill={colors.ringTick}
        rotation={ang}
        originX={CX}
        originY={CX}
      />,
    );
    lit.push(
      <Rect
        key={`l${i}`}
        x={CX - 2.1}
        y={8.5}
        width={4.2}
        height={19}
        rx={2.1}
        fill={`url(#${gid})`}
        opacity={on ? 1 : 0}
        rotation={ang}
        originX={CX}
        originY={CX}
      />,
    );
    if (lead) {
      lit.push(
        <Rect
          key={`g${i}`}
          x={CX - 1.1}
          y={9.5}
          width={2.2}
          height={6}
          rx={1.1}
          fill={colors.ringCapCore}
          opacity={0.92}
          rotation={ang}
          originX={CX}
          originY={CX}
        />,
      );
    }
  }

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${BASE} ${BASE}`}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={cb} />
            <Stop offset="1" stopColor={ca} />
          </LinearGradient>
          <RadialGradient id={`${gid}-core`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={cb} stopOpacity={0.22} />
            <Stop offset="0.42" stopColor={cb} stopOpacity={0.07} />
            <Stop offset="0.72" stopColor={cb} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id={`${gid}-rim`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.62" stopColor={cb} stopOpacity={0} />
            <Stop offset="0.88" stopColor={cb} stopOpacity={0.1} />
            <Stop offset="1" stopColor={cb} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={CX} cy={CX} r={96} fill={`url(#${gid}-rim)`} opacity={grow} />
        <Circle cx={CX} cy={CX} r={80} fill={`url(#${gid}-core)`} opacity={grow} />
        {track}
        {lit}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text
          style={[
            styles.value,
            isOver ? { color: colors.overBudgetFg } : { color: colors.text },
          ]}
        >
          {animated.toLocaleString()}
        </Text>
        <Text style={[styles.label, { color: colors.textTertiary }]}>
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  value: {
    ...Type.ringValue,
  },
  label: {
    ...Type.statLabel,
    marginTop: 4,
  },
});

export default CalorieRingDial;
