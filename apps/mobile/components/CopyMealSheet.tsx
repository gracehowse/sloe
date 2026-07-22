/**
 * Copy-meal bottom sheet (batch 1.4).
 *
 * Mirrors the web `CopyMealDialog` — date picker + "also copy to next N
 * days" quick chips. Shares the same `sanitizeCopySlotTargets` / `addDays`
 * helpers from `src/lib/nutrition/copyMeals.ts` so the two platforms
 * cannot drift on target-list dedup or date arithmetic.
 *
 * ENG-786 rebuild (2026-07-21) — this sheet is used two ways: copying a
 * SINGLE item (`copyMealTargetId` in `TodayScreen.tsx`) and copying a
 * WHOLE SLOT's items ("Copy to another day", `copySlotTarget`). Both now
 * choose a target meal slot as well as a target day — the per-item
 * entry's long-press action already said "Copy to another meal or day";
 * before this rebuild that was aspirational copy with no slot picker
 * behind it.
 */
import { useEffect, useMemo, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { Modal, Pressable, Text, View, ScrollView } from "react-native";

import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { journalRangeBounds } from "@/lib/journalNavigation";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import {
  addDays,
  sanitizeCopySlotTargets,
} from "@suppr/nutrition-core/copyMeals";
import CopyMealCalendar from "@/components/today/CopyMealCalendar";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  primaryForeground: string;
};

type QuickRange = "none" | "+2" | "+3" | "+7";

const QUICK_RANGES: { key: QuickRange; label: string; days: number }[] = [
  { key: "+2", label: "Next 2 days", days: 2 },
  { key: "+3", label: "Next 3 days", days: 3 },
  { key: "+7", label: "Next 7 days", days: 7 },
];

function formatHumanDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function stripMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** `YYYY-MM-DD` — the day the meal currently lives on. */
  sourceDayKey: string;
  /** Shown in the header. */
  mealLabel: string;
  /**
   * ENG-786 rebuild — the meal slot the source entry/entries currently
   * live in. Also the slot selector's default (reset on every open) and
   * the input to `sanitizeCopySlotTargets`'s same-day/same-slot no-op
   * check.
   */
  sourceSlot: string;
  /**
   * ENG-786 rebuild — the enabled meal slots offered by the selector
   * (e.g. the host's `enabledMealSlotLabels(...)` / `MEAL_SLOTS`).
   */
  slots: readonly string[];
  /**
   * ENG-786 rebuild — overrides the default initial target day
   * (`addDays(sourceDayKey, 1)`, i.e. "tomorrow"). Callers viewing a PAST
   * day pass today's date key here instead, per the Fable default-target
   * ruling — "tomorrow" is a confusing default when the source day is
   * already in the past. Omit to keep the tomorrow default.
   */
  initialTargetDayKey?: string;
  /** Called with the deduped, source-excluded target keys, the chosen
   *  target slot, and a human summary. */
  onConfirm: (targetDayKeys: string[], targetSlot: string, summary: string) => void;
  colors: Theme;
};

