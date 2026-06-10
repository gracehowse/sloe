import * as React from "react";
import { Spacing } from "@/constants/theme";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { Scale } from "lucide-react-native";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { RulerSlider } from "@/components/RulerSlider";
import { useOnboarding } from "../context";
import { MobileSegmented } from "../segmented";
import { MobileStepBody, MobileStepHeader, useStepOverline } from "../scaffold";

/**
 * Weight step mobile mirror. Includes the "Prefer not to enter" path
 * (diversity-inclusion Stage F) — see web Weight step for rationale.
 */

export function MobileWeightStep() {
  const { state, set } = useOnboarding();
  const colors = useThemeColors();
  const overline = useStepOverline();
  // Secondary accent (Frost flag → damson, else clay) for the "Actually, I'll
  // enter it" link on the skipped path. The unit toggle flips via
  // `MobileSegmented`; the ruler + "Prefer not to enter" keep neutral tokens.
  const accent = useAccent();
  const metric = state.unitSystem === "metric";

  if (state.weightSkipped) {
    return (
      <MobileStepBody>
        <MobileStepHeader
          overline={overline}
          title="Skipped — that's fine"
          subtitle="We'll calibrate your targets from your meal logs over the first couple of weeks. You can add a weight any time from Settings."
          compact
        />
        {/* DC6 (premium-bar audit 2026-05-14) — Withings-style soft
            illustration on the calibrate-copy fallback. Was a flat
            "Skipped" header + text; now leads with a brand-tinted
            Scale glyph in an 80x80 circle that fades + pulses every
            2s to signal "we're working in the background." Reads as
            a deliberate calibration moment, not an empty state. The
            "Actually, I'll enter it" affordance is preserved below
            the illustration so the user can flip back without
            scrolling. */}
        <WeightSkippedIllustration />
        <Pressable
          onPress={() => set({ weightSkipped: false })}
          accessibilityRole="button"
          style={{ alignSelf: "center", marginTop: 8 }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "600",
              color: accent.primaryLight,
            }}
          >
            Actually, I&apos;ll enter it
          </Text>
        </Pressable>
      </MobileStepBody>
    );
  }

  return (
    <MobileStepBody>
      <MobileStepHeader
        overline={overline}
        title="And your weight?"
        subtitle="We'll store this privately. You can log it whenever — no daily prompts."
        compact
      />
      <View style={{ marginBottom: 20 }}>
        <MobileSegmented
          value={state.unitSystem}
          onChange={(v) => set({ unitSystem: v })}
          options={[
            { value: "metric", label: "kg" },
            { value: "imperial", label: "lb" },
          ]}
          ariaLabel="Weight units"
        />
      </View>
      {/* Fluid wrapper (max 380) — matches the web Weight step's
          sizing constraint after the visual-qa polish sweep. */}
      <View style={{ alignItems: "center", alignSelf: "stretch" }}>
        <View style={{ width: "100%", maxWidth: 380 }}>
          {metric ? (
            <RulerSlider
              value={state.weightKg}
              onChange={(v) => set({ weightKg: v })}
              min={40}
              max={150}
              step={0.5}
              decimals={1}
              unit="kg"
              accessibilityLabel="Weight"
            />
          ) : (
            <RulerSlider
              value={+(state.weightKg * 2.2046).toFixed(1)}
              onChange={(v) => set({ weightKg: +(v / 2.2046).toFixed(2) })}
              min={90}
              max={330}
              step={1}
              unit="lb"
              accessibilityLabel="Weight"
            />
          )}
        </View>
      </View>
      <View style={{ alignItems: "center", marginTop: 24 }}>
        <Pressable
          onPress={() => set({ weightSkipped: true })}
          accessibilityRole="button"
          accessibilityLabel="Prefer not to enter weight"
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: "500",
              color: colors.textSecondary,
              textDecorationLine: "underline",
              textDecorationColor: colors.border,
            }}
          >
            Prefer not to enter
          </Text>
        </Pressable>
        <Text
          style={{
            fontSize: 11,
            color: colors.textTertiary,
            marginTop: Spacing.xs,
            maxWidth: 280,
            textAlign: "center",
            lineHeight: 16,
          }}
        >
          We&apos;ll calibrate from your meal logs over the first couple of
          weeks instead.
        </Text>
      </View>
    </MobileStepBody>
  );
}

/**
 * DC6 (premium-bar audit 2026-05-14) — animated Scale illustration
 * shown on the weight-skipped calibrate-copy fallback. An 80x80
 * brand-tinted circle with a `Scale` glyph fades opacity 0.6 -> 1.0
 * on a 2s loop so the surface reads as "calibration in progress"
 * rather than a static skip-confirmation. Animation is a single
 * `Animated.Value` loop (RN-native, no native module dep) and
 * stops + cleans up on unmount. The circle is `accessibilityElementsHidden`
 * because the surrounding subtitle text already carries the
 * semantic meaning for screen readers — no double-announce.
 */
function WeightSkippedIllustration() {
  // Secondary accent (Frost flag → damson, else clay) for the pulsing
  // calibration glyph + its tinted circle.
  const accent = useAccent();
  const pulse = React.useRef(new Animated.Value(0.6)).current;
  React.useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);
  return (
    <View
      style={{
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: Spacing.dense,
      }}
    >
      <Animated.View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: `${accent.primary}1A`,
          alignItems: "center",
          justifyContent: "center",
          opacity: pulse,
        }}
      >
        <Scale size={48} color={accent.primaryLight} strokeWidth={1.75} />
      </Animated.View>
    </View>
  );
}
