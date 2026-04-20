import * as React from "react";
import { LayoutChangeEvent, View, ViewStyle, StyleProp } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Mobile MiniSlider — minimal drag-controlled slider used by the
 * Pace step. Built on react-native-gesture-handler (already a dep)
 * to avoid pulling @react-native-community/slider for one screen.
 *
 * Snapping is handled by the consumer (pass `step` to the prop and
 * round in `onChange`), keeping the slider value-agnostic.
 */

export interface MobileMiniSliderProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Track + thumb tint. */
  accent: string;
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

const THUMB = 22;
const TRACK_HEIGHT = 6;

export function MobileMiniSlider({
  value,
  onChange,
  min,
  max,
  step = 1,
  accent,
  ariaLabel = "Slider",
  style,
}: MobileMiniSliderProps) {
  const colors = useThemeColors();
  const [trackWidth, setTrackWidth] = React.useState(0);
  const startValueRef = React.useRef(value);

  const onLayout = (e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  };

  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const snap = (v: number) => {
    const snapped = Math.round((v - min) / step) * step + min;
    // Avoid floating-point pollution from the multiply / divide.
    return Math.round(snapped * 1000) / 1000;
  };

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          startValueRef.current = value;
        })
        .onChange((evt) => {
          if (trackWidth === 0) return;
          const range = max - min;
          const dv = (evt.translationX / trackWidth) * range;
          onChange(snap(clamp(startValueRef.current + dv)));
        }),
    [value, min, max, step, trackWidth, onChange],
  );

  const range = max - min;
  const pct = range === 0 ? 0 : (value - min) / range;
  const thumbX = Math.max(
    THUMB / 2,
    Math.min(trackWidth - THUMB / 2, pct * trackWidth),
  );

  return (
    <GestureDetector gesture={pan}>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel={ariaLabel}
        accessibilityValue={{ now: value, min, max }}
        onLayout={onLayout}
        style={[
          {
            height: THUMB + 4,
            justifyContent: "center",
            paddingHorizontal: 0,
          },
          style,
        ]}
      >
        <View
          style={{
            height: TRACK_HEIGHT,
            borderRadius: TRACK_HEIGHT / 2,
            backgroundColor: colors.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: TRACK_HEIGHT,
              width: thumbX,
              backgroundColor: accent,
              borderRadius: TRACK_HEIGHT / 2,
            }}
          />
        </View>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: thumbX - THUMB / 2,
            top: (THUMB + 4 - THUMB) / 2,
            width: THUMB,
            height: THUMB,
            borderRadius: THUMB / 2,
            backgroundColor: accent,
            shadowColor: accent,
            shadowOpacity: 0.45,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 0 },
          }}
        />
      </View>
    </GestureDetector>
  );
}
