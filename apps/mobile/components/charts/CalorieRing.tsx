import { useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, Text, TurboModuleRegistry, View } from "react-native";
// App-resolved scheme (NOT the raw OS scheme) — see hooks/use-color-scheme.
import { useColorScheme } from "@/hooks/use-color-scheme";
import * as Haptics from "expo-haptics";
import { PostHogMaskView } from "posthog-react-native";
import Svg, { Circle, G } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  PREMIUM_MOTION_RING_MS,
  PREMIUM_MOTION_V1_FLAG,
  PREMIUM_MOTION_COUNT_MS,
} from "@suppr/shared/preferences/premiumMotion";

import { Accent, AccentWinGradient, Colors, MacroColors, RING_EMPTY_GRADIENT_OPACITY, Type } from "@/constants/theme";
import { ringPhase, ringPhaseEvent } from "@/lib/ringPhase";
import type { SkiaRingArcs as SkiaRingArcsT } from "./SkiaRingArcs";
import { SkiaRingErrorBoundary } from "./SkiaRingErrorBoundary";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useReduceMotion } from "@/hooks/use-reduce-motion";
import { RING_LABELS } from "@suppr/shared/copy/today";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Tween a displayed integer from its previous value to `target` over
 * `duration` ms with cubic-out easing — matches the ring sweep that
 * already animates over the same duration so the number and the
 * progress arc finish together.
 *
 * `snapOn` is a discriminator: when its value changes, the displayed
 * number snaps to `target` instantly instead of tweening. Use it to
 * suppress the count animation on a mode toggle (e.g. long-press
 * switches displayMode from "remaining" to "consumed" — counting the
 * value across modes would be confusing). Pass `displayMode` as
 * `snapOn`.
 *
 * The first render seeds the displayed value to `target`, so there is
 * no count-up animation on mount; only later changes tween.
 *
 * Why a plain RAF loop and not Reanimated `useSharedValue` +
 * `useAnimatedProps`: the RN-Reanimated pattern for animated text is
 * `Animated.createAnimatedComponent(TextInput)` with the `text` prop
 * driven from a worklet, which works but introduces a TextInput where
 * a Text is wanted (different layout / line-height defaults, harder
 * to style consistently). A 60-fps RAF loop with React state on a
 * single Text node is cheap (one node, one re-render per frame for
 * ~800ms), and sidesteps the TextInput swap. If perf becomes an
 * issue on lower-end devices, switch to the Reanimated path.
 */
function useAnimatedNumber(
  target: number,
  options?: {
    snapOn?: unknown;
    duration?: number;
    reduceMotion?: boolean;
    /** ENG-603: count up from 0 on first paint when flag is on. */
    animateFromZeroOnMount?: boolean;
  },
): number {
  const duration = options?.duration ?? 400;
  const snapOn = options?.snapOn;
  const reduceMotion = options?.reduceMotion ?? false;
  const animateFromZeroOnMount = options?.animateFromZeroOnMount ?? false;
  const [value, setValue] = useState(animateFromZeroOnMount ? 0 : target);
  const valueRef = useRef(target);
  const lastSnapRef = useRef(snapOn);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    // Mode toggle (or any explicit "snap" trigger) — jump straight to
    // the new value without tweening.
    if (snapOn !== lastSnapRef.current) {
      lastSnapRef.current = snapOn;
      setValue(target);
      return;
    }
    if (valueRef.current === target) return;
    // Reduced-motion: snap, no count-up loop.
    if (reduceMotion) {
      setValue(target);
      return;
    }
    const from = valueRef.current;
    const start = Date.now();
    let raf: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // cubic out — matches ring sweep
      const next = Math.round(from + (target - from) * eased);
      setValue(next);
      if (t < 1) raf = requestAnimationFrame(tick);
      else setValue(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, snapOn, reduceMotion]);

  return value;
}

