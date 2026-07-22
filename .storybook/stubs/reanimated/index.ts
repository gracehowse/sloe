/**
 * Minimal react-native-reanimated stub for Storybook (RN-web).
 * Enough for PressableScale + celebration / chart enter animations.
 */
import { View, Text, Image, ScrollView } from "react-native";

export const useSharedValue = <T,>(v: T) => ({ value: v });
export const useAnimatedStyle = (fn: () => object) => fn();
export const useAnimatedProps = (fn: () => object) => fn();
export const withTiming = <T,>(v: T) => v;
export const withSpring = <T,>(v: T) => v;
export const withDelay = <T,>(_delay: number, v: T) => v;
export const withSequence = <T,>(...values: T[]) => values[values.length - 1];
export const withRepeat = <T,>(v: T) => v;
export const cancelAnimation = () => undefined;
export const runOnJS = <T extends (...args: never[]) => unknown>(fn: T) => fn;
export const runOnUI = <T extends (...args: never[]) => unknown>(fn: T) => fn;
export const interpolate = (
  _value: number,
  _input: number[],
  output: number[],
) => output[0] ?? 0;
export const Extrapolation = { CLAMP: "clamp", EXTEND: "extend", IDENTITY: "identity" };
export const Easing = {
  linear: (t: number) => t,
  ease: (t: number) => t,
  in: (easing: (t: number) => number) => easing,
  out: (easing: (t: number) => number) => easing,
  inOut: (easing: (t: number) => number) => easing,
  cubic: (t: number) => t,
  quad: (t: number) => t,
  bezier: () => (t: number) => t,
};

type Entering = { duration: (_ms: number) => Entering; springify: () => Entering; delay: (_ms: number) => Entering };
const entering = (): Entering => {
  const self: Entering = {
    duration: () => self,
    springify: () => self,
    delay: () => self,
  };
  return self;
};

export const FadeIn = entering();
export const FadeInDown = entering();
export const FadeInUp = entering();
export const FadeOut = entering();
export const SlideInRight = entering();
export const SlideInLeft = entering();
export const SlideInUp = entering();
export const SlideInDown = entering();
export const ZoomIn = entering();
export const ZoomOut = entering();
export const LinearTransition = entering();
export const Layout = entering();

export function createAnimatedComponent<T>(Component: T): T {
  return Component;
}

const Animated = {
  View,
  Text,
  Image,
  ScrollView,
  createAnimatedComponent,
};

export default Animated;
