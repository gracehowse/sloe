import { SegmentedTrack } from "@/components/ui/SegmentedTrack";
import type { WeightRange } from "@/lib/progress/weightTrend";

// 2026-05-12 (Grace TF chart parity with Withings): full-word labels
// replace the compact 1W / 1M / 3M / 1Y form. Withings ships
// Week / Month / Quarter / Year / All — words read more calmly and
// don't require the user to mentally expand "3M" → "three months".
const RANGES: { key: WeightRange; label: string }[] = [
  { key: "1w", label: "Week" },
  { key: "1m", label: "Month" },
  { key: "3m", label: "Quarter" },
  { key: "1y", label: "Year" },
  { key: "all", label: "All" },
];

type Props = {
  value: WeightRange;
  onChange: (range: WeightRange) => void;
};

/** §8 segmented range picker — thin wrapper over the canonical
 *  `SegmentedTrack` primitive (ENG-1375 S3; this file was one of the two
 *  conforming references the primitive was extracted from). */
export function WeightRangeToggle({ value, onChange }: Props) {
  return (
    <SegmentedTrack
      accessibilityLabel="Weight range"
      options={RANGES.map(({ key, label }) => ({ value: key, label }))}
      value={value}
      onChange={onChange}
    />
  );
}
