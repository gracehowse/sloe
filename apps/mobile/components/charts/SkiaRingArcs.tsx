/**
 * SkiaRingArcs — the Skia-rendered arc layer of the hero calorie ring
 * (SPEC 1, docs/ux/specs/2026-06-09-skia-ring-cta-map-serif-titles.md;
 * flag `ring_skia_v1`).
 *
 * Drop-in replacement for `CalorieRing`'s react-native-svg arc block ONLY —
 * the centre number, display-mode toggle, haptics and state machine stay in
 * the host (`CalorieRing.tsx` picks the layer via the flag). Geometry comes
 * from the host's `ringGeometry` so the prototype ratios + the §5 compact
 * empty state hold identically on both renderers.
 *
 * What Skia buys over the SVG layer:
 *   - Antialiased arcs with true round caps (the SVG ring shows faint
 *     stair-stepping on the plum arc at 3x).
 *   - The over-budget OVERFLOW lap as a brightening-plum SweepGradient
 *     (decided 2026-06-09, amber REJECTED — see
 *     docs/decisions/2026-06-09-ring-overflow-brightening-plum.md):
 *     light #5B3B6E → #9A7BAA, dark #815E91 → #C4ACD0, with a real
 *     BlurMask glow on the leading cap (the SVG layer fakes this with two
 *     stacked opacity dots — react-native-svg can't blur without <Defs>).
 *   - A goal-hit glow arc (BlurMask STROKE×0.9) pulsing 0→0.6→0 over 600ms.
 *
 * IMPORTANT — native dependency: `@shopify/react-native-skia` is linked in
 * the current dev clients (Podfile.lock since the Sloe redesign build), but
 * this module must only be require()'d behind the flag so a future client
 * built WITHOUT the lib can't crash on import while the flag is off.
 *
 * Animation: Reanimated SharedValues drive Skia path `end` props on the UI
 * thread (`useDerivedValue` interop). Fill = withSpring(Motion.springSoft,
 * overshootClamping). Reduce-motion: values jump instantly; the goal-hit
 * glow renders a static 0.3-opacity frame for 600ms instead of pulsing.
 */
import { useEffect, useMemo } from "react";
import {
  BlurMask,
  Canvas,
  Group,
  Path,
  Skia,
  SweepGradient,
  vec,
} from "@shopify/react-native-skia";
import {
  useDerivedValue,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Motion } from "@/constants/motion";

export type SkiaRingGeometry = {
  SIZE: number;
  STROKE: number;
  MACRO_STROKE: number;
  CX: number;
  R: number;
  MACRO_R: number[];
};

export type SkiaRingArcsProps = {
  geom: SkiaRingGeometry;
  /** Calorie fill as a fraction of goal, clamped 0..1 by the host. */
  fillPct: number;
  /** Overflow lap fraction past 100%, clamped 0..1 (≤ one extra lap). */
  overFrac: number;
  /** Activity-bonus territory as a fraction of goal (0 when none). */
  bonusFrac: number;
  /** Macro fills 0..1 — [protein, carbs, fat]. */
  macroPcts: [number, number, number];
  macroColors: [string, string, string];
  macroTrackColor: string;
  trackColor: string;
  emptyInnerColor: string;
  ringColor: string;
  bonusColor: string;
  /** Brightening-plum overflow gradient stops (scheme-resolved by host). */
  overflowFrom: string;
  overflowTo: string;
  /** Goal-hit glow tone (win-gradient end-tone, scheme-resolved). */
  glowColor: string;
  isEmpty: boolean;
  isOver: boolean;
  expanded: boolean;
  /** Monotonic counter — increments when the ring crosses 100% (goal hit).
   *  Triggers the 600ms glow pulse. 0 = never hit this mount. */
  goalHitCount: number;
};

/** Full-circle stroke path at radius r, starting 12 o'clock, sweeping CW. */
function circlePath(cx: number, r: number) {
  const p = Skia.Path.Make();
  p.addArc(
    { x: cx - r, y: cx - r, width: r * 2, height: r * 2 },
    -90,
    360,
  );
  return p;
}

