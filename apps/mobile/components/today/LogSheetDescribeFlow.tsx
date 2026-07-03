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
import { PencilLine, ChevronDown, ChevronUp } from "lucide-react-native";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { ProMethodBadge } from "@/components/today/ProMethodBadge";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SupprButton } from "@/components/ui/SupprButton";
import AiLogReviewItem from "@/components/AiLogReviewItem";
import AiLogReviewSummary from "@/components/AiLogReviewSummary";
import {
  averageConfidence,
  isLowConfidence,
  type AiLoggedItem,
} from "@suppr/nutrition-core/aiLogging";
import type { ParseMealDescriptionResult } from "@suppr/nutrition-core/parseMealDescription";
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
  /** ENG-1303 — the Describe method tile bumps this to expand the flow EMPTY
   *  (distinct from `seedText`, which pre-fills from the search-row NL CTA).
   *  A change > 0 expands; the initial `0` is inert so it doesn't auto-open. */
  expandSignal?: number;
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
  expandSignal = 0,
}: LogSheetDescribeFlowProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const [stage, setStage] = React.useState<Stage>("input");
  const [text, setText] = React.useState("");
  const [items, setItems] = React.useState<AiLoggedItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!sheetOpen) {
      setStage("input");
      setText("");
      setItems([]);
      setError(null);
      setExpanded(false);
    }
  }, [sheetOpen]);

  React.useEffect(() => {
    onReviewActiveChange?.(stage === "review");
  }, [stage, onReviewActiveChange]);

  React.useEffect(() => {
    if (!seedText?.trim()) return;
    setText(seedText.trim());
    setExpanded(true);
    onSeedConsumed?.();
  }, [seedText, onSeedConsumed]);

  // ENG-1303 — expand (empty) when the Describe method tile bumps the signal.
  // Guard the initial 0 so a freshly-mounted flow doesn't auto-open. The host
  // already gates the bump on `locked` (it paywalls instead of bumping).
  React.useEffect(() => {
    if (expandSignal > 0) setExpanded(true);
  }, [expandSignal]);

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
          <Text style={{ fontSize: 11, color: Accent.warningSolid, marginBottom: Spacing.sm }}>
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

  if (!expanded && stage === "input" && !error) {
    return (
      <Pressable
        testID="log-sheet-describe-expand"
        accessibilityRole="button"
        accessibilityLabel="Describe what you ate. Tap to expand."
        onPress={() => {
          if (locked) {
            onPaywall?.();
            return;
          }
          setExpanded(true);
        }}
        style={({ pressed }) => ({
          marginHorizontal: Spacing.md,
          marginTop: Spacing.sm,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          borderRadius: Radius.lg,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <PencilLine size={IconSize.sm} color={accent.primary} strokeWidth={2} />
        <Text style={[Type.body, { color: colors.text, fontWeight: "600", flex: 1, fontSize: 13 }]}>
          Describe what you ate
        </Text>
        {locked ? <ProMethodBadge /> : null}
        <ChevronDown size={16} color={colors.textTertiary} />
      </Pressable>
    );
  }

  return (
    <View
      testID="log-sheet-describe"
      style={{
        marginHorizontal: Spacing.md,
        marginTop: Spacing.sm,
        padding: Spacing.sm,
        borderRadius: Radius.lg,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.border,
        gap: Spacing.sm,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Collapse describe meal"
        onPress={() => setExpanded(false)}
        style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}
      >
        <PencilLine size={IconSize.sm} color={accent.primary} strokeWidth={2} />
        <Text style={[Type.body, { color: colors.text, fontWeight: "600", flex: 1, fontSize: 13 }]}>
          Describe what you ate
        </Text>
        {locked ? <ProMethodBadge /> : null}
        <ChevronUp size={16} color={colors.textTertiary} />
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        <TextInput
          testID="log-sheet-describe-input"
          value={text}
          onChangeText={setText}
          placeholder={'e.g. "2 eggs and toast"'}
          placeholderTextColor={colors.textTertiary}
          multiline
          numberOfLines={2}
          accessibilityLabel="Describe what you ate"
          accessibilityHint="AI estimates from verified nutrition data. Review every item before logging."
          style={{
            flex: 1,
            backgroundColor: colors.inputBg,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            color: colors.text,
            fontSize: 14,
            minHeight: 40,
            maxHeight: 64,
            textAlignVertical: "top",
          }}
        />
        {stage === "parsing" ? (
          <ActivityIndicator size="small" color={accent.primary} />
        ) : (
          <Pressable
            testID="log-sheet-describe-parse"
            accessibilityRole="button"
            accessibilityLabel="Parse meal description"
            onPress={() => void runParse(text)}
            style={({ pressed }) => ({
              paddingHorizontal: Spacing.md,
              paddingVertical: Spacing.sm,
              borderRadius: Radius.full,
              backgroundColor: accent.primary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.primaryForeground, fontWeight: "600", fontSize: 13 }}>
              Parse
            </Text>
          </Pressable>
        )}
      </View>
      {stage === "error" && error ? (
        <Text style={{ fontSize: 13, color: Accent.destructive }}>{error}</Text>
      ) : null}
      {stage === "parsing" ? (
        <Text style={{ ...Type.captionSmall, color: colors.textSecondary }}>Parsing your description…</Text>
      ) : null}
    </View>
  );
}

export const LogSheetDescribeFlow = memo(LogSheetDescribeFlowImpl);