export default function CopyMealSheet({
  visible,
  onClose,
  sourceDayKey,
  mealLabel,
  sourceSlot,
  slots,
  initialTargetDayKey,
  onConfirm,
  colors,
}: Props) {
  // Secondary accent (Frost flag → damson, else clay) for the selected calendar
  // day, active quick-range chips, and the Copy CTA.
  const accent = useAccent();
  // ENG-1002/type_scale_v1 — whole-app font-family + size consistency gate.
  const typeScaleV1 = isFeatureEnabled("type_scale_v1");
  const defaultTarget = useMemo(
    () => initialTargetDayKey ?? addDays(sourceDayKey, 1),
    [sourceDayKey, initialTargetDayKey],
  );
  const [targetKey, setTargetKey] = useState(defaultTarget);
  const [quickRange, setQuickRange] = useState<QuickRange>("none");
  const [targetSlot, setTargetSlot] = useState(sourceSlot);
  const [viewMonth, setViewMonth] = useState(() => stripMidnight(new Date()));
  const { min, max } = useMemo(() => journalRangeBounds(), []);

  useEffect(() => {
    if (visible) {
      setTargetKey(defaultTarget);
      setQuickRange("none");
      setTargetSlot(sourceSlot);
      const [y, m, d] = defaultTarget.split("-").map(Number);
      setViewMonth(new Date(y, (m ?? 1) - 1, d ?? 1));
    }
  }, [visible, defaultTarget, sourceSlot]);

  const targetDayKeys = useMemo(() => {
    const base = [targetKey];
    if (quickRange !== "none") {
      const range = QUICK_RANGES.find((r) => r.key === quickRange);
      if (range) {
        for (let i = 1; i < range.days; i += 1) base.push(addDays(targetKey, i));
      }
    }
    return sanitizeCopySlotTargets(sourceDayKey, sourceSlot, targetSlot, base);
  }, [targetKey, quickRange, sourceDayKey, sourceSlot, targetSlot]);

  // ENG-786 rebuild — day-only phrasing is untouched when the slot is
  // unchanged (minimal blast radius on the pre-existing single-item copy
  // flow's summary); a changed slot appends " · <Slot>" onto whichever
  // day phrasing already applies.
  const summary = useMemo(() => {
    if (targetDayKeys.length === 0) return "Nothing to copy";
    const base =
      targetDayKeys.length === 1
        ? `Copied to ${formatHumanDate(targetDayKeys[0]!)}`
        : `Copied to ${targetDayKeys.length} days`;
    return targetSlot !== sourceSlot ? `${base} · ${targetSlot}` : base;
  }, [targetDayKeys, targetSlot, sourceSlot]);

  const canConfirm = targetDayKeys.length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            padding: Spacing.lg,
            paddingBottom: Spacing.xl,
          }}
        >
          <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
            <View style={{ width: 36, height: 4, borderRadius: Radius.full, backgroundColor: colors.cardBorder }} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
            Copy meal to another day
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
            {`"${mealLabel}"`}
          </Text>

          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            <CopyMealCalendar
              viewMonth={viewMonth}
              onChangeMonth={setViewMonth}
              targetKey={targetKey}
              onPick={setTargetKey}
              sourceDayKey={sourceDayKey}
              sourceSlot={sourceSlot}
              targetSlot={targetSlot}
              min={min}
              max={max}
              colors={{ text: colors.text, textTertiary: colors.textTertiary, primaryForeground: colors.primaryForeground }}
            />
          </ScrollView>

          {/* ENG-786 rebuild — meal-slot selector. Same pill shape/sizing/
              selected-state treatment as the "Also copy to" quick-range
              chips below (same element, same treatment) — no new visual
              language invented for it. */}
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginTop: Spacing.md, marginBottom: Spacing.xs }}>
            Copy into
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {slots.map((slot) => {
              const isActive = targetSlot === slot;
              return (
                <PressableScale
                  key={slot}
                  onPress={() => setTargetSlot(slot)}
                  haptic="selection"
                  accessibilityRole="button"
                  accessibilityLabel={slot}
                  accessibilityState={{ selected: isActive }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: Radius.full,
                    borderWidth: 1,
                    borderColor: isActive ? accent.primary : colors.cardBorder,
                    backgroundColor: isActive ? accent.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Type.captionSmall.fontFamily,
                      fontSize: Type.captionSmall.fontSize,
                      lineHeight: Type.captionSmall.lineHeight,
                      fontWeight: "600",
                      color: isActive ? colors.primaryForeground : colors.text,
                    }}
                  >
                    {slot}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {/* Quick range chips */}
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginTop: Spacing.md, marginBottom: 6 }}>
            Also copy to
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {(["none", ...QUICK_RANGES.map((r) => r.key)] as QuickRange[]).map((key) => {
              const isActive = quickRange === key;
              const label = key === "none" ? "Just this day" : QUICK_RANGES.find((r) => r.key === key)!.label;
              return (
                <PressableScale
                  key={key}
                  onPress={() => setQuickRange(key)}
                  haptic="selection"
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected: isActive }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: Radius.full,
                    borderWidth: 1,
                    borderColor: isActive ? accent.primary : colors.cardBorder,
                    backgroundColor: isActive ? accent.primary : "transparent",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: Type.captionSmall.fontFamily,
                      fontSize: Type.captionSmall.fontSize,
                      lineHeight: Type.captionSmall.lineHeight,
                      fontWeight: "600",
                      color: isActive ? colors.primaryForeground : colors.text,
                    }}
                  >
                    {label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {/* Factual summary — day-only phrasing untouched when the slot is
              unchanged; a changed slot appends " · <Slot>" before the
              trailing period (mirrors `summary` above). */}
          <Text style={{ ...Type.captionSmall, color: colors.textTertiary, marginTop: Spacing.md }}>
            {targetDayKeys.length === 0
              ? "Nothing to copy — pick a day other than the source."
              : (() => {
                  const core =
                    targetDayKeys.length === 1
                      ? `Will copy to ${formatHumanDate(targetDayKeys[0]!)}`
                      : `Will copy to ${targetDayKeys.length} days (${formatHumanDate(
                          targetDayKeys[0]!,
                        )} – ${formatHumanDate(targetDayKeys[targetDayKeys.length - 1]!)})`;
                  const suffix = targetSlot !== sourceSlot ? ` · ${targetSlot}` : "";
                  return `${core}${suffix}.`;
                })()}
          </Text>

          {/* Action row */}
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg }}>
            <PressableScale
              onPress={onClose}
              haptic="selection"
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderWidth: 1,
                borderColor: colors.cardBorder,
                borderRadius: Radius.md,
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={typeScaleV1 ? { ...Type.button, color: colors.text } : { fontSize: 14, fontWeight: "600", color: colors.text }}>Cancel</Text>
            </PressableScale>
            <PressableScale
              onPress={() => {
                if (!canConfirm) {
                  onConfirm([], targetSlot, "Nothing to copy");
                  onClose();
                  return;
                }
                onConfirm(targetDayKeys, targetSlot, summary);
                onClose();
              }}
              haptic="confirm"
              disabled={!canConfirm}
              style={{
                flex: 1,
                paddingVertical: 12,
                alignItems: "center",
                borderRadius: Radius.md,
                backgroundColor: canConfirm ? accent.primary : colors.cardBorder,
              }}
              accessibilityRole="button"
              accessibilityLabel="Copy"
              accessibilityState={{ disabled: !canConfirm }}
            >
              <Text style={typeScaleV1 ? { ...Type.button, color: colors.primaryForeground } : { fontSize: 14, fontWeight: "700", color: colors.primaryForeground }}>Copy</Text>
            </PressableScale>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
