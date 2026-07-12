import * as React from "react";
import { ViewStyle, StyleProp } from "react-native";
import { SegmentedTrack } from "@/components/ui/SegmentedTrack";

/**
 * Mobile Segmented — small pill toggle for the metric/imperial switch
 * on Height + Weight. Mirrors the web primitive at
 * `src/app/components/onboarding/segmented.tsx`.
 *
 * ENG-1375 S3: now a thin wrapper over the canonical §8 `SegmentedTrack`
 * (inputBg rail, card-white thumb + subtle shadow, `primarySolid` semibold
 * active label). The previous soft-tint thumb (`accent.primarySoft`) is
 * retired — ONE track-and-thumb grammar product-wide.
 */

export interface MobileSegmentedOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
}

export interface MobileSegmentedProps<T extends string = string> {
  options: MobileSegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export function MobileSegmented<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel = "Toggle",
  style,
}: MobileSegmentedProps<T>) {
  return (
    <SegmentedTrack
      role="radiogroup"
      accessibilityLabel={ariaLabel}
      options={options.map((opt) => ({ value: opt.value, label: opt.label }))}
      value={value}
      onChange={onChange}
      fit="hug"
      style={style}
    />
  );
}
