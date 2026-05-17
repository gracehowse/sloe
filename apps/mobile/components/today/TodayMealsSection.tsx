import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Share, Text, View } from "react-native";
import { buildMealShareText } from "@suppr/shared/share/buildMealShareText";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { Swipeable } from "react-native-gesture-handler";
import {
  Bookmark,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Coffee,
  Cookie,
  Copy,
  Plus,
  RefreshCw,
  Sun,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Accent, Radius, SlotColors, Spacing } from "@/constants/theme";
import { SourceDot } from "@/components/ui/SourceDot";
import { mapMealSourceToDot } from "@suppr/shared/nutrition/sourceMap";
import { formatMacroTrailer } from "@suppr/shared/nutrition/macroFormat";
import type { JournalMeal } from "@/lib/nutritionJournal";
import type { SavedMeal } from "@suppr/shared/nutrition/savedMeals";
import { summariseSavedMeal } from "@suppr/shared/nutrition/savedMealsLogic";
import { AiFirstLogTooltip } from "./AiFirstLogTooltip";

/**
 * TodayMealsSection — per-slot meal list with swipe-to-delete, long-press
 * menu, slot-header `Log usual` pill, full-width Save-as-usual row, and
 * the first-run hint.
 *
 * Ship M1 (2026-04-18). Saved meals is the canonical re-log mechanism:
 *  - Right-side slot-header action: `[↻ Log usual: <name>]` pill when ≥1
 *    saved meal matches the slot. 2+ matches open a picker modal.
 *  - Full-width row below the last item: `+ Save {Slot} as a meal` when
 *    the slot has ≥2 items AND no saved meal yet for this slot.
 *  - First-run hint renders above the full-width save row when the host
 *    passes a `hintVisibleForSlot(slot)` truthy value.
 *
 * The prior 10px "Save combo" chip is deleted. All user-facing "combo"
 * strings are replaced with "usual meal".
 */

export interface TodayMealsSectionProps {
  slots: readonly string[];
  mealGroups: Record<string, JournalMeal[]>;
  mealsTodayCount: number;
  collapsedSlots: Set<string>;
  onToggleSlotCollapse: (slot: string) => void;
  onOpenFabForSlot: (slot: string) => void;
  /** Open the save-as-usual sheet pre-seeded with the items in `slot`. */
  onOpenSaveUsualMealForSlot: (slot: string) => void;
  onOpenDuplicateDay: () => void;
  /** Tap the slot header (when the slot has items) → combined macros for everything in that slot. */
  onPressSlotSummary?: (slot: string) => void;
  onPressMeal: (mealId: string) => void;
  onLongPressEdit: (meal: JournalMeal) => void;
  onRequestCopyMeal: (mealId: string) => void;
  onDeleteMeal: (mealId: string) => void;
  showMealTimestamps: boolean;
  formatMealMacroDetail: (m: JournalMeal) => string;
  formatMealTimeDisplay: (time: string | undefined, createdAt?: string | null) => string;
  formatMealSourceLabelForRow: (source: string | null | undefined) => string | null;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  cardColor: string;
  cardBorderColor: string;
  /** Ship M1 — all saved meals the user owns, sorted newest-logged-first. */
  savedMeals: readonly SavedMeal[];
  /** Ship M1 — log a saved meal into a specific slot. */
  onLogSavedMeal: (meal: SavedMeal, slot: string) => void;
  /** Ship M1 — whether the first-run hint is allowed to render in `slot`. */
  hintVisibleForSlot: (slot: string) => boolean;
  /** Ship M1 — user tapped "Not now" on the hint for `slot`. */
  onDismissUsualMealHint: (slot: string) => void;
  /** Ship M1 — user tapped "Save as usual" on the hint for `slot`. */
  onAcceptUsualMealHint: (slot: string) => void;
  /**
   * Phase 5 (2026-04-30) — AI-first-log tooltip lifecycle. The host
   * resolves the meal id of the FIRST AI-sourced row to anchor the
   * tooltip below; this component renders the tooltip below that row
   * when set. `null` (or unset) means no tooltip. The tooltip is a
   * one-time event gated by AsyncStorage in the host; once the user
   * dismisses or the bubble auto-fades, host clears this and writes
   * the storage key so it never fires again.
   */
  aiFirstLogTooltipMealId?: string | null;
  /** Phase 5 (2026-04-30) — fired on X tap or auto-fade. Host
   *  persists the storage key and clears `aiFirstLogTooltipMealId`. */
  onDismissAiFirstLogTooltip?: () => void;
}

