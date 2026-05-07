import { Pressable, ScrollView, Text } from "react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";

/**
 * 2026-04-26 polish (round 2): trimmed to 4 visible ranges. Pre-fix this
 * exposed 7 pills (1W / 1M / 3M / 6M / 9M / 12M / All) which read as
 * cluttered on small screens — industry norm for a health-tracker range
 * picker is 4-5 (MFP, Apple Health, Strava). The TimeRange union keeps the
 * legacy values so any persisted user preference (e.g. range="6M" stored
 * before this change) still maps to a known time window via daysForRange.
 *
 * F-125 (Grace, 2026-05-07): "multiple weight charts all saying different
 * things" — the weight-tracker page exposed `1M / 3M / 12M / All` while
 * the Progress tab's `<WeightRangeToggle/>` exposed `1W / 1M / 3M / 1Y /
 * All`. Same data path (`computeWeightTrend`), different range pills, so
 * the user saw different numbers on the two surfaces. Now both screens
 * expose the same canonical `1W / 1M / 3M / 1Y / All` set.
 *
 * `TimeRange` keeps `"12M"` as the union value because it's persisted in
 * component state for backwards compat; `"1Y"` is a render-time alias
 * driven by the label override below. No migration needed.
 */
export type TimeRange = "1W" | "1M" | "3M" | "6M" | "9M" | "12M" | "All";

const RANGES: TimeRange[] = ["1W", "1M", "3M", "12M", "All"];

/** F-125 — render label for each range. "12M" displays as "1Y" so the
 *  weight-tracker pills match the Progress tab's WeightRangeToggle. */
function rangeLabel(r: TimeRange): string {
  return r === "12M" ? "1Y" : r;
}

type Props = {
  selected: TimeRange;
  onSelect: (range: TimeRange) => void;
  cardColor: string;
  textColor: string;
  secondaryColor: string;
};

export function daysForRange(range: TimeRange): number {
  switch (range) {
    case "1W":
      return 7;
    case "1M":
      return 30;
    case "3M":
      return 90;
    case "6M":
      return 180;
    case "9M":
      return 275;
    case "12M":
      return 366;
    case "All":
      return 9999;
  }
}

export default function TimeRangeSelector({
  selected,
  onSelect,
  cardColor,
  textColor,
  secondaryColor,
}: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        flexDirection: "row",
        backgroundColor: cardColor,
        borderRadius: Radius.sm,
        padding: 2,
        gap: 4,
        alignItems: "center",
      }}
    >
      {RANGES.map((r) => (
        <Pressable
          key={r}
          onPress={() => onSelect(r)}
          style={{
            paddingVertical: 6,
            paddingHorizontal: 10,
            borderRadius: Radius.sm - 2,
            alignItems: "center",
            backgroundColor: selected === r ? Accent.primary : "transparent",
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: "700",
              color: selected === r ? "#fff" : secondaryColor,
            }}
          >
            {rangeLabel(r)}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
