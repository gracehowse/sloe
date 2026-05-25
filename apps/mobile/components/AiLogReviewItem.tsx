/**
 * AiLogReviewItem — shared review-row used by both `VoiceLogSheet` and
 * `PhotoLogSheet` so the AI-logged item review UX cannot drift between
 * the two AI surfaces. Same confidence chip, same low-confidence amber
 * border, same inline macro fields, same a11y labels.
 *
 * Extracted 2026-04-30 (audit B5: photo-log parity gap with voice).
 * Before this lift, both sheets carried near-identical 100-line copies
 * of the row; any tweak landed in one had to be hand-mirrored to the
 * other or it became drift. Lifting it removes the surface area for
 * mistakes.
 *
 * Pure presentational + per-row event handlers passed in from the
 * parent. No analytics, no I/O — the parent commits.
 */
import { Pressable, Text, TextInput, View } from "react-native";
import { CircleX, Sparkles } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  classifyConfidence,
  isLowConfidence,
  type AiLoggedItem,
} from "@suppr/shared/nutrition/aiLogging";
import Badge from "./Badge";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  inputBg: string;
  border: string;
};

type Props = {
  item: AiLoggedItem;
  index: number;
  onChange: (patch: Partial<AiLoggedItem>) => void;
  onRemove: () => void;
  colors: Theme;
};

/** Anchor colour for a confidence value in [0, 1]. Shared across voice
 * + photo so the same level always reads the same colour. */
export function confidenceColor(c: number): string {
  const level = classifyConfidence(c);
  if (level === "high") return Accent.success;
  if (level === "medium") return Accent.warning;
  return "#EF4444";
}

/** Short label for the chip — "High" / "Med" / "Low". */
export function confidenceLabel(c: number): "High" | "Med" | "Low" {
  const level = classifyConfidence(c);
  if (level === "high") return "High";
  if (level === "medium") return "Med";
  return "Low";
}

/** Whole-percent rendering for the chip ("92%"). NaN / out-of-range are
 *  clamped through `classifyConfidence`'s contract first to keep the
 *  display honest with the colour. */
export function confidencePercentLabel(c: number): string {
  const clamped = Number.isFinite(c) ? Math.min(1, Math.max(0, c)) : 0;
  return `${Math.round(clamped * 100)}%`;
}

export default function AiLogReviewItem({
  item,
  index,
  onChange,
  onRemove,
  colors,
}: Props) {
  const low = isLowConfidence(item);
  const cColor = confidenceColor(item.confidence);
  const cLabel = confidenceLabel(item.confidence);
  const cPercent = confidencePercentLabel(item.confidence);

  const numField = (
    label: string,
    value: number,
    onMacroChange: (n: number) => void,
    accessibilityLabel: string,
  ) => (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          fontSize: 10,
          color: colors.textTertiary,
          fontWeight: "700",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <TextInput
        accessibilityLabel={accessibilityLabel}
        keyboardType="numeric"
        value={String(value)}
        onChangeText={(t) => {
          const n = Math.max(0, Number(t.replace(/[^0-9.]/g, "")));
          onMacroChange(Number.isFinite(n) ? Math.round(n) : 0);
        }}
        style={{
          backgroundColor: colors.inputBg,
          borderRadius: Radius.sm,
          paddingHorizontal: 8,
          paddingVertical: 6,
          fontSize: 13,
          color: colors.text,
          marginTop: 2,
        }}
      />
    </View>
  );

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: low ? "#F59E0B55" : colors.cardBorder,
        backgroundColor: low ? "#F59E0B0F" : colors.background,
        borderRadius: Radius.md,
        padding: Spacing.md,
        marginBottom: Spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <TextInput
            accessibilityLabel={`Item ${index + 1} name`}
            value={item.name}
            onChangeText={(t) => onChange({ name: t })}
            style={{
              backgroundColor: colors.inputBg,
              borderRadius: Radius.sm,
              paddingHorizontal: 8,
              paddingVertical: 6,
              fontSize: 14,
              fontWeight: "600",
              color: colors.text,
            }}
          />
          {item.unit && (
            <Text
              style={{ fontSize: 11, color: colors.textTertiary, marginTop: 4 }}
            >
              {item.unit}
            </Text>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <View
            accessibilityLabel={`${cPercent} confidence`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              borderRadius: 999,
              paddingHorizontal: 6,
              paddingVertical: 2,
              backgroundColor: cColor + "22",
            }}
          >
            <View
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: cColor,
              }}
            />
            <Text style={{ fontSize: 10, fontWeight: "700", color: cColor }}>
              {cLabel} {cPercent}
            </Text>
          </View>
          <Badge
            variant="ai"
            accessibilityLabel="AI estimated nutrition"
            icon={<Sparkles size={10} color="#9679D9" strokeWidth={2.25} />}
          >
            AI estimate
          </Badge>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
          onPress={onRemove}
          hitSlop={8}
        >
          <CircleX size={20} color={colors.textTertiary} strokeWidth={2} />
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", gap: 6, marginTop: Spacing.sm }}>
        {numField(
          "kcal",
          item.calories,
          (n) => onChange({ calories: n }),
          `${item.name} calories`,
        )}
        {numField(
          "P (g)",
          item.protein,
          (n) => onChange({ protein: n }),
          `${item.name} protein`,
        )}
        {numField(
          "C (g)",
          item.carbs,
          (n) => onChange({ carbs: n }),
          `${item.name} carbs`,
        )}
        {numField(
          "F (g)",
          item.fat,
          (n) => onChange({ fat: n }),
          `${item.name} fat`,
        )}
      </View>
      {low && (
        <Text
          accessibilityRole="alert"
          style={{ fontSize: 11, color: "#B45309", marginTop: 6 }}
        >
          Low confidence — please verify portion and macros before logging.
        </Text>
      )}
    </View>
  );
}
