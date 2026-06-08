import * as React from "react";
import {
  LayoutChangeEvent,
  Pressable,
  Text,
  TextInput,
  View,
  ViewStyle,
  StyleProp,
} from "react-native";
import Svg, { Line, Text as SvgText } from "react-native-svg";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { Radius } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * RulerSlider — iOS-style horizontal ruler picker for mobile.
 *
 * Mirrors `src/app/components/suppr/ruler-slider.tsx` (web). Used by
 * onboarding for height and weight (steps 06 + 07).
 *
 * Inputs:
 *  - drag horizontally (Pan gesture) to scrub the value
 *  - tap the big number → number editor (return to commit, blur to cancel)
 *
 * Notes:
 *  - We render only the ~50 ticks within the visible window so re-render
 *    cost is bounded as the user drags. Re-renders run on JS thread —
 *    if perf becomes an issue once wired into onboarding, swap the SVG
 *    layer to a Reanimated worklet (sharedValue → useDerivedValue → SVG
 *    transform) and only sync to React state on gesture end.
 *  - Custom formatting is supported via `format` (display) + `parseInput`
 *    (typed-input parsing).
 */

const PX_PER_STEP = 8;
const TRACK_HEIGHT = 64;

export interface RulerSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  decimals?: number;
  /** Suffix shown next to the number readout (ignored when `format` is set). */
  unit?: string;
  /** Render override for the big number (e.g. imperial height). */
  format?: (value: number) => string;
  /** Parse override for typed-input mode. */
  parseInput?: (text: string) => number;
  /** Pixel width of the ruler track. Defaults to fill (use parent's width). */
  width?: number;
  /** Accent colour string. Defaults to brand primary. */
  accent?: string;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