/**
 * F-12 (2026-04-19) → spec §1.5 lucide mapping (2026-04-27).
 *
 * Production design spec §1.5 defines the canonical meal-slot glyph
 * set on `lucide-react-native`:
 *   - Coffee  (Breakfast)
 *   - Sun     (Lunch)
 *   - UtensilsCrossed (Dinner)
 *   - Cookie  (Snack / Snacks)
 *
 * This replaces the previous F-12 cross-family workaround (a mix of
 * @expo/vector-icons and MCI cookie-outline). Both platforms now
 * share the identical lucide glyph set so the parity test
 * (`mealSlotIconFamilyParity.test.ts`) pins the lucide names directly.
 */
const SLOT_ICON: Record<string, LucideIcon> = {
  Breakfast: Coffee,
  Lunch: Sun,
  Dinner: UtensilsCrossed,
  Snacks: Cookie,
  Snack: Cookie,
};

/**
 * Per-slot tint. Sourced from `SlotColors` (mobile) / `--slot-*` (web).
 *
 * 2026-05-01 (ui-critic P2 #10): Snacks previously inlined
 * `MacroColors.fat` (magenta) which collided 1:1 with the Fat macro
 * tile on Today. Snack now uses its own cyan token; macro tokens are
 * reserved for the Macro tile row.
 */
const SLOT_COLOR: Record<string, string> = {
  Breakfast: SlotColors.breakfast,
  Lunch: SlotColors.lunch,
  Dinner: SlotColors.dinner,
  Snacks: SlotColors.snack,
  Snack: SlotColors.snack,
};

function slotIcon(s: string): LucideIcon {
  return SLOT_ICON[s] ?? UtensilsCrossed;
}

function slotColor(s: string): string {
  return SLOT_COLOR[s] ?? Accent.primary;
}

function SlotIcon({
  Glyph,
  size,
  color,
}: {
  Glyph: LucideIcon;
  size: number;
  color: string;
}) {
  return <Glyph size={size} color={color} />;
}

/** Pull the saved meals whose `defaultMealSlot === slot`, newest-logged first. */
function savedMealsForSlot(meals: readonly SavedMeal[], slot: string): SavedMeal[] {
  const out: SavedMeal[] = [];
  for (const m of meals) {
    if (m.defaultMealSlot === slot) out.push(m);
  }
  return out.sort((a, b) => {
    const ta = a.lastLoggedAt ? Date.parse(a.lastLoggedAt) : 0;
    const tb = b.lastLoggedAt ? Date.parse(b.lastLoggedAt) : 0;
    if (ta !== tb) return tb - ta;
    return Date.parse(b.createdAt) - Date.parse(a.createdAt);
  });
}

