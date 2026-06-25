import * as React from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Scale as ScaleIcon, X } from "lucide-react-native";

import { IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { kgToLb } from "@suppr/shared/units/imperial";

/**
 * Withings-style "All data" weight list (Grace TF feedback, 2026-05-11).
 *
 * Tap-to-open from the Weight section on Progress. Renders every
 * recorded weigh-in grouped by month, in reverse chronological order
 * (newest first). Each row shows the weight, a relative date label
 * ("Today" / "Yesterday" / "5 May 2026"), and the data source.
 *
 * Long-press a row to edit (correct a mistyped value, keeping the
 * original date) or delete it. Edit routes back up to the parent's
 * `LogWeightSheet` in edit mode (ENG-748 #9, 2026-05-27) — before that
 * a mistyped past weigh-in could only be deleted + re-added, and the
 * re-add always landed on today, losing the original date. See
 * `docs/decisions/2026-05-11-weight-chart-consolidation-plan.md`.
 */

export interface WeightEntry {
  dateISO: string;
  kg: number;
}

export interface AllWeightDataSheetProps {
  visible: boolean;
  onClose: () => void;
  userId: string | null;
  isImperial: boolean;
  /**
   * `weight_kg_by_day` map from profiles. Single source of truth — when
   * the parent re-fetches after a delete, we receive the updated map
   * here and re-render. We never mutate this prop in place.
   */
  weightKgByDay: Record<string, number>;
  /**
   * Called after a successful delete so the parent can update its local
   * state (and trigger a chart re-render). Receives the date key that
   * was removed.
   */
  onDeleteWeight: (dateISO: string) => Promise<{
    weightKgByDay: Record<string, number>;
    weightKg: number | null;
  }>;
  onEntryDeleted: (dateISO: string, nextMap: Record<string, number>) => void;
  /**
   * ENG-748 #9 — called when the user chooses "Edit" on a row. The parent
   * opens its `LogWeightSheet` in edit mode targeting this date (value can
   * change, date is preserved). Mobile-only surface; web has no per-day
   * weight-history list yet (see #9 parity note).
   */
  onEditEntry: (dateISO: string) => void;
}

type Section = { monthLabel: string; entries: WeightEntry[] };

function groupByMonth(entries: WeightEntry[]): Section[] {
  const buckets: Record<string, WeightEntry[]> = {};
  for (const e of entries) {
    const d = new Date(e.dateISO + "T00:00:00");
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(e);
  }
  const sortedKeys = Object.keys(buckets).sort().reverse();
  return sortedKeys.map((k) => {
    const [year, mm] = k.split("-").map(Number);
    const monthLabel = new Date(year, mm - 1, 1).toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
    return {
      monthLabel,
      // Within a month, newest first.
      entries: buckets[k].sort((a, b) => b.dateISO.localeCompare(a.dateISO)),
    };
  });
}

function relativeDateLabel(dateISO: string, today: Date = new Date()): string {
  const d = new Date(dateISO + "T00:00:00");
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  if (dateISO === todayKey) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
  if (dateISO === yKey) return "Yesterday";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatWeight(kg: number, isImperial: boolean): string {
  if (isImperial) {
    return `${Math.round(kgToLb(kg) * 10) / 10} lb`;
  }
  return `${Math.round(kg * 10) / 10} kg`;
}

export function AllWeightDataSheet({
  visible,
  onClose,
  userId,
  isImperial,
  weightKgByDay,
  onDeleteWeight,
  onEntryDeleted,
  onEditEntry,
}: AllWeightDataSheetProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the edit affordance
  // (tint + glyph).
  const accent = useAccent();
  const insets = useSafeAreaInsets();

  const sections = React.useMemo(() => {
    const entries: WeightEntry[] = Object.entries(weightKgByDay)
      .filter(([, kg]) => Number.isFinite(kg) && kg > 0)
      .map(([dateISO, kg]) => ({ dateISO, kg: kg as number }));
    return groupByMonth(entries);
  }, [weightKgByDay]);

  const totalCount = React.useMemo(
    () => sections.reduce((n, s) => n + s.entries.length, 0),
    [sections],
  );

  const handleDelete = React.useCallback(
    async (dateISO: string) => {
      if (!userId) return;
      try {
        const saved = await onDeleteWeight(dateISO);
        onEntryDeleted(dateISO, saved.weightKgByDay);
      } catch (error) {
        Alert.alert(
          "Couldn't delete entry",
          error instanceof Error ? error.message : "Try again.",
        );
      }
    },
    [userId, onDeleteWeight, onEntryDeleted],
  );

  const confirmDelete = React.useCallback(
    (entry: WeightEntry) => {
      Alert.alert(
        "Delete this entry?",
        `${formatWeight(entry.kg, isImperial)} on ${relativeDateLabel(entry.dateISO)}. This can't be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => void handleDelete(entry.dateISO),
          },
        ],
      );
    },
    [isImperial, handleDelete],
  );

  // ENG-748 #9 — long-press now offers Edit (correct a mistyped value,
  // keep the date) before Delete. Edit routes up to the parent's
  // LogWeightSheet in edit mode; the sheet must close first so the two
  // modals don't stack.
  const showRowActions = React.useCallback(
    (entry: WeightEntry) => {
      Alert.alert(
        `${formatWeight(entry.kg, isImperial)} · ${relativeDateLabel(entry.dateISO)}`,
        undefined,
        [
          {
            text: "Edit",
            onPress: () => {
              onClose();
              onEditEntry(entry.dateISO);
            },
          },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => confirmDelete(entry),
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
    },
    [isImperial, onClose, onEditEntry, confirmDelete],
  );

  // Flatten sections into a list of items with `kind` markers so a
  // single FlatList renders both headers and rows.
  type Row =
    | { kind: "header"; key: string; label: string; count: number }
    | { kind: "entry"; key: string; entry: WeightEntry };
  const rows = React.useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const s of sections) {
      out.push({
        kind: "header",
        key: `h-${s.monthLabel}`,
        label: s.monthLabel,
        count: s.entries.length,
      });
      for (const e of s.entries) {
        out.push({ kind: "entry", key: `e-${e.dateISO}`, entry: e });
      }
    }
    return out;
  }, [sections]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, paddingTop: insets.top },
        ]}
        testID="all-weight-data-sheet"
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            accessibilityLabel="Close"
            testID="all-weight-data-close"
          >
            <X size={IconSize.md} color={colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>All data</Text>
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {totalCount} {totalCount === 1 ? "entry" : "entries"}
          </Text>
        </View>
        {totalCount === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No weigh-ins yet
            </Text>
            <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
              Log your weight from the Progress tab to start a trend.
            </Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={{
              paddingBottom: insets.bottom + Spacing.xl,
            }}
            renderItem={({ item }) => {
              if (item.kind === "header") {
                return (
                  <View
                    style={[
                      styles.sectionHeader,
                      { backgroundColor: colors.background },
                    ]}
                  >
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>
                      {item.label}
                    </Text>
                    <Text
                      style={[
                        styles.sectionCount,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {item.count}{" "}
                      {item.count === 1 ? "measurement" : "measurements"}
                    </Text>
                  </View>
                );
              }
              const { entry } = item;
              return (
                <Pressable
                  onPress={() => showRowActions(entry)}
                  onLongPress={() => showRowActions(entry)}
                  delayLongPress={350}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      backgroundColor: pressed ? colors.inputBg : "transparent",
                      borderBottomColor: colors.border,
                    },
                  ]}
                  testID={`all-weight-data-row-${entry.dateISO}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatWeight(entry.kg, isImperial)} on ${relativeDateLabel(entry.dateISO)}. Tap to edit or delete.`}
                >
                  <View
                    style={[
                      styles.iconSquare,
                      { backgroundColor: accent.primary + "22" },
                    ]}
                  >
                    <ScaleIcon
                      size={16}
                      color={accent.primary}
                      strokeWidth={2}
                    />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={[styles.rowValue, { color: colors.text }]}>
                      {formatWeight(entry.kg, isImperial)}
                    </Text>
                    <Text
                      style={[styles.rowDate, { color: colors.textSecondary }]}
                    >
                      {relativeDateLabel(entry.dateISO)}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  title: {
    ...Type.headline,
    flex: 1,
    textAlign: "left",
    marginLeft: Spacing.sm,
  },
  count: { ...Type.caption },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: { ...Type.headline, marginBottom: Spacing.xs },
  emptyBody: { ...Type.body, textAlign: "center" },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xs,
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  // headers census 2026-06-10: drop the fontSize 22 override — 22 isn't a ramp
  // size; Type.title is 24.
  sectionTitle: { ...Type.title },
  sectionCount: { ...Type.caption },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconSquare: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1 },
  rowValue: { ...Type.headline },
  rowDate: { ...Type.caption, marginTop: 2 },
});