export function RulerSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  unit,
  format,
  parseInput,
  width,
  accent: accentProp,
  style,
  accessibilityLabel = "Value",
}: RulerSliderProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay). Callers may override via
  // the `accent` prop; otherwise default to the flag-aware secondary accent.
  const themeAccent = useAccent();
  const accent = accentProp ?? themeAccent.primary;

  const [measuredWidth, setMeasuredWidth] = React.useState(width ?? 320);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState("");
  const startValueRef = React.useRef(value);
  // 2026-05-12 — stabilise the Pan gesture across renders. The previous
  // implementation re-created the gesture inside `useMemo` whose deps
  // included `value` + `onChange`. Every drag tick called `onChange`,
  // which re-rendered the parent and minted a new gesture object;
  // GestureDetector then tore down the in-flight handler while the
  // worklet event pipeline still held a reference to it, causing a
  // pending-JS-exception abort inside Hermes (see the .ips trace in
  // ~/Library/Logs/DiagnosticReports — RNGestureHandlerManager →
  // ReanimatedModuleProxy::handleEvent → throwPendingError). Routing
  // `value` and `onChange` through refs keeps the gesture object
  // identity stable for the lifetime of the slider.
  const valueRef = React.useRef(value);
  const onChangeRef = React.useRef(onChange);
  React.useEffect(() => {
    valueRef.current = value;
  }, [value]);
  React.useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const trackWidth = width ?? measuredWidth;
  const range = max - min;
  const steps = Math.round(range / step);
  const majorEvery = decimals > 0 ? Math.round(1 / step) : 10;
  const midEvery = Math.max(1, Math.round(majorEvery / 2));

  const roundTo = React.useCallback(
    (v: number) => {
      const p = Math.pow(10, Math.max(decimals, 2));
      return Math.round(v * p) / p;
    },
    [decimals],
  );
  const clamp = React.useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max],
  );
  const snap = React.useCallback(
    (v: number) => roundTo(Math.round((v - min) / step) * step + min),
    [min, step, roundTo],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    if (width) return;
    const w = e.nativeEvent.layout.width;
    if (w && Math.abs(w - measuredWidth) > 0.5) setMeasuredWidth(w);
  };

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        // 2026-05-12 (Grace TF) — `.runOnJS(true)` forces RNGH to fire
        // callbacks on the JS thread directly, bypassing the Reanimated
        // worklet event bridge. Without it, every Pan event is routed
        // through `worklets::EventHandlerRegistry::processEvent`, which
        // on RNGH 2.28 + Reanimated 4.1 + new arch + iOS 26 sim throws
        // a pending JS exception inside Hermes and SIGABRTs the app
        // (see ~/Library/Logs/DiagnosticReports/Suppr-2026-05-12-094424.ips).
        // We have zero worklets in this component — there is nothing
        // useful for the worklet runtime to do on this gesture — so
        // skipping that path is both safer and matches the JS-thread
        // semantics our handlers already rely on (parent React state
        // updates can't run on the UI thread anyway).
        .runOnJS(true)
        .onBegin(() => {
          startValueRef.current = valueRef.current;
        })
        .onChange((evt) => {
          const dv = -evt.translationX * (step / PX_PER_STEP);
          onChangeRef.current(snap(clamp(startValueRef.current + dv)));
        }),
    [step, snap, clamp],
  );

  const commitDraft = () => {
    const n = parseInput ? parseInput(draft) : parseFloat(draft);
    if (!Number.isNaN(n)) onChange(snap(clamp(n)));
    setEditing(false);
  };

  const displayVal = format
    ? format(value)
    : decimals > 0
      ? value.toFixed(decimals)
      : String(Math.round(value));

  // --- Ticks -------------------------------------------------------------
  const centerX = trackWidth / 2;
  const valueOffset = ((value - min) / step) * PX_PER_STEP;
  const leftEdge = -centerX + valueOffset;
  const rightEdge = trackWidth - centerX + valueOffset;
  const firstIdx = Math.max(0, Math.floor(leftEdge / PX_PER_STEP));
  const lastIdx = Math.min(steps, Math.ceil(rightEdge / PX_PER_STEP));

  const ticks: React.ReactNode[] = [];
  for (let i = firstIdx; i <= lastIdx; i++) {
    const x = centerX + (i * PX_PER_STEP - valueOffset);
    const isMajor = i % majorEvery === 0;
    const isMid = !isMajor && i % midEvery === 0;
    const tickH = isMajor ? 30 : isMid ? 18 : 10;
    const tickColor = isMajor ? colors.text : colors.textSecondary;
    const opacity = isMajor ? 0.9 : isMid ? 0.55 : 0.3;

    ticks.push(
      <Line
        key={`t-${i}`}
        x1={x}
        x2={x}
        y1={8}
        y2={8 + tickH}
        stroke={tickColor}
        strokeWidth={1}
        opacity={opacity}
      />,
    );
    if (isMajor) {
      const v = roundTo(min + i * step);
      const label = decimals > 0 ? v.toFixed(0) : String(v);
      ticks.push(
        <SvgText
          key={`l-${i}`}
          x={x}
          y={56}
          fontSize={10}
          textAnchor="middle"
          fill={colors.textSecondary}
          opacity={0.7}
        >
          {label}
        </SvgText>,
      );
    }
  }

  return (
    <View style={[{ width: width ?? "100%" }, style]} onLayout={onLayout}>
      {/* Big number readout */}
      <View style={{ alignItems: "center", marginBottom: 12 }}>
        {editing ? (
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
            <TextInput
              autoFocus
              value={draft}
              onChangeText={setDraft}
              onBlur={() => setEditing(false)}
              onSubmitEditing={commitDraft}
              keyboardType={parseInput ? "default" : "decimal-pad"}
              accessibilityLabel={accessibilityLabel}
              style={{
                color: colors.text,
                fontSize: 60,
                fontWeight: "800",
                letterSpacing: -2,
                textAlign: "center",
                minWidth: 130,
                paddingVertical: 0,
                borderBottomWidth: 3,
                borderBottomColor: accent,
                includeFontPadding: false,
              }}
            />
            {unit && !format ? (
              <Text
                style={{
                  fontSize: 18,
                  color: colors.textSecondary,
                  fontWeight: "600",
                }}
              >
                {unit}
              </Text>
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setDraft(String(displayVal));
              setEditing(true);
            }}
            accessibilityRole="adjustable"
            accessibilityLabel={`${accessibilityLabel}, ${displayVal}${unit ? " " + unit : ""}`}
            accessibilityValue={{ now: value, min, max }}
            style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}
          >
            <Text
              style={{
                color: colors.text,
                fontSize: 60,
                fontWeight: "800",
                letterSpacing: -2.1,
                lineHeight: 60,
                includeFontPadding: false,
              }}
            >
              {displayVal}
            </Text>
            {unit && !format ? (
              <Text
                style={{
                  fontSize: 18,
                  color: colors.textSecondary,
                  fontWeight: "600",
                  marginLeft: 2,
                }}
              >
                {unit}
              </Text>
            ) : null}
          </Pressable>
        )}
        <Text
          style={{
            marginTop: 6,
            fontSize: 11,
            fontWeight: "600",
            color: colors.textTertiary,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {editing ? "Type · Return to save" : "Drag the ruler · or tap number"}
        </Text>
      </View>

      {/* Ruler track */}
      <GestureDetector gesture={pan}>
        <View
          style={{
            height: TRACK_HEIGHT,
            width: "100%",
            borderRadius: Radius.lg,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          <Svg width={trackWidth} height={TRACK_HEIGHT}>
            {ticks}
          </Svg>
          {/* Center indicator */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 4,
              bottom: 4,
              left: trackWidth / 2 - 1.5,
              width: 3,
              borderRadius: 2,
              backgroundColor: accent,
              shadowColor: accent,
              shadowOpacity: 0.6,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 0 },
            }}
          />
          {/* Edge fades — left + right */}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: 40,
              backgroundColor: colors.card,
              opacity: 0.6,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              bottom: 0,
              width: 40,
              backgroundColor: colors.card,
              opacity: 0.6,
            }}
          />
        </View>
      </GestureDetector>
    </View>
  );
}

/** Helper: format total inches to "5′ 10″" for imperial height. */
export function formatImperialHeightInches(totalIn: number): string {
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}′ ${inch}″`;
}

/**
 * Helper: parse common imperial height-entry shapes → total inches.
 * Mirror of the web helper at `src/app/components/suppr/ruler-slider.tsx`.
 *
 *  - `"70"`           → 70 (single number is treated as total inches)
 *  - `"5'10\""`       → 70
 *  - `"5 10"`         → 70
 *  - `"5ft 10in"`     → 70 (any non-digit run separates feet from inches)
 *  - `"5ft"`          → 60 (lone feet with explicit ft/' literal)
 */
export function parseImperialHeightInches(text: string): number {
  const trimmed = String(text).trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);
  const both = trimmed.match(/^(\d+)\D+(\d+)/);
  if (both) {
    const ft = parseInt(both[1], 10);
    const inch = parseInt(both[2], 10);
    return ft * 12 + inch;
  }
  const ftOnly = trimmed.match(/^(\d+)\s*(?:ft|'|′)\b/i);
  if (ftOnly) return parseInt(ftOnly[1], 10) * 12;
  return parseFloat(trimmed);
}

export default RulerSlider;
