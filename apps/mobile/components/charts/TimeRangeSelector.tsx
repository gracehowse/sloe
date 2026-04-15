import { Pressable, Text, View } from "react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";

export type TimeRange = "1W" | "1M" | "3M" | "6M" | "All";

const RANGES: TimeRange[] = ["1W", "1M", "3M", "6M", "All"];

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
    <View
      style={{
        flexDirection: "row",
        backgroundColor: cardColor,
        borderRadius: Radius.sm,
        padding: 2,
        gap: 2,
      }}
    >
      {RANGES.map((r) => (
        <Pressable
          key={r}
          onPress={() => onSelect(r)}
          style={{
            flex: 1,
            paddingVertical: 6,
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
            {r}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