export function SkiaRingArcs({
  geom,
  fillPct,
  overFrac,
  bonusFrac,
  macroPcts,
  macroColors,
  macroTrackColor,
  trackColor,
  emptyInnerColor,
  ringColor,
  bonusColor,
  overflowFrom,
  overflowTo,
  glowColor,
  isEmpty,
  isOver,
  expanded,
  goalHitCount,
}: SkiaRingArcsProps) {
  const { SIZE, STROKE, MACRO_STROKE, CX, R, MACRO_R } = geom;
  const reduceMotion = useReducedMotion();

  const mainPath = useMemo(() => circlePath(CX, R), [CX, R]);
  const macroPaths = useMemo(
    () => MACRO_R.map((r) => circlePath(CX, r)),
    [CX, MACRO_R],
  );

  // ── Fill animation (spec: withSpring springSoft, clamped; UI thread) ──
  const fill = useSharedValue(reduceMotion ? fillPct : 0);
  useEffect(() => {
    if (reduceMotion) {
      fill.value = fillPct;
      return;
    }
    fill.value = withSpring(fillPct, Motion.springSoft);
  }, [fillPct, reduceMotion, fill]);
  const fillEnd = useDerivedValue(() => Math.min(fill.value, 0.999));

  // ── Overflow lap sweep ──
  const over = useSharedValue(reduceMotion ? overFrac : 0);
  useEffect(() => {
    if (reduceMotion) {
      over.value = overFrac;
      return;
    }
    over.value = withSpring(overFrac, Motion.springSoft);
  }, [overFrac, reduceMotion, over]);
  const overEnd = useDerivedValue(() => Math.min(over.value, 0.999));

  // ── Macro arcs (200ms timing — parity with the SVG MacroRing) ──
  const m0 = useSharedValue(0);
  const m1 = useSharedValue(0);
  const m2 = useSharedValue(0);
  useEffect(() => {
    const vals = [m0, m1, m2];
    macroPcts.forEach((pct, i) => {
      const target = Math.min(pct, 0.999);
      if (reduceMotion) {
        vals[i]!.value = target;
        return;
      }
      vals[i]!.value = withDelay(i * 60, withTiming(target, { duration: 200 }));
    });
  }, [macroPcts, reduceMotion, m0, m1, m2]);
  const m0End = useDerivedValue(() => m0.value);
  const m1End = useDerivedValue(() => m1.value);
  const m2End = useDerivedValue(() => m2.value);

  // ── Goal-hit glow: 0→0.6→0 over 600ms (reduce-motion: static 0.3) ──
  const glow = useSharedValue(0);
  useEffect(() => {
    if (goalHitCount <= 0) return;
    if (reduceMotion) {
      glow.value = 0.3;
      glow.value = withDelay(600, withTiming(0, { duration: 0 }));
      return;
    }
    glow.value = withSequence(
      withTiming(0.6, { duration: 240 }),
      withTiming(0, { duration: 360 }),
    );
  }, [goalHitCount, reduceMotion, glow]);
  const glowOpacity = useDerivedValue(() => glow.value);

  const macroEnds = [m0End, m1End, m2End];
  const bonusStart = Math.max(0, Math.min(1, 1 - bonusFrac));
  // Hoisted (hooks must not live inside conditional JSX): the overflow
  // leading-cap glow trails the lap end by ~6% of the circle.
  const overGlowStart = useDerivedValue(() => Math.max(0, overEnd.value - 0.06));

  return (
    <Canvas
      style={{ position: "absolute", width: SIZE, height: SIZE }}
      testID="skia-ring-arcs"
    >
      {/* Outer calorie track (grey in all states — Grace 2026-06-03). */}
      <Path
        path={mainPath}
        style="stroke"
        strokeWidth={STROKE}
        color={trackColor}
      />
      {/* Empty-state inner hairline (audit gap 1 parity with the SVG layer). */}
      {isEmpty ? (
        <Path
          path={circlePath(CX, R - STROKE / 2 - 1)}
          style="stroke"
          strokeWidth={1}
          color={emptyInnerColor}
          opacity={0.7}
        />
      ) : null}
      {/* Activity-bonus territory — a quiet honey TINT on the track
          (2026-06-10: the solid honey block read as another colour blob;
          earned territory is context, not content — it sits at low
          opacity behind the ribbon and lets the fill claim it). */}
      {!isEmpty && bonusFrac > 0 ? (
        <Path
          path={mainPath}
          style="stroke"
          strokeWidth={STROKE}
          color={bonusColor}
          opacity={0.28}
          start={bonusStart}
          end={1}
        />
      ) : null}
      {/* Food fill — ONE continuous ribbon of light (2026-06-10, Grace:
          the contrasting overage segment read as a cheap blob; comps —
          Any Distance / Klima / Zero — all keep ONE hue and let light +
          depth signal the wrap). The sweep gradient runs base → bright
          across the full lap, so the arc brightens as it fills; past
          100% the second lap continues the same gradient to the glowing
          cap. No seam, no second colour. */}
      {!isEmpty ? (
        <Path
          path={mainPath}
          style="stroke"
          strokeWidth={STROKE}
          strokeCap="round"
          start={0}
          end={fillEnd}
        >
          <SweepGradient
            c={vec(CX, CX)}
            start={-90}
            end={270}
            colors={[ringColor, overflowFrom]}
          />
        </Path>
      ) : null}
      {/* Goal-hit glow lap (600ms pulse on goalHitCount). */}
      {!isEmpty ? (
        <Path
          path={mainPath}
          style="stroke"
          strokeWidth={STROKE}
          strokeCap="round"
          color={glowColor}
          opacity={glowOpacity}
          start={0}
          end={fillEnd}
        >
          <BlurMask blur={STROKE * 0.9} style="normal" />
        </Path>
      ) : null}
      {/* Over-budget second lap — the SAME ribbon continuing (2026-06-09
          brightening-plum decision + 2026-06-10 continuity fix). The lap's
          gradient STARTS where the first lap ENDED (overflowFrom) and keeps
          brightening to the lilac cap. A soft dark shadow under the leading
          cap carries the overlap depth (the Apple/Klima wrap grammar), and
          the blurred glow rides the cap itself. */}
      {!isEmpty && isOver && overFrac > 0 ? (
        <Group>
          {/* Overlap depth: cap shadow UNDER the lap's leading edge. */}
          <Path
            path={mainPath}
            style="stroke"
            strokeWidth={STROKE * 1.15}
            strokeCap="round"
            color="#000000"
            opacity={0.18}
            start={overGlowStart}
            end={overEnd}
          >
            <BlurMask blur={STROKE * 0.5} style="normal" />
          </Path>
          <Path
            path={mainPath}
            style="stroke"
            strokeWidth={STROKE}
            strokeCap="round"
            start={0}
            end={overEnd}
          >
            <SweepGradient
              c={vec(CX, CX)}
              start={-90}
              end={-90 + 360 * Math.max(overFrac, 0.04)}
              colors={[overflowFrom, overflowTo]}
            />
          </Path>
          {/* Leading-cap glow — light marks the wrap, not colour. */}
          <Path
            path={mainPath}
            style="stroke"
            strokeWidth={STROKE}
            strokeCap="round"
            color={overflowTo}
            opacity={0.5}
            start={overGlowStart}
            end={overEnd}
          >
            <BlurMask blur={STROKE * 0.8} style="normal" />
          </Path>
        </Group>
      ) : null}
      {/* Inner macro arcs (multi-ring) — track + fill per macro. */}
      {!isEmpty && expanded
        ? MACRO_R.map((r, i) => (
            <Group key={i}>
              <Path
                path={macroPaths[i]!}
                style="stroke"
                strokeWidth={MACRO_STROKE}
                color={macroTrackColor}
                opacity={0.4}
              />
              <Path
                path={macroPaths[i]!}
                style="stroke"
                strokeWidth={MACRO_STROKE}
                strokeCap="round"
                color={macroColors[i]!}
                start={0}
                end={macroEnds[i]!}
              />
            </Group>
          ))
        : null}
    </Canvas>
  );
}

export default SkiaRingArcs;
