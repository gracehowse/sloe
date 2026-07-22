import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Check, ChevronDown, ChevronUp, X } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { SupprButton } from "@/components/ui/SupprButton";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { formatKcalDisplay, formatQualifiedKcal } from "@suppr/nutrition-core/formatMacro";
import {
  sessionTrayTotals,
  trayIsFullyVerified,
  trayIsMultiSlot,
  type LogSessionTrayItem,
  type LogSessionTrayProps,
} from "@suppr/nutrition-core/logSessionTray";

/**
 * ENG-1643 — the log-session tray (immediate-commit multi-add receipt). Shown
 * pinned to the LogSheet's bottom edge whenever ≥ 1 item was committed this
 * sheet-session. Presentational: the host owns state + the commit/removal
 * paths; this surface renders the running count/kcal, a per-item Undo, a
 * Save-as-usual-meal (≥ 2 items), and a primary Done.
 *
 * Spec: `docs/specs/2026-07-21-log-session-tray.md`. Mirror of web
 * `src/app/components/suppr/log-session-tray.tsx`.
 */
export function LogSessionTray({
  items,
  pendingUndoIds,
  onUndo,
  onDone,
  onSaveMeal,
}: LogSessionTrayProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const [expanded, setExpanded] = useState(false);

  // Add announcement (a11y) — announce the newest item + running count when the
  // tray grows. The visible increment IS the confirmation (no S13 card).
  const prevCount = useRef(0);
  useEffect(() => {
    if (items.length > prevCount.current && items.length > 0) {
      const newest = items[items.length - 1];
      if (newest) {
        AccessibilityInfo.announceForAccessibility(
          `Added ${newest.title}. ${items.length} items this session.`,
        );
      }
    }
    prevCount.current = items.length;
  }, [items]);

  if (items.length === 0) return null;

  const totals = sessionTrayTotals(items);
  const trustFlag = isFeatureEnabled("kcal_trust_qualifier_v1");
  const kcalText = (kcal: number, verified: boolean) =>
    trustFlag ? formatQualifiedKcal(kcal, verified) : formatKcalDisplay(kcal);
  const multiSlot = trayIsMultiSlot(items);
  const totalKcal = kcalText(totals.kcal, trayIsFullyVerified(items));

  return (
    <View
      testID="log-session-tray"
      style={[styles.tray, { backgroundColor: colors.card, borderTopColor: colors.border }]}
    >
      {expanded ? (
        <ScrollView
          testID="log-session-tray-list"
          accessibilityRole="list"
          style={styles.expanded}
          contentContainerStyle={styles.expandedContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[Type.label, styles.eyebrow, { color: colors.textTertiary }]}>
            Added this session
          </Text>
          {items.map((item, i) => (
            <TrayRow
              key={item.mealId}
              index={i}
              item={item}
              kcalLabel={`${kcalText(item.kcal, item.kcalIsVerified === true)} kcal`}
              slotSuffix={multiSlot ? item.slot : null}
              disabled={pendingUndoIds.includes(item.mealId)}
              onUndo={() => onUndo(item)}
              colors={colors}
              accent={accent}
            />
          ))}
          <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
            <Text style={[Type.captionStrong, { color: colors.text }]}>Total</Text>
            <Text
              style={[Type.captionStrong, styles.totalValue, { color: colors.textSecondary }]}
            >
              {`${totalKcal} kcal · ${totals.protein} P · ${totals.carbs} C · ${totals.fat} F`}
            </Text>
          </View>
        </ScrollView>
      ) : null}

      <View testID="log-session-tray-bar" style={styles.bar}>
        <PressableScale
          haptic="selection"
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${totals.count} added, ${totalKcal} kilocalories this session`}
          testID="log-session-tray-toggle"
          onPress={() => setExpanded((v) => !v)}
          style={styles.toggle}
        >
          <View style={[styles.mark, { backgroundColor: accent.successSoft }]}>
            <Check size={14} color={accent.successSolid} strokeWidth={2.5} />
          </View>
          <Text style={[Type.captionStrong, styles.barLabel, { color: colors.text }]} numberOfLines={1}>
            {`${totals.count} added · ${totalKcal} kcal`}
          </Text>
          {expanded ? (
            <ChevronDown size={16} color={colors.textTertiary} strokeWidth={2} />
          ) : (
            <ChevronUp size={16} color={colors.textTertiary} strokeWidth={2} />
          )}
        </PressableScale>
        <SupprButton
          variant="primary"
          label="Done"
          accessibilityLabel="Done"
          testID="log-session-tray-done"
          onPress={onDone}
          style={styles.done}
        />
      </View>

      {expanded && items.length >= 2 && onSaveMeal ? (
        <View style={styles.saveRow}>
          <SupprButton
            variant="ghost"
            label="Save as usual meal"
            accessibilityLabel="Save as usual meal"
            testID="log-session-tray-save-meal"
            onPress={onSaveMeal}
            style={styles.save}
          />
        </View>
      ) : null}
    </View>
  );
}

function TrayRow({
  index,
  item,
  kcalLabel,
  slotSuffix,
  disabled,
  onUndo,
  colors,
  accent,
}: {
  index: number;
  item: LogSessionTrayItem;
  kcalLabel: string;
  slotSuffix: string | null;
  disabled: boolean;
  onUndo: () => void;
  colors: ReturnType<typeof useThemeColors>;
  accent: ReturnType<typeof useAccent>;
}) {
  return (
    <View
      testID={`log-session-tray-row-${index}`}
      accessibilityLabel={`${item.title}, ${item.kcal} kilocalories, added`}
      style={styles.row}
    >
      <View style={styles.rowText}>
        <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[Type.caption, styles.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
          {slotSuffix ? `${kcalLabel} · ${slotSuffix}` : kcalLabel}
        </Text>
      </View>
      <PressableScale
        haptic="warn"
        accessibilityRole="button"
        accessibilityLabel={`Undo ${item.title}`}
        accessibilityState={{ disabled }}
        testID={`log-session-tray-undo-${index}`}
        disabled={disabled}
        onPress={disabled ? undefined : onUndo}
        style={[styles.undo, { opacity: disabled ? 0.4 : 1 }]}
      >
        <X size={16} color={accent.successSolid} strokeWidth={2.25} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.dense,
    paddingBottom: Spacing.sm,
  },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  toggle: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    minWidth: 0,
  },
  mark: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  barLabel: {
    flexShrink: 1,
  },
  done: {
    minWidth: 96,
  },
  expanded: {
    maxHeight: 240,
    marginBottom: Spacing.dense,
  },
  expandedContent: {
    gap: Spacing.xs,
  },
  eyebrow: {
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowMeta: {
    marginTop: Spacing.xs,
    fontVariant: ["tabular-nums"],
  },
  undo: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  totalValue: {
    flexShrink: 1,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  saveRow: {
    marginTop: Spacing.sm,
  },
  save: {
    width: "100%",
  },
});

export default LogSessionTray;
