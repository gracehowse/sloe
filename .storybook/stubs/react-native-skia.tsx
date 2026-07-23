/**
 * Storybook stub — Skia is native; Chromatic uses SVG/RN fallbacks in product.
 * Enough surface for type-only / dynamic imports from CalorieRing.
 */
import * as React from "react";
import { View, type ViewProps } from "react-native";

export const Canvas = (props: ViewProps) => <View {...props} />;
export const Path = (_props: Record<string, unknown>) => null;
export const Group = (props: ViewProps) => <View {...props} />;
export const Circle = (_props: Record<string, unknown>) => null;
export const Line = (_props: Record<string, unknown>) => null;
export const Skia = {
  Path: { Make: () => ({ moveTo: () => undefined, lineTo: () => undefined, close: () => undefined }) },
};
export const vec = (x: number, y: number) => ({ x, y });
export const SweepGradient = (_props: Record<string, unknown>) => null;
export const BlurMask = (_props: Record<string, unknown>) => null;

export default { Canvas, Path, Group, Circle, Line, Skia, vec };
