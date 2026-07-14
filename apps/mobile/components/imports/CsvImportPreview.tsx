/**
 * CSV import preview (mobile) — the confirm step of the two-phase
 * MFP-refugee import (ENG-1234). Rendered inside `<MobileMfpCsvImportCard>`
 * once the route's `?mode=preview` parse returns, BEFORE anything is
 * written. Shows the detected source, how many meals will import, and a
 * sample of the parsed rows so the user can trust the columns mapped — then
 * commits (or backs out to pick a different file).
 *
 * Pure presentation: all flow/analytics live in the shared
 * `useCsvImportFlow` hook. Web mirror:
 * `src/app/components/imports/CsvImportPreview.tsx`.
 */
import * as React from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { ArrowRight } from "lucide-react-native";
import { withAlpha, Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { CsvSampleRow } from "@suppr/shared/imports/useCsvImportFlow";
import { csvSourceLabel, mealSlotLabel } from "@suppr/shared/imports/csvSourceLabel";

export function CsvImportPreview({
  source,
  total,
  unmatched,
  truncated,
  sample,
  committing,
  onConfirm,
  onCancel,
}: {
  source: string;
  total: number;
  unmatched: number;
  truncated: boolean;
  sample: CsvSampleRow[];
  committing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const sourceName = csvSourceLabel(source);
  const remaining = Math.max(0, total - sample.length);

  return (
    <View style={{ marginTop: Spacing.dense }} testID="mfp-csv-preview">
      <Text
        style={{
          ...Type.captionSmall,
          color: colors.textSecondary,
          lineHeight: 18,
        }}
      >
        Found{" "}
        <Text style={{ fontWeight: "700", color: colors.text }}>
          {total} meal{total === 1 ? "" : "s"}
        </Text>{" "}
        in your {sourceName} export. Your macros stay exactly as you logged
        them — here&rsquo;s a sample:
      </Text>

      <View
        style={{ marginTop: Spacing.dense, gap: Spacing.sm }}
        testID="mfp-csv-preview-rows"
      >
        {sample.map((row, i) => (
          <View
            key={`${row.date}-${row.name}-${i}`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: Spacing.sm,
              backgroundColor: colors.inputBg,
              borderRadius: Radius.lg,
              paddingHorizontal: Spacing.dense,
              paddingVertical: Spacing.sm,
            }}
          >
            <View
              style={{
                backgroundColor: withAlpha(accent.primaryLight, 0x1A),
                borderRadius: Radius.full,
                paddingHorizontal: Spacing.sm,
                paddingVertical: 3,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: accent.primarySolid,
                  textTransform: "uppercase",
                  letterSpacing: 0.3,
                }}
              >
                {mealSlotLabel(row.meal)}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                fontFamily: Type.captionSmall.fontFamily,
                fontSize: Type.captionSmall.fontSize,
                lineHeight: Type.captionSmall.lineHeight,
                fontWeight: "500",
                color: colors.text,
              }}
            >
              {row.name}
            </Text>
            <Text
              style={{
                fontFamily: Type.captionSmall.fontFamily,
                fontSize: Type.captionSmall.fontSize,
                lineHeight: Type.captionSmall.lineHeight,
                fontWeight: "600",
                color: colors.textSecondary,
                fontVariant: ["tabular-nums"],
              }}
            >
              {row.calories == null ? "—" : `${Math.round(row.calories)} kcal`}
            </Text>
          </View>
        ))}
      </View>

      {remaining > 0 ? (
        <Text
          style={{ fontSize: 11, color: colors.textSecondary, marginTop: Spacing.xs }}
        >
          + {remaining} more meal{remaining === 1 ? "" : "s"}
        </Text>
      ) : null}
      {unmatched > 0 ? (
        <Text
          style={{ fontSize: 11, color: colors.textSecondary, marginTop: Spacing.xs }}
        >
          {unmatched} row{unmatched === 1 ? "" : "s"} will be skipped (missing
          calories).
        </Text>
      ) : null}
      {truncated ? (
        <Text
          style={{ fontSize: 11, color: colors.textSecondary, marginTop: Spacing.xs }}
        >
          Only the first 1000 rows are included — upload again for older
          history.
        </Text>
      ) : null}

      <View
        style={{
          marginTop: Spacing.md,
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.sm,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Import ${total} meals`}
          accessibilityState={{ disabled: committing }}
          testID="mfp-csv-confirm-import"
          onPress={onConfirm}
          disabled={committing}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: Spacing.xs,
            paddingVertical: Spacing.sm,
            borderRadius: Radius.full,
            backgroundColor: accent.primary,
            opacity: committing ? 0.7 : pressed ? 0.85 : 1,
          })}
        >
          {committing ? (
            <>
              <ActivityIndicator size="small" color={Accent.primaryForeground} />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Accent.primaryForeground,
                }}
              >
                Importing…
              </Text>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: Accent.primaryForeground,
                }}
              >
                Import {total} meal{total === 1 ? "" : "s"}
              </Text>
              <ArrowRight size={15} color={Accent.primaryForeground} />
            </>
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Choose another file"
          accessibilityState={{ disabled: committing }}
          testID="mfp-csv-cancel-preview"
          onPress={onCancel}
          disabled={committing}
          style={({ pressed }) => ({
            paddingHorizontal: Spacing.dense,
            paddingVertical: Spacing.sm,
            borderRadius: Radius.full,
            opacity: committing ? 0.5 : pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text }}>
            Choose another
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