export function TodayMealsSection(props: TodayMealsSectionProps) {
  const {
    slots,
    mealGroups,
    mealsTodayCount,
    collapsedSlots,
    onToggleSlotCollapse,
    onOpenFabForSlot,
    onOpenSaveUsualMealForSlot,
    onOpenDuplicateDay,
    onPressSlotSummary,
    onPressMeal,
    onLongPressEdit,
    onRequestCopyMeal,
    onDeleteMeal,
    showMealTimestamps,
    formatMealMacroDetail,
    formatMealTimeDisplay,
    formatMealSourceLabelForRow,
    textColor,
    textTertiaryColor,
    textSecondaryColor,
    cardColor,
    cardBorderColor,
    savedMeals,
    onLogSavedMeal,
    hintVisibleForSlot,
    onDismissUsualMealHint,
    onAcceptUsualMealHint,
    aiFirstLogTooltipMealId,
    onDismissAiFirstLogTooltip,
  } = props;

  const [usualPicker, setUsualPicker] = useState<
    { slot: string; options: SavedMeal[] } | null
  >(null);
  const [usualPickerShowAll, setUsualPickerShowAll] = useState(false);

  // 2026-05-15 (crowder task) — flag-gated header relayout. When ON, the
  // `Log usual: <name>` chip moves out of the section-header trailing
  // cluster into a dedicated row directly under the header. The header
  // was overflowing on narrow widths with a long saved-meal name
  // (`Snacks` truncated to `S`, item-count digit overlapping the
  // chevron). See `docs/decisions/2026-05-15-today-log-usual-row-v2.md`.
  // Off-branch preserves the prior in-header chip verbatim.
  const usualRowV2 = isFeatureEnabled("today_log_usual_row_v2");

  return (
    <View>
      {mealsTodayCount > 0 && (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 6 }}>
          <Pressable
            onPress={onOpenDuplicateDay}
            accessibilityRole="button"
            accessibilityLabel="Duplicate this day to another day"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: Accent.primary + "08",
            }}
          >
            <Copy size={12} color={Accent.primary} />
            <Text style={{ fontSize: 11, fontWeight: "600", color: Accent.primary }}>Duplicate day…</Text>
          </Pressable>
        </View>
      )}
      <View
        style={{
          backgroundColor: cardColor,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: cardBorderColor,
          overflow: "hidden",
          marginBottom: Spacing.lg,
        }}
      >
        {slots.map((slot) => {
          const meals = mealGroups[slot] ?? [];
          const slotCals = Math.round(meals.reduce((a, m) => a + m.calories, 0));
          const isOpen = !collapsedSlots.has(slot);
          const hasMeals = meals.length > 0;
          const ic = slotIcon(slot);
          const col = slotColor(slot);
          const slotSaved = savedMealsForSlot(savedMeals, slot);
          const hasSaved = slotSaved.length > 0;
          const showSaveRow = meals.length >= 2 && !hasSaved;
          const showHint = !hasSaved && meals.length >= 1 && hintVisibleForSlot(slot);
          const primarySaved = slotSaved[0];
          const extraSavedCount = slotSaved.length - 1;
          return (
            <View key={slot} testID={`today-slot-${slot}`}>
              <View
                testID={`today-slot-header-${slot}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: cardBorderColor,
                  opacity: hasMeals ? 1 : 0.45,
                  padding: 12,
                  paddingHorizontal: 14,
                  gap: 10,
                }}
              >
                <Pressable
                  onPress={() => {
                    if (!hasMeals) {
                      onOpenFabForSlot(slot);
                      return;
                    }
                    if (onPressSlotSummary) {
                      onPressSlotSummary(slot);
                      return;
                    }
                    onToggleSlotCollapse(slot);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    flex: 1,
                    minWidth: 0,
                    gap: 10,
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    hasMeals
                      ? onPressSlotSummary
                        ? `${slot}, ${meals.length} items — open combined nutrition`
                        : `${slot}, ${meals.length} items — expand or collapse`
                      : `${slot} — add food`
                  }
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      backgroundColor: col + "18",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <SlotIcon Glyph={ic} size={16} color={col} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* F-80 (2026-04-25) — `numberOfLines={1}` on both the slot
                        title and the meta line. Without these, the "Log usual:
                        <name>" pill in the trailing row crowds the title column
                        down to ~80 px and the title letter-wraps ("Brea / kfast
                        / 4 / items / · tap a / meal / for full / nutriti / on").
                        The pill itself is also constrained below; `minWidth: 0`
                        on this column lets RN actually shrink the text under
                        pressure (RN flex defaults to `minWidth: auto` which is
                        content-width and prevents shrink). */}
                    <Text
                      style={{ fontSize: 13, fontWeight: "600", color: textColor }}
                      numberOfLines={1}
                    >
                      {slot}
                    </Text>
                    {hasMeals ? (
                      <Text
                        style={{ fontSize: 11, color: textTertiaryColor }}
                        numberOfLines={1}
                      >
                        {meals.length} item{meals.length > 1 ? "s" : ""}
                        {onPressSlotSummary
                          ? " · tap for combined macros"
                          : " · tap an item for nutrition"}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 11, color: textTertiaryColor }} numberOfLines={1}>
                        Tap to add
                      </Text>
                    )}
                  </View>
                </Pressable>
                {hasMeals && onPressSlotSummary ? (
                  <Pressable
                    testID={`today-slot-chevron-${slot}`}
                    onPress={() => onToggleSlotCollapse(slot)}
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={isOpen ? `Collapse ${slot}` : `Expand ${slot}`}
                    style={{
                      paddingHorizontal: 4,
                      paddingVertical: 4,
                      marginRight: -2,
                    }}
                  >
                    {isOpen ? (
                      <ChevronUp size={18} color={textSecondaryColor} strokeWidth={2} />
                    ) : (
                      <ChevronDown size={18} color={textSecondaryColor} strokeWidth={2} />
                    )}
                  </Pressable>
                ) : null}
                {hasMeals ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {/* F-17 (2026-04-19, TestFlight `AIjmgrBMmY-M6B363x_hT8I`)
                        — populated slots had no "+" affordance, leaving the
                        tester stuck ("now I've added yogurt for breakfast
                        I can't add anything else"). Render a compact plus
                        pill on populated rows that opens the same
                        slot-scoped food search the empty-state "Tap to add"
                        uses. `stopPropagation` prevents the outer row
                        Pressable (which toggles slot collapse) from
                        firing. */}
                    <Pressable
                      onPress={(e) => {
                        e?.stopPropagation?.();
                        onOpenFabForSlot(slot);
                      }}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Add another item to ${slot}`}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: Accent.primary + "18",
                        borderWidth: 1,
                        borderColor: Accent.primary + "30",
                      }}
                    >
                      <Plus size={16} color={Accent.primary} />
                    </Pressable>
                    {/* Ship M1 — `Log usual: {name}` pill. 2+ matches open
                        the picker modal; 1 match logs on tap.
                        2026-05-15 (crowder task) — when `usualRowV2` is
                        ON, the chip moves to a dedicated row below the
                        header (rendered after this header View). */}
                    {!usualRowV2 && hasSaved && primarySaved && (
                      <Pressable
                        testID={`today-log-usual-pill-in-header-${slot}`}
                        onPress={(e) => {
                          e.stopPropagation?.();
                          if (slotSaved.length >= 2) {
                            setUsualPicker({ slot, options: slotSaved });
                          } else {
                            onLogSavedMeal(primarySaved, slot);
                          }
                        }}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={
                          slotSaved.length >= 2
                            ? `Log a usual ${slot} — choose from ${slotSaved.length} saved meals`
                            : `Log usual ${slot}: ${primarySaved.name}`
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 999,
                          backgroundColor: Accent.primary + "18",
                          borderWidth: 1,
                          borderColor: Accent.primary + "30",
                          // F-80 — cap the chip so it cannot starve the title
                          // column when the meal name is long. `flexShrink: 1`
                          // lets it compress further if both columns are
                          // squeezed (e.g. larger Dynamic Type).
                          maxWidth: 160,
                          flexShrink: 1,
                        }}
                      >
                        <RefreshCw size={11} color={Accent.primary} />
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "700",
                            color: Accent.primary,
                            maxWidth: 120,
                          }}
                          numberOfLines={1}
                        >
                          {extraSavedCount > 0 ? "Log usual…" : `Log usual: ${primarySaved.name}`}
                        </Text>
                      </Pressable>
                    )}
                    <Text style={{ fontSize: 14, fontWeight: "700", color: textColor, fontVariant: ["tabular-nums"] }}>
                      {slotCals}
                    </Text>
                    <Text style={{ fontSize: 10, color: textTertiaryColor }}>kcal</Text>
                  </View>
                ) : (
                  <Plus size={14} color={textTertiaryColor} />
                )}
              </View>
              {/* 2026-05-15 (crowder task) — flag-gated dedicated row for
                  the `Log usual: <name>` pill. Lives between the header
                  and the food items so the header stays compact even
                  when the saved-meal name is long. Renders regardless
                  of `isOpen` so the affordance is reachable from
                  collapsed slots too. */}
              {usualRowV2 && hasSaved && primarySaved && (
                <View
                  testID={`today-log-usual-row-${slot}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 8,
                    paddingLeft: 56,
                    paddingRight: 14,
                    borderBottomWidth: hasMeals && isOpen ? 1 : 0,
                    borderBottomColor: cardBorderColor + "08",
                  }}
                >
                  <Pressable
                    testID={`today-log-usual-pill-${slot}`}
                    onPress={() => {
                      if (slotSaved.length >= 2) {
                        setUsualPicker({ slot, options: slotSaved });
                      } else {
                        onLogSavedMeal(primarySaved, slot);
                      }
                    }}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={
                      slotSaved.length >= 2
                        ? `Log a usual ${slot} — choose from ${slotSaved.length} saved meals`
                        : `Log usual ${slot}: ${primarySaved.name}`
                    }
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 6,
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 999,
                      backgroundColor: Accent.primary + "18",
                      borderWidth: 1,
                      borderColor: Accent.primary + "30",
                      maxWidth: "100%",
                      flexShrink: 1,
                    }}
                  >
                    <RefreshCw size={12} color={Accent.primary} />
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: "700",
                        color: Accent.primary,
                        flexShrink: 1,
                      }}
                      numberOfLines={1}
                    >
                      {extraSavedCount > 0
                        ? `Log usual ${slot}…`
                        : `Log usual: ${primarySaved.name}`}
                    </Text>
                  </Pressable>
                </View>
              )}
              {hasMeals &&
                isOpen &&
                meals.map((m) => (
                  <React.Fragment key={m.id}>
                  <Swipeable
                    overshootRight={false}
                    friction={2}
                    renderRightActions={() => (
                      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
                        <Pressable
                          onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            onDeleteMeal(m.id);
                          }}
                          // 2026-04-30 visual-qa: removed `paddingVertical: 8`
                          // so the destructive zone stretches to the meal
                          // row's natural height (3 lines: name +
                          // timestamp + source badge). Without this, the
                          // red zone showed bg padding top + bottom and
                          // looked misaligned. The Swipeable parent flex
                          // row + sibling's natural height handle the rest.
                          style={{
                            width: 88,
                            backgroundColor: Accent.destructive,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Remove meal"
                        >
                          <Trash2 size={22} color="#fff" />
                          <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700", marginTop: 4 }}>Remove</Text>
                        </Pressable>
                      </View>
                    )}
                  >
                    <Pressable
                      onPress={() => onPressMeal(m.id)}
                      onLongPress={() => {
                        Alert.alert(m.recipeTitle, formatMealMacroDetail(m), [
                          { text: "Cancel", style: "cancel" },
                          { text: "Edit", onPress: () => onLongPressEdit(m) },
                          { text: "Copy to another day", onPress: () => onRequestCopyMeal(m.id) },
                          {
                            text: "Share meal",
                            onPress: async () => {
                              const message = buildMealShareText({
                                recipeTitle: m.recipeTitle,
                                calories: m.calories,
                                protein: m.protein,
                                carbs: m.carbs,
                                fat: m.fat,
                                portionMultiplier: m.portionMultiplier,
                              });
                              try {
                                const result = await Share.share({ message, title: m.recipeTitle });
                                track("meal_share_invoked", {
                                  surface: "today_meal_row_longpress",
                                  outcome: result.action === Share.dismissedAction ? "dismissed" : "shared",
                                });
                              } catch {
                                track("meal_share_invoked", {
                                  surface: "today_meal_row_longpress",
                                  outcome: "error",
                                });
                              }
                            },
                          },
                          { text: "Delete", style: "destructive", onPress: () => onDeleteMeal(m.id) },
                        ]);
                      }}
                      style={{
                        paddingVertical: 9,
                        paddingLeft: 56,
                        paddingRight: 14,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottomWidth: 1,
                        borderBottomColor: cardBorderColor + "08",
                        backgroundColor: cardColor,
                      }}
                    >
                      <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Accent.success }} />
                          {/* 2026-05-15 (crowder task) — `flexShrink: 1`
                              + `minWidth: 0` so `numberOfLines: 1`
                              actually ellipsises. Without these, the
                              Text kept its full intrinsic width and
                              ran underneath the right-column kcal
                              value (e.g. "PB2 · Original Powdered
                              Peanut Butter (2 tbsp)" overlapped "60"
                              kcal). RN row children default to
                              `flexShrink: 0`. */}
                          <Text
                            style={{ fontSize: 12, color: textColor, flexShrink: 1, minWidth: 0 }}
                            numberOfLines={1}
                          >
                            {m.recipeTitle}
                          </Text>
                        </View>
                        {showMealTimestamps
                          ? (() => {
                              const ts = formatMealTimeDisplay(m.time, m.createdAt);
                              return ts ? (
                                <Text style={{ fontSize: 10, color: textTertiaryColor, marginLeft: 12 }}>{ts}</Text>
                              ) : null;
                            })()
                          : null}
                        {formatMealSourceLabelForRow(m.source) ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              marginLeft: 12,
                            }}
                          >
                            {/* Phase 3 / B2.4 (D-2026-04-27-16) trust
                                posture sweep — every macro-bearing
                                meal row carries the SourceDot. */}
                            <SourceDot source={mapMealSourceToDot(m.source)} size={6} />
                            <Text
                              style={{ fontSize: 9, color: textTertiaryColor, fontWeight: "500" }}
                            >
                              {formatMealSourceLabelForRow(m.source)}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ fontSize: 12, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}>
                          {Math.round(m.calories)}
                        </Text>
                        <ChevronRight size={12} color={textTertiaryColor} />
                      </View>
                    </Pressable>
                  </Swipeable>
                  {/* Phase 5 (2026-04-30) — one-time AI-first-log
                      tooltip. Anchored below the row whose id matches
                      `aiFirstLogTooltipMealId`. Host gates this on
                      AsyncStorage so it ever fires once per device.
                      Both X tap and the 6s auto-fade route through
                      `onDismissAiFirstLogTooltip` so persistence
                      stays in one place. */}
                  {aiFirstLogTooltipMealId === m.id &&
                    onDismissAiFirstLogTooltip != null && (
                      <AiFirstLogTooltip
                        visible
                        onDismiss={onDismissAiFirstLogTooltip}
                      />
                    )}
                  </React.Fragment>
                ))}
              {/* Ship M1 — first-run hint inside the slot body. Teaches
                  the feature once per slot then stops. */}
              {hasMeals && isOpen && showHint && (
                <View
                  accessibilityRole="summary"
                  accessibilityLabel={`Tip — make this your usual ${slot}`}
                  style={{
                    marginHorizontal: 12,
                    marginVertical: 6,
                    padding: 12,
                    borderRadius: Radius.md,
                    backgroundColor: Accent.primary + "08",
                    borderWidth: 1,
                    borderColor: Accent.primary + "30",
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: "700", color: textColor }}>
                    {/* 2026-04-26 polish (round 2): match the rendered
                        meal-slot pill casing — slot is already Title-cased
                        in PLANNER_MEAL_SLOT_LABELS. Drop the toLowerCase. */}
                    Make this your usual {slot}.
                  </Text>
                  <Text style={{ fontSize: 11, color: textTertiaryColor, marginTop: 2 }}>
                    One tap to re-log it tomorrow.
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
                    <Pressable
                      onPress={() => onAcceptUsualMealHint(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`Save ${slot} as a usual meal`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: Radius.sm,
                        backgroundColor: Accent.primary,
                      }}
                    >
                      <Bookmark size={12} color="#fff" />
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#fff" }}>
                        Save as usual
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDismissUsualMealHint(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`Dismiss usual-meal hint for ${slot}`}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "600", color: textSecondaryColor }}>
                        Not now
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* Ship M1 — full-width "Save {Slot} as a meal" row. */}
              {hasMeals && isOpen && showSaveRow && (
                <Pressable
                  onPress={() => onOpenSaveUsualMealForSlot(slot)}
                  accessibilityRole="button"
                  accessibilityLabel={`Save ${slot} as a usual meal — one tap to re-log next time`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    borderTopWidth: 1,
                    borderTopColor: cardBorderColor + "30",
                  }}
                >
                  <Bookmark size={14} color={Accent.primary} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: Accent.primary }}>
                    Save {slot} as a meal
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
        <Pressable style={{ padding: 12, alignItems: "center" }} onPress={() => onOpenFabForSlot("Snacks")}>
          <Text style={{ fontSize: 12, color: Accent.primary, fontWeight: "500" }}>+ Add Food</Text>
        </Pressable>
      </View>

      {/* Ship M1 — usual-meal picker for slots with 2+ matches.
          Audit P1 #12 (2026-04-30): show 3 by default + a "Show all"
          footer when there are more, instead of silently dropping
          options past index 3. */}
      <Modal
        visible={usualPicker != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setUsualPicker(null);
          setUsualPickerShowAll(false);
        }}
      >
        <Pressable
          onPress={() => {
            setUsualPicker(null);
            setUsualPickerShowAll(false);
          }}
          style={{ flex: 1, backgroundColor: "#00000066", justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: cardColor,
              borderTopLeftRadius: Radius.lg,
              borderTopRightRadius: Radius.lg,
              padding: Spacing.lg,
              paddingBottom: Spacing.xl,
              maxHeight: "80%",
            }}
          >
            <Text style={{ fontSize: 15, fontWeight: "700", color: textColor, marginBottom: 2 }}>
              {usualPicker ? `Log a usual ${usualPicker.slot}` : "Log a usual meal"}
            </Text>
            <Text style={{ fontSize: 12, color: textSecondaryColor, marginBottom: Spacing.md }}>
              Pick which saved meal to log. Newest logged first.
            </Text>
            {(() => {
              const allOptions = usualPicker?.options ?? [];
              const total = allOptions.length;
              const collapsedLimit = 3;
              const showCollapsed = total > 5 && !usualPickerShowAll;
              const visible = showCollapsed ? allOptions.slice(0, collapsedLimit) : allOptions;
              return (
                <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                  {visible.map((m) => {
                    const summary = summariseSavedMeal(m);
                    const itemsLabel =
                      summary.itemCount === 1 ? "1 item" : `${summary.itemCount} items`;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          if (usualPicker) {
                            onLogSavedMeal(m, usualPicker.slot);
                          }
                          setUsualPicker(null);
                          setUsualPickerShowAll(false);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`Log ${m.name} — ${itemsLabel}, ${summary.totalCalories} kcal`}
                        style={{
                          padding: Spacing.md,
                          borderRadius: Radius.lg,
                          borderWidth: 1,
                          borderColor: cardBorderColor,
                          marginBottom: Spacing.sm,
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: "700", color: textColor }} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: textSecondaryColor, marginTop: 2 }}>
                          {itemsLabel} · {formatMacroTrailer({
                            calories: summary.totalCalories,
                            protein: summary.totalProtein,
                            carbs: summary.totalCarbs,
                            fat: summary.totalFat,
                          })}
                        </Text>
                      </Pressable>
                    );
                  })}
                  {showCollapsed ? (
                    <Pressable
                      onPress={() => setUsualPickerShowAll(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Show all ${total} saved meals`}
                      style={{
                        paddingVertical: 10,
                        alignItems: "center",
                        marginBottom: Spacing.sm,
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: "600", color: Accent.primary }}>
                        {`Show all ${total} saved meals →`}
                      </Text>
                    </Pressable>
                  ) : null}
                </ScrollView>
              );
            })()}
            <Pressable
              onPress={() => {
                setUsualPicker(null);
                setUsualPickerShowAll(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={{
                paddingVertical: 10,
                alignItems: "center",
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: cardBorderColor,
                marginTop: Spacing.xs,
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: textColor }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

export default TodayMealsSection;
