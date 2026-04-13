import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Neon, Radius, Spacing } from "@/constants/theme";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

type Props = {
  selectedDate: Date;
  loggedDays: Set<string>;
  onSelectDate: (date: Date) => void;
  textColor: string;
  secondaryColor: string;
  cardColor: string;
};

function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function getMondayOfWeek(d: Date): Date {
  const copy = new Date(d);
  const dow = copy.getDay(); // 0=Sun
  const offset = dow === 0 ? -6 : 1 - dow;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function DayStrip({
  selectedDate,
  loggedDays,
  onSelectDate,
  textColor,
  secondaryColor,
  cardColor,
}: Props) {
  const monday = getMondayOfWeek(selectedDate);
  const todayDk = dateKey(new Date());
  const selectedDk = dateKey(selectedDate);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const dk = dateKey(d);
    return { date: d, dk, label: DAY_LABELS[i] };
  });

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: cardColor,
        borderRadius: Radius.md,
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.xs,
      }}
    >
      {days.map(({ date, dk, label }) => {
        const isSelected = dk === selectedDk;
        const isToday = dk === todayDk;
        const hasLogs = loggedDays.has(dk);

        return (
          <Pressable
            key={dk}
            onPress={() => onSelectDate(date)}
            style={{
              flex: 1,
              alignItems: "center",
              gap: 4,
              paddingVertical: 4,
            }}
          >
            <Text
              style={{
                fontSize: 11,
                fontWeight: "600",
                color: isSelected ? Neon.purple : secondaryColor,
              }}
            >
              {label}
            </Text>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isSelected
                  ? Neon.purple
                  : hasLogs
                    ? Neon.green + "20"
                    : "transparent",
                borderWidth: isToday && !isSelected ? 2 : 0,
                borderColor: Neon.purple + "60",
              }}
            >
              {hasLogs && !isSelected ? (
                <Ionicons name="checkmark" size={14} color={Neon.green} />
              ) : (
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isSelected || isToday ? "800" : "500",
                    color: isSelected ? "#fff" : textColor,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {date.getDate()}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
