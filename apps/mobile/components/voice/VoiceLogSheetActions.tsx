import { Text, View } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";

type Stage = "input" | "parsing" | "review" | "error";

type Props = {
  stage: Stage;
  typeScaleV1: boolean;
  transcript: string;
  itemsCount: number;
  hasLowConfidence: boolean;
  accentPrimary: string;
  colors: {
    text: string;
    cardBorder: string;
    primaryForeground: string;
  };
  onClose: () => void;
  onSubmitTranscript: () => void;
  onRetry: () => void;
  onLogAll: () => void;
};

export function VoiceLogSheetActions({
  stage,
  typeScaleV1,
  transcript,
  itemsCount,
  hasLowConfidence,
  accentPrimary,
  colors,
  onClose,
  onSubmitTranscript,
  onRetry,
  onLogAll,
}: Props) {
  return (
    <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg }}>
      <PressableScale
        haptic="selection"
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        onPress={onClose}
        style={{
          flex: 1,
          paddingVertical: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: colors.cardBorder,
          borderRadius: Radius.md,
        }}
      >
        <Text
          style={
            typeScaleV1
              ? { ...Type.button, color: colors.text }
              : { fontSize: 14, fontWeight: "600", color: colors.text }
          }
        >
          {stage === "review" ? "Back" : "Cancel"}
        </Text>
      </PressableScale>
      {stage === "input" && (
        <PressableScale
          haptic="confirm"
          accessibilityRole="button"
          accessibilityLabel="Estimate nutrition from description"
          onPress={onSubmitTranscript}
          disabled={!transcript.trim()}
          style={{
            flex: 1,
            paddingVertical: 12,
            alignItems: "center",
            borderRadius: Radius.md,
            backgroundColor: transcript.trim() ? accentPrimary : colors.cardBorder,
          }}
        >
          <Text
            style={
              typeScaleV1
                ? { ...Type.button, color: colors.primaryForeground }
                : { fontSize: 14, fontWeight: "700", color: colors.primaryForeground }
            }
          >
            Estimate
          </Text>
        </PressableScale>
      )}
      {stage === "error" && (
        <PressableScale
          haptic="confirm"
          accessibilityRole="button"
          accessibilityLabel="Try again"
          onPress={onRetry}
          style={{
            flex: 1,
            paddingVertical: 12,
            alignItems: "center",
            borderRadius: Radius.md,
            backgroundColor: accentPrimary,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primaryForeground }}>Try again</Text>
        </PressableScale>
      )}
      {stage === "review" && (
        <PressableScale
          haptic="confirm"
          accessibilityRole="button"
          accessibilityLabel="Log all items"
          onPress={onLogAll}
          disabled={itemsCount === 0}
          style={{
            flex: 1,
            paddingVertical: 12,
            alignItems: "center",
            borderRadius: Radius.md,
            backgroundColor: itemsCount === 0 ? colors.cardBorder : accentPrimary,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primaryForeground }}>
            {hasLowConfidence ? "Log anyway" : "Log all"}
          </Text>
        </PressableScale>
      )}
    </View>
  );
}