// SLOE redesign (2026-06-04, Grace "ring too small"): the hero ring scales to
// ~46% of screen width to match the Figma 01 frame. The Sloe prototype draws
// `multiRing` at size 220 in a 500px frame (44%); the old fixed 140 read ~36%
// on an iPhone 17 — noticeably smaller than the Figma. Geometry uses the
// prototype's exact ratios (calorie radius 0.44·S, macro arcs 0.028·S) so the
// arcs keep the prototype's weight at the larger size. Capped so it can't get
// silly on a large device.
//
// ENG-1064 (TF57 F-164/165, Grace TWICE: "Today ring too fat — match macro
// ring stroke width"): in the MULTI-RING (expanded) state the hero calorie
// stroke now equals the macro stroke (0.028·S) instead of the old fatter
// 0.05·S, so the concentric rings read as one even family rather than a fat
// outer band around thin inner arcs. The collapsed SINGLE-ring mode keeps its
// confident 0.085·S Apple-class stroke — no macro rings render there, so there
// is nothing to mismatch. With the hero stroke thinned, the macro radii ratios
// were re-derived (0.3855 / 0.3310 / 0.2765) so every adjacent gap stays even
// (~6.5px at S=230, scaling proportionally) instead of leaving an awkward wide
// calorie→protein gap. R (0.44·S) is unchanged, so the ring diameters and the
// centre number layout do not shift; the innermost arc moves slightly OUTWARD,
// giving the centre numeral marginally more room (never less). Web parity:
// `src/lib/nutrition/calorieRingGeometry.ts`.
const SCREEN_W = Dimensions.get("window").width;
const BASE_SIZE = Math.round(Math.min(SCREEN_W * 0.53, 230));
// Fresh-eyes §5 (2026-06-10): the EMPTY-state hero shrinks to ~72% — a
// giant pale circle was the first thing every new user saw. The ring
// earns full size with data. All geometry derives from one scale so the
// prototype's arc ratios hold at either size.
export function ringGeometry(compact: boolean, _bold = false) {
  const SIZE = compact ? Math.round(BASE_SIZE * 0.72) : BASE_SIZE;
  const MACRO_STROKE = Math.max(4, Math.round(SIZE * 0.028));
  return {
    SIZE,
    // 2026-06-16 (founder): the calorie ring is ONE consistent stroke whether
    // macros are shown or hidden — it must not change thickness on toggle. Set
    // to 0.05·S (~11px): a clear hero over the 0.028·S (~6px) macro satellites
    // (the design-director "stroke hierarchy" call), and the same width as the
    // collapsed single ring. Supersedes the ENG-1064 split (collapsed 0.085·S /
    // expanded = macro). `_bold` retained for call-site stability.
    STROKE: Math.round(SIZE * 0.05),
    MACRO_STROKE,
    CX: SIZE / 2,
    R: Math.round(SIZE * 0.44),
    // Even-gap ratios (ENG-1064): re-derived from R=0.44·S, stroke=0.028·S and a
    // constant 0.0265·S gap so calorie→protein and the inter-macro gaps match.
    MACRO_R: [SIZE * 0.3855, SIZE * 0.331, SIZE * 0.2765],
  };
}
const CIRC = (r: number) => 2 * Math.PI * r;

type DisplayMode = "remaining" | "consumed";

type Props = {
  consumed: number;
  goal: number;
  /** The base goal before activity bonus (used to show bonus segment in a different colour) */
  baseGoal?: number;
  textColor: string;
  secondaryColor: string;
  trackColor: string;
  /** Macro progress values 0-1 */
  proteinPct?: number;
  carbsPct?: number;
  fatPct?: number;
  /** Whether expanded state showing macro rings */
  expanded?: boolean;
  /** Toggle expanded */
  onToggle?: () => void;
  /** Show remaining or consumed calories */
  /** @deprecated 2026-06-10 — the Remaining/Consumed toggle is retired; ignored. */
  displayMode?: DisplayMode;
  /** Called when user long-presses to toggle display mode. Ignored
   *  when `onLongPressExplain` is also provided — the new explainer
   *  binding takes precedence per 2026-05-12 audit. */
  onToggleDisplayMode?: () => void;
  /** 2026-05-12 (premium-bar DC1, Grace approval): when provided, the
   *  long-press gesture opens the "Why this number?" explainer
   *  instead of toggling display mode. The visible "Why this number?"
   *  pill below the ring is dropped — "the link signals low
   *  confidence; long-press signals depth" per audit. Discoverability
   *  is the trade — Apple Watch / Fitbit / Strava all hide depth
   *  behind a long-press once. */
  onLongPressExplain?: () => void;
};

