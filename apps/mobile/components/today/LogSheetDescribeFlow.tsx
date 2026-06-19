/**
 * ENG-972 — inline natural-language describe flow inside the Log sheet.
 * Parses via `/api/nutrition/voice-log`, review via shared AI row UI.
 */
import { memo } from "react";
import * as React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Lock, PencilLine } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprButton } from "@/components/ui/SupprButton";
import AiLogReviewItem from "@/components/AiLogReviewItem";
import AiLogReviewSummary from "@/components/AiLogReviewSummary";
import {
  averageConfidence,
  isLowConfidence,
  type AiLoggedItem,
} from "@suppr/shared/nutrition/aiLogging";
import type { ParseMealDescriptionResult } from "@suppr/shared/nutrition/parseMealDescription";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

type Stage = "input" | "parsing" | "review" | "error";

export type LogSheetDescribeFlowProps = {
  sheetOpen: boolean;
  locked?: boolean;
  /** Pre-filled from the search-row NL CTA. */
  seedText?: string | null;
  onSeedConsumed?: () => void;
  onParse: (text: string) => Promise<ParseMealDescriptionResult>;
  onCommit: (items: AiLoggedItem[]) => void;
  onPaywall?: () => void;
  onReviewActiveChange?: (active: boolean) => void;
  /** Hide the describe card while the user is typing a food search. */
  inputHidden?: boolean;
  /** Active meal slot label (Breakfast/Lunch/…) shown on the review summary. */
  slotLabel?: string;
};

function LogSheetDescribeFlowImpl({
  sheetOpen,
  locked = false,
  seedText,
  onSeedConsumed,
  onParse,
  onCommit,
  onPaywall,
  onReviewActiveChange,
  inputHidden = false,
  slotLabel,
}: LogSheetDescribeFlowProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const [stage, setStage] = React.useState<Stage>("input");
  const [text, setText] = React.useState("");
  const [items, setItems] = React.useState<AiLoggedItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!sheetOpen) {
      setStage("input");
      setText("");
      setItems([]);
      setError(null);
    }
  }, [sheetOpen]);

  React.useEffect(() => {
    onReviewActiveChange?.(stage === "review");
  }, [stage, onReviewActiveChange]);

  React.useEffect(() => {
    if (!seedText?.trim()) return;
    setText(seedText.trim());
    onSeedConsumed?.();
  }, [seedText, onSeedConsumed]);

  const runParse = React.useCallback(
    async (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return;
      if (locked) {
        onPaywall?.();
        return;
      }
      setStage("parsing");
      setError(null);
      track(AnalyticsEvents.log_sheet_nl_text_started, { platform: "mobile" });
      const result = await onParse(trimmed);
      if (!result.ok) {
        if (result.upgradeRequired) {
          onPaywall?.();
          setStage("input");
          return;
        }
        setError(result.error);
        setStage("error");
        return;
      }
      setItems(result.items);
      setStage("review");
    },
    [locked, onParse, onPaywall],
  );

  const updateItem = (index: number, patch: Partial<AiLoggedItem>) => {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLogAll = () => {
    if (items.length === 0) return;
    onCommit(items);
    track(AnalyticsEvents.log_sheet_nl_text_committed, {
      platform: "mobile",
      itemCount: items.length,
      avgConfidence: averageConfidence(items),
    });
    setStage("input");
    setText("");
    setItems([]);
  };

  if (stage === "review") {
    const low = items.some((i) => isLowConfidence(i));
    return (
      <View style={{ flex: 1, paddingHorizontal: Spacing.md, paddingTop: Spacing.sm }} testID="log-sheet-describe-review">
        <Text style={[Type.caption, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
          Review parsed items — edit or remove before logging.
        </Text>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.lg }}>
          <AiLogReviewSummary items={items} slotLabel={slotLabel ?? "Meal"} colors={colors} />
          {items.map((item, index) => (
            <AiLogReviewItem
              key={`${item.name}-${index}`}
              item={item}
              index={index}
              onChange={(patch) => updateItem(index, patch)}
              onRemove={() => removeItem(index)}
              colors={{
                text: colors.text,
                textSecondary: colors.textSecondary,
                textTertiary: colors.textTertiary,
                card: colors.card,
                cardBorder: colors.cardBorder,
                background: colors.background,
                inputBg: colors.inputBg,
                border: colors.border,
              }}
            />
          ))}
        </ScrollView>
        {low ? (
          <Text style={{ fontSize: 11, color: Accent.warning, marginBottom: Spacing.sm }}>
            Some items are low confidence — check portions before logging.
          </Text>
        ) : null}
        <View style={{ flexDirection: "row", gap: Spacing.sm, paddingBottom: Spacing.sm }}>
          <SupprButton
            variant="ghost"
            label="Back"
            onPress={() => {
              setStage("input");
              setItems([]);
            }}
            style={{ flex: 1 }}
          />
          <SupprButton variant="primary" label="Log all" onPress={handleLogAll} style={{ flex: 2 }} />
        </View>
      </View>
    );
  }

  if (inputHidden) {
    return null;
  }

  return (
    <View
      testID="log-sheet-describe"
      style={{
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.xl,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: Spacing.sm,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        <PencilLine size={IconSize.base} color={accent.primary} strokeWidth={2} />
        <Text style={[Type.body, { color: colors.text, fontWeight: "600", flex: 1 }]}>
          Describe what you ate
        </Text>
        {locked ? <Lock size={14} color={colors.textTertiary} /> : null}
      </View>
      <TextInput
        testID="log-sheet-describe-input"
        value={text}
        onChangeText={setText}
        placeholder={'e.g. "2 scrambled eggs and toast with butter"'}
        placeholderTextColor={colors.textTertiary}
        multiline
        accessibilityLabel="Describe what you ate"
        style={{
          backgroundColor: colors.inputBg,
          borderRadius: Radius.md,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.md,
          color: colors.text,
          fontSize: 15,
          minHeight: 56,
          textAlignVertical: "top",
        }}
      />
      {stage === "error" && error ? (
        <Text style={{ fontSize: 13, color: Accent.destructive }}>{error}</Text>
      ) : null}
      {stage === "parsing" ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <ActivityIndicator size="small" color={accent.primary} />
          <Text style={{ fontSize: 13, color: colors.textSecondary }}>Parsing your description…</Text>
        </View>
      ) : (
        <Pressable
          testID="log-sheet-describe-parse"
          accessibilityRole="button"
          accessibilityLabel="Parse meal description"
          onPress={() => void runParse(text)}
          style={({ pressed }) => ({
            alignSelf: "flex-start",
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            borderRadius: Radius.full,
            backgroundColor: accent.primary,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 14 }}>Parse meal</Text>
        </Pressable>
      )}
      <Text style={{ fontSize: 11, color: colors.textTertiary, lineHeight: 15 }}>
        AI estimates from verified nutrition data. Review every item before logging.
      </Text>
    </View>
  );
}

export const LogSheetDescribeFlow = memo(LogSheetDescribeFlowImpl);
