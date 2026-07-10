import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

import { FontFamily, Type } from "@/constants/theme";
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
  /**
   * Ring-only mode (ENG-1225 onboarding reveal): render just the jewel
   * tick-ring + grow animation, no centre value/label — the host overlays its
   * own centre (e.g. the reveal's "Crunching…" beat → serif count-up). The
   * count-up still runs but is hidden, which is fine (cheap, keeps the API flat).
   */
  hideCenter?: boolean;
  /** De-carded v3 hero (ENG-1247): render the centre value as the 56px serif-
   *  MEDIUM `.ring-big` numeral instead of the default 48/400. */
  numeralLarge?: boolean;
  /** ENG-1465 — tap AND long-press toggle the host-owned macro-rings state,
   *  restoring the legacy `CalorieRing` gesture the v3 swap dropped (there:
   *  `Pressable onPress={onToggle} onLongPress={onToggle}` — long-press stays
   *  the power-user shortcut, the labelled "Show macros" button below the hero
   *  stays the accessible-name path). Web twin: `calorie-ring-dial.tsx`. */
  onToggle?: () => void;
}

export function CalorieRingDial({
  consumed,
  target,
  size = BASE,
  hideCenter = false,
  numeralLarge = false,
  onToggle,
}: CalorieRingDialProps) {
  const colors = useThemeColors();
  const reduce = useReduceMotion();
  // ENG-1477 — the ENG-1372 warm empty-tick swap measured 1.02:1/1.14:1
  // against the real background, worse than this token's own pre-fix
  // baseline. Grace's call (2026-07-09): every empty day uses this tick
  // colour, no warm variant.
  const tickColor = colors.ringTick;

  // Cold start / no profile yet (goal<=0): calibrating, not "0 left" — parity
  // with the legacy ring's "Start your day" (ENG-1225 ring-flag default-on).
  const isCalibrating = target <= 0;
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

  // Cold start (goal<=0): no budget/verdict yet, so show what's LOGGED (real
  // numbers always — Grace 2026-06-10), never "OVER" or a misleading "0 left".
  const centerValue = isCalibrating
    ? Math.round(consumed)
    : isOver
      ? Math.round(consumed - target)
      : Math.max(0, Math.round(target - consumed));
  const animated = useCountUp(centerValue, reduce);
  const label = isCalibrating ? "LOGGED" : isOver ? "KCAL OVER" : "KCAL LEFT";

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
        fill={tickColor}
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
    // ENG-1465 — legacy `CalorieRing` interaction restored: tap and long-press
    // both fire the macro toggle. Inert when no handler is wired (dev states,
    // onboarding reveal).
    <Pressable
      testID="calorie-ring-dial"
      onPress={onToggle}
      onLongPress={onToggle}
      disabled={!onToggle}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${BASE} ${BASE}`}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={cb} />
            <Stop offset="1" stopColor={ca} />
          </LinearGradient>
        </Defs>
        {/* White-background variant (Grace 2026-06-22): jewel bloom dropped —
            same segments + leading-cap glow, on a clean white ground. */}
        {track}
        {lit}
      </Svg>
      {hideCenter ? null : (
        <View style={styles.center} pointerEvents="none">
          <Text
            style={[
              styles.value,
              numeralLarge ? styles.valueLarge : null,
              isOver ? { color: colors.overBudgetFg } : { color: colors.text },
            ]}
          >
            {animated.toLocaleString()}
          </Text>
          <Text style={[styles.label, { color: colors.textTertiary }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
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
  // De-carded v3 hero (ENG-1247): the prototype `.ring-big` is 56px serif-MEDIUM.
  valueLarge: {
    ...Type.ringValueLg,
    fontFamily: FontFamily.serifMedium,
    fontWeight: "500" as const,
  },
  label: {
    ...Type.statLabel,
    marginTop: 4,
  },
});

export default CalorieRingDial;