function MacroRing({
  radius,
  pct,
  color,
  delay,
  cx,
  strokeW,
}: {
  radius: number;
  pct: number;
  color: string;
  delay: number;
  /** Centre + stroke from the parent's ringGeometry (§5 compact-aware). */
  cx: number;
  strokeW: number;
}) {
  const circ = CIRC(radius);
  const progress = useSharedValue(0);
  const prevPctRef = useRef(pct);

  useEffect(() => {
    const prevPct = prevPctRef.current;
    prevPctRef.current = pct;
    if (prevPct === 0 && pct > 0) {
      progress.value = 0;
      progress.value = withDelay(
        delay,
        withTiming(Math.min(pct, 0.999), {
          duration: 200,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      progress.value = withTiming(Math.min(pct, 0.999), {
        duration: 200,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [pct]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  // 2026-05-14 — Grace's call: macro arcs always render in their own
  // colour at full opacity, even when the user is over-budget. The
  // previous amber-warm-tint treatment (`dim=true` shifted arc to
  // Accent.warning at 0.6 opacity) collapsed the multi-colour
  // language into a single warning hue and made the ring read as
  // dimmer overall. The destructive outer kcal ring already carries
  // the over-budget signal — the inner arcs don't need to repeat it.
  return (
    <G>
      <Circle
        cx={cx}
        cy={cx}
        r={radius}
        fill="none"
        // Macro track = a tint of its OWN hue (Apple Fitness grammar,
        // design-director 2026-06-16) — matches the Skia path. Not frost-mist.
        stroke={color}
        strokeWidth={strokeW}
        opacity={0.28}
      />
      <AnimatedCircle
        cx={cx}
        cy={cx}
        r={radius}
        stroke={color}
        strokeWidth={strokeW}
        fill="none"
        strokeDasharray={`${circ}`}
        animatedProps={animatedProps}
        strokeLinecap="round"
        rotation="-90"
        origin={`${cx},${cx}`}
      />
    </G>
  );
}

export default function CalorieRing({
  consumed,
  goal,
  baseGoal,
  textColor,
  secondaryColor,
  trackColor,
  proteinPct = 0,
  carbsPct = 0,
  fatPct = 0,
  expanded = true,
  onToggle,
  displayMode = "consumed",
  onToggleDisplayMode,
  onLongPressExplain,
}: Props) {
  const diff = Math.round(goal - consumed);
  const isOver = consumed > goal;
  // Premium-feel papercut #2 (audit 2026-04-29): the empty-state ring
  // dominates Today's first impression — a giant `0` and "LOGGED"
  // label scream "you've done nothing today" before the user has had
  // a chance to. Soft-mode the centre when consumed is exactly 0 so
  // the suggestion card + macro tiles can lead the visual hierarchy
  // instead. Once the user logs anything, normal treatment resumes.
  // 2026-05-05 (audit R03) — also treat `goal <= 0` as empty (no
  // profile target yet). Without this guard, mobile renders gradient
  // stroke ("calibrating") while web renders destructive red over for
  // the same input — cross-platform contradiction. Both platforms now
  // fall into the calibrating-empty state until a profile target is
  // set.
  const isEmpty = consumed === 0 || goal <= 0;
  // §5: empty hero renders at 72% — see ringGeometry above.
  // 2026-06-10 (Grace): the empty hero matches populated days — full
  // size, real numbers. The §5 compact-empty experiment is retired.
  const { SIZE, STROKE, MACRO_STROKE, CX, R, MACRO_R } = ringGeometry(false, !expanded);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  /** Calorie ring colour. SLOE redesign (2026-06-03, `01 · Today` frame +
   *  `_gen.mjs multiRing`): the calorie ring is ALWAYS plum — under-budget
   *  AND over-budget. Dark mode lifts plum to #815E91 per the Sloe dark
   *  token row. */
  const calorieRingColor = useThemeColors().navPrimary; // ENG-1010: one scheme-resolved plum source
  const ringStateColor = calorieRingColor;
  // Empty-state track contrast (audit gap 1, 2026-06-09). On a cold open the
  // ring is the largest object on the screen, but the default frost-mist track
  // (#EDEAF1 light) sits only ~10 luminance below the #F6F5F2 card — the ring's
  // defining shape was nearly invisible and read as an unfinished placeholder.
  // When empty, lift the track to `borderStrong` (#C9C2D6 light / #47424F dark)
  // so the circle is unmistakable geometry. The FILLED-state track stays the
  // soft frost-mist so the plum arc keeps maximum contrast against it. Mirrors
  // web `--ring-bg-empty` on the empty-state branch of `DailyRing`.
  const emptyTrackColor = isDark
    ? Colors.dark.borderStrong
    : Colors.light.borderStrong;
  // Populated track: a saturated tint of the ring hue (Apple Fitness grammar,
  // design-director 2026-06-16) so the UNFILLED arc reads as a confident circle.
  // The old frost-mist `trackColor` (#EDEAF1) measured ~10/255 off the white
  // card — invisible, so a partly-logged ring read as empty (the common case).
  const populatedTrackColor = isDark
    ? Colors.dark.ringTrackBold
    : Colors.light.ringTrackBold;
  const outerTrackColor = isEmpty ? emptyTrackColor : populatedTrackColor;
  // 2026-06-10 (Grace's ring-content spec): the Remaining/Consumed toggle
  // is GONE — it duplicated the EATEN stat directly below the ring, and the
  // collapsed ring ignored it anyway. One semantics: remaining (or over).
  // goal<=0 (no profile target yet): judging LEFT/OVER against a zero
  // goal would lie — show what's logged, no verdict (R03 contract kept).
  const centerValue = goal > 0 ? Math.abs(diff) : Math.round(consumed);
  const centerLabel = goal <= 0
    ? RING_LABELS.logged
    : isOver
      ? RING_LABELS.over
      : RING_LABELS.remaining;
  // Thousands separator to match the ring's centre number + the GOAL/FOOD/
  // BONUS stats ("1,563") — without it the subtitle read "of 1563 kcal"
  // (Grace visual walk, 2026-06-01).
  const budgetLine = `of ${Math.round(goal).toLocaleString()} kcal`;
  const pct = goal > 0 ? Math.min(1, consumed / goal) : 0;

  // ── ring_skia_v1 (SPEC 1, 2026-06-09) ───────────────────────────────
  // The Skia arc layer replaces the SVG layer behind the flag. The module
  // is require()'d ONLY when the flag is on so a binary built without the
  // native lib can never crash on import while flagged off; if the native
  // module is missing at runtime, we fall back to SVG silently.
  const skiaFlagOn = isFeatureEnabled("ring_skia_v1");
  // ENG-1086 — paint the empty cold-open ring as a confident brand-gradient
  // loop (Skia sweep at ~0.36) instead of a grey skeleton. Default-on; off →
  // the legacy grey-track + hairline empty render. The bold collapsed-hero
  // stroke (0.085·S) is applied to the EMPTY ring only, and only on the Skia
  // path, so populated/collapsed states and the SVG fallback are untouched.
  const emptyGradientOn = isFeatureEnabled("ring_empty_gradient_v1");
  const emptyBoldStroke = Math.round(SIZE * 0.085);
  // ENG-1093 — empty + Show-macros parity. When the user shows macros on an
  // EMPTY day, render the populated multi-ring unpopulated (calorie track + 3
  // grey macro tracks) rather than the single bold cold-open loop, so it looks
  // exactly like a populated day, just empty (Grace 2026-06-13). The cold-open
  // gradient loop (ENG-1086) is therefore scoped to the COLLAPSED empty state:
  // macros shown ⇒ fall through to the multi-ring tracks. Default-on; off →
  // empty always shows the single loop (pre-ENG-1093).
  const emptyMacroParityOn = isFeatureEnabled("ring_empty_macro_parity_v1");
  // The bold gradient cold-open loop paints only when macros are HIDDEN.
  const showEmptyLoop = isEmpty && emptyGradientOn && !(emptyMacroParityOn && expanded);
  // When Skia throws at render time (JS/native version skew), fall back to SVG
  // for the rest of this mount instead of crashing the Today tab.
  const [skiaRenderFailed, setSkiaRenderFailed] = useState(false);
  const SkiaArcs: typeof SkiaRingArcsT | null = useMemo(() => {
    if (!skiaFlagOn || skiaRenderFailed) return null;
    // 2026-06-10 INCIDENT: a try/catch around the require is NOT enough —
    // in dev, a native-module throw inside a module factory red-boxes the
    // app even when the requiring code catches (TurboModuleRegistry
    // .getEnforcing crashed Grace's phone, whose dev client predates the
    // Skia pod; only the locally-built sim client had it). Probe with
    // TurboModuleRegistry.get (returns null, never throws) BEFORE touching
    // the module. Skia stays impossible to crash on, flag on or off.
    let hasSkiaNative = false;
    try {
      hasSkiaNative = TurboModuleRegistry?.get?.("RNSkiaModule") != null;
    } catch {
      hasSkiaNative = false;
    }
    if (!hasSkiaNative) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require("./SkiaRingArcs").SkiaRingArcs as typeof SkiaRingArcsT;
    } catch {
      return null;
    }
  }, [skiaFlagOn, skiaRenderFailed]);
  const overFrac = !isEmpty && isOver && goal > 0 ? Math.min(consumed / goal - 1, 1) : 0;
  const bonusFrac = !isEmpty && baseGoal && baseGoal < goal && goal > 0 ? (goal - baseGoal) / goal : 0;

  // Phase machine + haptics (ships with the Skia layer; see ringPhase.ts
  // for the contract — upward entries only, highest milestone wins).
  const [goalHitCount, setGoalHitCount] = useState(0);
  const prevPhaseRef = useRef(ringPhase(consumed, goal));
  useEffect(() => {
    if (!SkiaArcs) return; // haptic grammar ships with the Skia experience
    const next = ringPhase(consumed, goal);
    const ev = ringPhaseEvent(prevPhaseRef.current, next);
    prevPhaseRef.current = next;
    if (!ev) return;
    if (ev === "near") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else if (ev === "hit") {
      setGoalHitCount((c) => c + 1);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setTimeout(() => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 80);
    } else if (ev === "overflow") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
  }, [consumed, goal, SkiaArcs]);

  // Brightening-plum overflow stops + win glow tone (2026-06-09 decision —
  // amber rejected; scheme-resolved).
  // 2026-06-10 round 3 (Grace: "still isn't updated"): the lap ramped to
  // light lilac so fast over a short overage arc that it still READ as a
  // two-tone ring. Comps (Apple/Klima/Zero) keep the wrap within a whisper
  // of the base tone — the CAP GLOW carries the signal, not hue distance.
  // Ramp tightened: the lap ends ~1.5 shades up, not 4.
  const overflowFrom = isDark ? "#815E91" : "#5B3B6E";
  const overflowTo = isDark ? "#A589B5" : "#7A5890";
  const winGlowColor = isDark ? "#C4ACD0" : "#7E5C92";
  const mainCirc = CIRC(R);

  const progress = useSharedValue(0);
  const reduceMotion = useReduceMotion();
  const premiumMotion = isFeatureEnabled(PREMIUM_MOTION_V1_FLAG);

  // Tween from the current ring position to the new pct (do NOT snap to
  // zero first). Reanimated 3 continues the existing animation when
  // withTiming is called on an already-animating shared value.
  useEffect(() => {
    if (premiumMotion && !reduceMotion) {
      progress.value = withSpring(pct, { damping: 22, stiffness: 120 });
      return;
    }
    progress.value = withTiming(pct, {
      duration: PREMIUM_MOTION_RING_MS,
      easing: Easing.out(Easing.cubic),
    });
  }, [pct, premiumMotion, reduceMotion, progress]);

  // Light haptic feedback when logged calories change — Withings-style
  // confirmation that a new data point has landed. Skipped on mount
  // (prevConsumedRef seeds to the initial value).
  const prevConsumedRef = useRef(consumed);
  useEffect(() => {
    if (consumed !== prevConsumedRef.current && consumed > 0) {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    prevConsumedRef.current = consumed;
  }, [consumed]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: mainCirc * (1 - progress.value),
  }));

  // Tween the displayed center value over the same 800ms / cubic-out
  // curve as the ring sweep — number and arc finish together. Snaps
  // (no tween) on display-mode toggle so a long-press doesn't read as
  // a slow countdown across two different metrics. Honours system
  // reduce-motion via `useReduceMotion()`.
  const animatedCenterValue = useAnimatedNumber(centerValue, {
    snapOn: "remaining",
    reduceMotion,
    duration: premiumMotion ? PREMIUM_MOTION_COUNT_MS : 400,
    animateFromZeroOnMount: premiumMotion && !reduceMotion,
  });

  return (
    <Pressable
      onPress={onToggle}
      // 2026-05-12 (Grace TF feedback round 2): revert long-press to the
      // canonical displayMode toggle. The earlier patch wired
      // `onLongPressExplain` here so long-press would open the
      // "Why this number?" sheet, but the trade — losing the
      // expand/displayMode lock-step gesture — was the wrong call.
      // The explainer now lives on a subtle inline affordance below
      // the ring (see TodayHeroRing). Long-press stays the power-user
      // shortcut for ring state.
      // displayMode retired (2026-06-10) — long-press matches tap: macro toggle.
      onLongPress={onToggle}
      style={{ alignItems: "center" }}
    >
      <View
        style={{
          width: SIZE,
          height: SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {SkiaArcs ? (
          // ring_skia_v1 — Skia arc layer (SPEC 1). Centre overlay below is
          // shared with the SVG path; only the arcs swap renderers.
          <SkiaRingErrorBoundary onFallback={() => setSkiaRenderFailed(true)}>
          <SkiaArcs
            geom={{
              SIZE,
              // ENG-1086: the empty ring wears the confident collapsed-hero
              // stroke (0.085·S) so the gradient loop reads as intentional, not
              // a thin skeleton. ENG-1093: only while the loop is shown (macros
              // hidden) — macros shown ⇒ the thin multi-ring stroke so the empty
              // ring matches a populated one. Populated keeps its existing stroke.
              STROKE: showEmptyLoop ? emptyBoldStroke : STROKE,
              MACRO_STROKE,
              CX,
              R,
              MACRO_R,
            }}
            fillPct={pct}
            overFrac={overFrac}
            bonusFrac={bonusFrac}
            macroPcts={[proteinPct, carbsPct, fatPct]}
            macroColors={[MacroColors.protein, MacroColors.carbs, MacroColors.fat]}
            trackColor={outerTrackColor}
            emptyInnerColor={emptyTrackColor}
            ringColor={isEmpty ? outerTrackColor : ringStateColor}
            bonusColor={Accent.activity}
            overflowFrom={overflowFrom}
            overflowTo={overflowTo}
            glowColor={winGlowColor}
            isEmpty={isEmpty}
            isOver={isOver}
            expanded={expanded}
            goalHitCount={goalHitCount}
            emptyGradient={showEmptyLoop}
            emptyMacroParity={emptyMacroParityOn}
            emptyGradientStops={AccentWinGradient.stops}
            emptyGradientOpacity={RING_EMPTY_GRADIENT_OPACITY}
          />
          </SkiaRingErrorBoundary>
        ) : (
        <Svg width={SIZE} height={SIZE} style={{ position: "absolute" }}>
          {/* SLOE redesign (2026-06-03): the MFP-style diagonal hash that
              previously marked the over-budget portion is replaced by a
              clean red overage ARC (see the over-budget segment below) to
              match the `01 · Today` Figma frame + `_gen.mjs multiRing`. The
              `overHash` Pattern is gone. */}
          {/* SLOE 2026-06-03 (Grace decision): removed the blue "ringIdle"
              calibrating gradient too — the empty ring now uses the Sloe
              grey track per the S5 empty-Today frame. No Svg <Defs> remain
              on this ring: every state strokes a plain `Circle`. */}
          {/* Outer calorie ring track — Sloe grey track in ALL states incl.
              empty (Grace 2026-06-03: empty ring = grey track per the S5
              frame, not the old blue "calibrating" gradient). On the EMPTY
              state the track lifts to `borderStrong` (audit gap 1) so the
              ring's shape reads on a cold open instead of disappearing into
              the near-tonal card; the filled state keeps the soft frost-mist
              so the plum arc holds contrast. */}
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={outerTrackColor}
            strokeWidth={STROKE}
            opacity={1}
          />
          {/* Empty-state inner hairline (audit gap 1) — a 1px ring just inside
              the track so the empty circle reads as intentional geometry, not
              a faint outline. Sits at the track's inner edge. Hidden the moment
              anything is logged (the plum arc then carries the shape). ENG-1093:
              also hidden when macros are shown on an empty day — the multi-ring
              tracks below carry the shape, matching a populated day. */}
          {isEmpty && !(emptyMacroParityOn && expanded) ? (
            <Circle
              cx={CX}
              cy={CX}
              r={R - STROKE / 2 - 1}
              fill="none"
              stroke={emptyTrackColor}
              strokeWidth={1}
              opacity={0.7}
            />
          ) : null}
          {/* Bonus calorie segment (orange). Canonical 2026-05-22 v4
              multi-ring revival: when exercise has bumped the daily
              goal above the base target, render the "earned" territory
              as an orange arc at the end of the ring. This restores
              the MFP visual language MFP-defectors specifically asked
              for ("I want to see my burn in the ring"). Renders behind
              the food fill so consumed calories overlap correctly when
              the user eats into the bonus territory. */}
          {!isEmpty && baseGoal && baseGoal < goal && goal > 0 ? (
            (() => {
              const bonusFraction = (goal - baseGoal) / goal;
              const bonusLen = mainCirc * bonusFraction;
              return (
                <Circle
                  cx={CX}
                  cy={CX}
                  r={R}
                  fill="none"
                  // 2026-05-25 — bonus uses Accent.activity (Yellow
                  // #F3C336) to match the activity/burn card +
                  // burn-detail screen which now use the dedicated
                  // activity token for "earned via exercise" semantics.
                  // Carbs vacated Yellow for amber-orange; the bonus arc
                  // moved with the activity family so it stays distinct
                  // from the orange warning/over-budget signals.
                  stroke={Accent.activity}
                  strokeWidth={STROKE}
                  strokeDasharray={`${bonusLen} ${mainCirc}`}
                  strokeDashoffset={-(mainCirc - bonusLen)}
                  rotation="-90"
                  origin={`${CX},${CX}`}
                />
              );
            })()
          ) : null}
          {/* Food progress: the PLUM calorie arc (Sloe redesign — plum
              under AND over). When over, this is a FULL plum ring (offset 0)
              and the Apple-Watch overage LAP below wraps on top of it to carry
              the over-budget signal. Empty = no visible arc. Renders ON TOP of
              the bonus segment so the plum arc visibly "eats into" the honey
              bonus when consumption exceeds the base goal. */}
          <AnimatedCircle
            cx={CX}
            cy={CX}
            r={R}
            stroke={
              isEmpty
                ? outerTrackColor
                : ringStateColor
            }
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${mainCirc}`}
            animatedProps={animatedProps}
            strokeLinecap="round"
            rotation="-90"
            origin={`${CX},${CX}`}
          />
          {/* Over-budget: NO overage lap (2026-06-10 category survey —
              Lifesum/MFP/Cal AI cap the ring at full; the centre verdict
              carries the overage. Supersedes the 2026-06-04 Apple-wrap
              decision, which benchmarked ACTIVITY rings — the wrong
              comparable for a food budget). The plum arc above renders
              the full circle when over. */}
          {/* Inner macro arcs — Canonical 2026-05-22 v4 multi-ring revival.
              Restored after the brief C1 single-ring experiment. Each
              macro gets its own concentric arc inside the calorie ring,
              following the TF49 multi-ring grammar that MFP-defectors
              are familiar with. Stroke trimmed 6.5 → 6 (variant A1) so
              the centre kcal value remains the clear focal point.
              Hidden in empty state — three nested grey tracks read as
              wireframe placeholder, not an intentional "ready" state. */}
          {expanded ? (
            <>
              <MacroRing
                cx={CX}
                strokeW={MACRO_STROKE}
                radius={MACRO_R[0]}
                pct={proteinPct}
                color={MacroColors.protein}
                delay={100}
              />
              <MacroRing
                cx={CX}
                strokeW={MACRO_STROKE}
                radius={MACRO_R[1]}
                pct={carbsPct}
                color={MacroColors.carbs}
                delay={200}
              />
              <MacroRing
                cx={CX}
                strokeW={MACRO_STROKE}
                radius={MACRO_R[2]}
                pct={fatPct}
                color={MacroColors.fat}
                delay={300}
              />
            </>
          ) : null}
        </Svg>
        )}
        {/* Center text — number tweens to `centerValue` via
            `useAnimatedNumber`. The displayed integer counts up
            smoothly when the user logs a meal, finishing with the
            ring sweep (~800ms cubic out). Snaps on displayMode
            toggle. Empty state (audit 2026-04-29 papercut #2)
            replaces the giant "0" with a softer "Start your day"
            invitation so the empty ring stops dominating the screen. */}
        {/* N5 (2026-05-03): empty-state soft copy now fires in BOTH
            display modes (was previously gated to `consumed` only,
            which left the default REMAINING view showing a giant
            ring number that read as a wireframe placeholder before
            the user had logged anything). N3 (2026-05-03): centre
            value renders with `.toLocaleString()` so 4-digit kcal
            ("1,832") matches the budget line below. */}
        {/* 2026-06-10 (Grace): the empty centre shows REAL numbers —
            "{goal} LEFT" — matching populated days (supersedes the
            2026-04-29 'Start your day' soft-empty + the 2026-05-23
            invitation copy). */}
        {(
          // ENG-534 P1 (2026-05-16): centre kcal value is MEDIUM-class
          // (running daily total — high frequency in replays, valuable
          // signal at aggregate). Wrap in PostHogMaskView so replay
          // renders the number as a grey block. The empty-state copy
          // above is intentionally NOT masked — "Start your day" is
          // generic UI copy. See
          // `docs/operations/session-replay-masking-audit.md`.
          <PostHogMaskView>
            {/* SLOE redesign (2026-06-03): the centre kcal value reads in
                Newsreader (serif `Type.ringValue`) to match the
                `01 · Today` frame's `font-headline text-5xl` ring numeral.
                Was Inter (`Type.macroValue`). */}
            <Text
              style={{
                ...Type.ringValue,
                color: textColor,
                fontVariant: ["tabular-nums"],
              }}
            >
              {animatedCenterValue.toLocaleString()}
            </Text>
          </PostHogMaskView>
        )}
        {/* Centre sub-label. SLOE redesign (2026-06-04, Grace "match Figma
            exactly"): in REMAINING mode the centre reads the Figma 01
            "of {goal} kcal left" budget line (shown even when the multi-ring
            is expanded — it replaces the uppercase status word, so there's
            no inner-arc clipping concern). CONSUMED keeps "LOGGED" + a
            collapsed "of {goal} kcal"; OVER keeps "OVER". Hidden in the
            empty state — the "Start your day" copy above already leads. */}
        <Text
          style={{
            ...Type.label,
            color: textColor,
            marginTop: 1,
          }}
        >
          {centerLabel}
        </Text>
        {/* Budget line — collapsed only (Grace 2026-06-10: macros hidden =
            more room, show the goal context; expanded keeps just the label
            and the stats row below carries the explicit goal). */}
        {goal > 0 && !expanded ? (
          <PostHogMaskView>
            <Text
              style={{
                ...Type.caption,
                color: secondaryColor,
                marginTop: 1,
                fontVariant: ["tabular-nums"],
              }}
            >
              {budgetLine}
            </Text>
          </PostHogMaskView>
        ) : null}
      </View>
      {/* 2026-05-14 — Grace's call: removed the
          fraction + delta chip row below the ring. The hero kcal
          inside the ring already shows the running total, and
          long-press on the ring surfaces the over/remaining detail
          — duplicating it as a static line under the ring was
          redundant. */}
    </Pressable>
  );
}
