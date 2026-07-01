import * as React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import {
  PROGRESSIVE_TEXT_RISE_PX,
  PROGRESSIVE_TEXT_TOKEN_MS,
  progressiveTextDelayMs,
  tokenizeProgressiveText,
} from "@suppr/shared/motion";
import { useReduceMotion } from "@/hooks/use-reduce-motion";

/**
 * ProgressiveText — mobile (ENG-720).
 *
 * Word/clause-staggered text reveal for the two onboarding "moment" beats
 * (Welcome wordmark+tagline, Reveal "Your plan is ready." heading). Each
 * whitespace-delimited token fades in + rises `PROGRESSIVE_TEXT_RISE_PX` via
 * Reanimated `withTiming`, offset per token by
 * `withDelay(progressiveTextDelayMs(i), …)`. The stagger/duration/rise numbers
 * come from the shared `@suppr/shared/motion` source, so the cadence cannot
 * drift from the web twin `src/app/components/onboarding/progressive-text.tsx`.
 *
 * GATING — instant fallback (no animation) when EITHER:
 *   - `animate` is `false` (the call site passes
 *     `isFeatureEnabled("onboarding_progressive_text")` — default-OFF), OR
 *   - the user has Reduce Motion on (`useReduceMotion()`,
 *     `apps/mobile/hooks/use-reduce-motion.ts`).
 *
 * In the instant case the component renders a single plain `<Text>` with the
 * full string — pixel-identical to the pre-ENG-720 surface — so flag-OFF /
 * reduce-motion onboarding has zero visual change.
 *
 * Tokenization keeps the trailing space on each token, so the reveal renders
 * identically to the source string. `accessibilityLabel` carries the full
 * phrase so VoiceOver announces the whole line regardless of the staggered
 * visual reveal.
 */

interface ProgressiveTextProps extends Omit<TextProps, "children"> {
  /** The phrase to reveal. */
  children: string;
  /**
   * When `false` (default), or when Reduce Motion is on, the text renders
   * instantly with no animation. Pass
   * `isFeatureEnabled("onboarding_progressive_text")`.
   */
  animate?: boolean;
  /** Text style applied to the rendered text (and each animated token). */
  style?: TextStyle;
}

export function ProgressiveText({
  children,
  animate = false,
  style,
  ...rest
}: ProgressiveTextProps) {
  const reduceMotion = useReduceMotion();
  const shouldAnimate = animate && !reduceMotion;

  // Instant fallback: a single plain Text node, no animation. Pixel-identical
  // to the pre-ENG-720 surface when the flag is OFF or Reduce Motion is on.
  if (!shouldAnimate) {
    return (
      <Text style={style} {...rest}>
        {children}
      </Text>
    );
  }

  const tokens = tokenizeProgressiveText(children);

  // Render the tokens inside one parent <Text> so they wrap and inherit
  // layout/line-height like normal text; each token is its own animated
  // child so it can fade + rise on its own delay.
  return (
    <Text style={style} accessibilityLabel={children} {...rest}>
      {tokens.map((token, i) => (
        <ProgressiveToken key={`${i}-${token}`} index={i} style={style}>
          {token}
        </ProgressiveToken>
      ))}
    </Text>
  );
}

function ProgressiveToken({
  children,
  index,
  style,
}: {
  children: string;
  index: number;
  style?: TextStyle;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(PROGRESSIVE_TEXT_RISE_PX);

  React.useEffect(() => {
    const delay = progressiveTextDelayMs(index);
    const config = {
      duration: PROGRESSIVE_TEXT_TOKEN_MS,
      easing: Easing.out(Easing.cubic),
    };
    opacity.value = withDelay(delay, withTiming(1, config));
    translateY.value = withDelay(delay, withTiming(0, config));
  }, [index, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.Text style={[style, animatedStyle]} aria-hidden>
      {children}
    </Animated.Text>
  );
}

export default ProgressiveText;
