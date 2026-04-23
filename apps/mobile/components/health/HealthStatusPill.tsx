import { StyleSheet, Text, View } from "react-native";
import { Accent } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export type HealthConnectionState = "disconnected" | "connected" | "attention";

type Props = { state: HealthConnectionState };

const LABELS: Record<HealthConnectionState, string> = {
  disconnected: "Not connected",
  connected: "Connected",
  attention: "Needs attention",
};

export function HealthStatusPill({ state }: Props) {
  const colors = useThemeColors();

  const bgColor =
    state === "connected"
      ? Accent.success + "1F"
      : state === "attention"
        ? Accent.warning + "24"
        : colors.inputBg;

  const textColor =
    state === "connected"
      ? Accent.success
      : state === "attention"
        ? Accent.warning
        : colors.textSecondary;

  return (
    <View style={[styles.pill, { backgroundColor: bgColor }]}>
      <Text style={[styles.label, { color: textColor }]}>{LABELS[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
});
