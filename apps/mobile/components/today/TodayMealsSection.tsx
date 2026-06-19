import React, { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type PressableProps,
} from "react-native";
import ReAnimated, { FadeInDown } from "react-native-reanimated";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { buildMealShareText } from "@suppr/shared/share/buildMealShareText";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { useCalmMode } from "@/lib/calmMode";
import {
  Bookmark,
  CalendarPlus,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Zap,
  Coffee,
  Cookie,
  Copy,
  PencilLine,
  Plus,
  RefreshCw,
  Share2,
  Sun,
  Trash2,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Accent, Elevation, MacroColors, Radius, SlotColors, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { SHEET_RADIUS, SupprCard } from "@/components/ui/SupprCard";
import { SupprMark } from "@/components/SupprMark";
import { SourceDot } from "@/components/ui/SourceDot";
import { mapMealSourceToDot } from "@suppr/nutrition-core/sourceMap";
import { mealContributedFiberG } from "@/lib/healthDietaryNutrients";
import { formatMacroTrailer } from "@suppr/nutrition-core/macroFormat";
import type { JournalMeal } from "@/lib/nutritionJournal";
import type { SavedMeal } from "@suppr/nutrition-core/savedMeals";
import { summariseSavedMeal } from "@suppr/nutrition-core/savedMealsLogic";
import { AiFirstLogTooltip } from "./AiFirstLogTooltip";
import { mealRowImageUrl } from "@suppr/nutrition-core/foodHistory";
import { emptySlotAimKcal } from "@suppr/nutrition-core/mealSlotAim";
import { EmptyMealSlotAimLine } from "@/components/EmptyMealSlotRow";
import { MealRowSwipeable } from "./MealRowSwipeable";
import { PressableScale } from "@/components/ui/PressableScale";

type TodayMealRowPressableProps = PressableProps & {
  tierV1: boolean;
  children: ReactNode;
};

/** ENG-1099 M6 — meal rows use PressableScale when the tracker tier flag is on. */
function TodayMealRowPressable({
  tierV1,
  children,
  style,
  ...rest
}: TodayMealRowPressableProps) {
  if (tierV1) {
    return (
      <PressableScale haptic="selection" style={style} {...rest}>
        {children}
      </PressableScale>
    );
  }
  return (
    <Pressable style={style} {...rest}>
      {children}
    </Pressable>
  );
}

type TodayAddFoodPressableProps = PressableProps & {
  tierV1: boolean;
  children: ReactNode;
};

function TodayAddFoodPressable({
  tierV1,
  children,
  style,
  ...rest
}: TodayAddFoodPressableProps) {
  if (tierV1) {
    return (
      <PressableScale haptic="selection" style={style} {...rest}>
        {children}
      </PressableScale>
    );
  }
  return (
    <Pressable style={style} {...rest}>
      {children}
    </Pressable>
  );
}

function TodayLogUsualPressable({
  tierV1,
  children,
  style,
  ...rest
}: PressableProps & { tierV1: boolean; children: ReactNode }) {
  if (tierV1) {
    return (
      <PressableScale haptic="selection" style={style} {...rest}>
        {children}
      </PressableScale>
    );
  }
  return (
    <Pressable style={style} {...rest}>
      {children}
    </Pressable>
  );
}

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
  /** ENG-1092 — day calorie + fibre targets, so an empty slot can show
   *  "Aim ~X kcal" (redistributed across the still-empty slots). Optional:
   *  when absent (or <= 0) the aim line simply doesn't render. */
  effectiveCalorieTarget?: number;
  fiberTarget?: number;
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
  formatMealTimeDisplay: (
    time: string | undefined,
    createdAt?: string | null,
    eatenAt?: string | null,
  ) => string;
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
  /**
   * ENG-783 — when set (flag `today-edit-entry-v2` on), tapping a saved
   * meal (slot-header pill or usual-picker row) opens the portion editor
   * first instead of logging 1× instantly. Falls back to `onLogSavedMeal`
   * when undefined (flag off → instant one-tap log preserved).
   */
  onRequestPortion?: (meal: SavedMeal, slot: string) => void;
  /**
   * ENG-786 — when set (flag `today_log_again` on), a "Log this/these
   * again" row renders under each populated slot. Tapping it re-inserts
   * that slot's current entries as fresh entries on the viewed day, with
   * the same baked macros. Undefined (flag off) → no row, layout
   * byte-identical to pre-ENG-786.
   */
  onLogAgain?: (slot: string) => void;
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
  /**
   * ENG-594 — Quick add lives in the meals section header (not between
   * macro tiles and meals). Host passes collapsed state + panel body.
   */
  quickAddCollapsed?: boolean;
  onToggleQuickAddCollapsed?: () => void;
  quickAddPanel?: ReactNode;
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

// Plain helper — hooks are forbidden here (rules-of-hooks); the caller passes
// the scheme-resolved accent fallback from its own useAccent().
function slotColor(s: string, fallback: string): string {
  return SLOT_COLOR[s] ?? fallback;
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

/**
 * SlotMacroChips — per-meal coloured macro grams under the card's kcal,
 * matching the Sloe `TD4 · Meal log` frame (481:2 / `today-meallog.html`).
 *
 * The frame shows the slot's summed protein / carbs / fat / fibre as bare
 * coloured gram values (no icon, no "P/C/F" letter) in a tight row right
 * after the total kcal — e.g. `217 kcal  12g 20g 9g 0.6g` with each gram
 * value painted in its macro hue (`MacroColors.protein` #7C8466 olive-sage,
 * `MacroColors.carbs` #C8794E clay, `MacroColors.fat` #C9892C amber,
 * `MacroColors.fiber` #4A7878 teal).
 *
 * This replaces the icon-led `MacroIconRow` that the pre-TD4 slot header
 * used. `MacroIconRow` stays the canonical Library/Discover row; TD4's meal
 * cards use this calmer icon-free variant so the serif meal name stays the
 * loudest thing in the header. Fibre only renders when meaningfully > 0
 * (mirrors `MacroIconRow`). Values are summed by the host and rounded the
 * same way the day total + macro-detail screen round them.
 */
function SlotMacroChips({
  kcal,
  protein,
  carbs,
  fat,
  fiber,
  kcalColor,
}: {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  kcalColor: string;
}) {
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.xs }}
    >
      <Text
        style={{ ...Type.caption, color: kcalColor, fontVariant: ["tabular-nums"] }}
        accessibilityLabel={`${kcal} kcal`}
      >
        {kcal} kcal
      </Text>
      <Text style={{ ...Type.caption, color: MacroColors.proteinSolid, fontVariant: ["tabular-nums"] }}>
        {Math.round(protein)}g
      </Text>
      <Text style={{ ...Type.caption, color: MacroColors.carbsSolid, fontVariant: ["tabular-nums"] }}>
        {Math.round(carbs)}g
      </Text>
      <Text style={{ ...Type.caption, color: MacroColors.fatSolid, fontVariant: ["tabular-nums"] }}>
        {Math.round(fat)}g
      </Text>
      {Number.isFinite(fiber) && fiber > 0 ? (
        <Text style={{ ...Type.caption, color: MacroColors.fiberSolid, fontVariant: ["tabular-nums"] }}>
          {Math.round(fiber * 10) / 10}g
        </Text>
      ) : null}
    </View>
  );
}

/**
 * MealActionSheet — branded cream bottom sheet for the meal long-press
 * gesture (ENG-799, Redesign — Design Direction 2026, 2026-05-31).
 *
 * Replaces the raw `ActionSheetIOS` / `Alert.alert` that the long-press
 * used to fire — the single biggest stock-component tell in an otherwise
 * fully-custom cream world. Speaks the same sheet grammar as
 * `SavedMealPortionSheet` (cream `colors.background` surface, grabber,
 * blue commit accent, `Accent.destructive` for Delete) and shows what
 * the native sheet physically cannot: the meal thumbnail, name, and a
 * kcal · P/C/F macro preview. Matches the approved prototype at
 * `docs/prototypes/2026-05-31-design-direction/surface-meal-actionsheet.html`.
 *
 * Reachability is gated at the call site by the `redesign_branded_sheets`
 * flag — flag OFF keeps the native `Alert.alert` path alive, flag ON
 * opens this sheet. Pure presentation: the host owns each action handler.
 */
interface MealActionSheetProps {
  meal: JournalMeal | null;
  /** Macro preview line built by the host (`kcal · P/C/F`). */
  macroDetail: string;
  onEdit: (meal: JournalMeal) => void;
  onCopy: (mealId: string) => void;
  onShare: (meal: JournalMeal) => void;
  onDelete: (mealId: string) => void;
  onClose: () => void;
}

function MealActionRow({
  Glyph,
  label,
  sublabel,
  onPress,
  danger,
  testID,
  colors,
}: {
  Glyph: LucideIcon;
  label: string;
  sublabel: string;
  onPress: () => void;
  danger?: boolean;
  testID: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  // Scheme-resolved accent for the non-danger row glyph/tint. Danger keeps
  // `Accent.destructive` (status — never secondary).
  const themeAccent = useAccent();
  const accent = danger ? Accent.destructive : themeAccent.primary;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        mas.row,
        Elevation.card,
        {
          backgroundColor: danger ? Accent.destructive + "0F" : colors.card,
          borderColor: danger ? Accent.destructive + "26" : colors.border,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={[mas.rowIcon, { backgroundColor: accent + "1A" }]}>
        <Glyph size={17} color={accent} strokeWidth={2.1} />
      </View>
      <View style={mas.rowText}>
        <Text style={[Type.body, { fontWeight: "700", color: danger ? Accent.destructive : colors.text }]}>
          {label}
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary }]} numberOfLines={1}>
          {sublabel}
        </Text>
      </View>
      {!danger ? <ChevronRight size={16} color={colors.textTertiary} /> : null}
    </Pressable>
  );
}

function MealActionSheet({
  meal,
  macroDetail,
  onEdit,
  onCopy,
  onShare,
  onDelete,
  onClose,
}: MealActionSheetProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the thumbnail
  // fallback tint below.
  const accent = useAccent();
  const thumbUrl = meal ? mealRowImageUrl(meal) : undefined;
  const kcal = meal ? Math.round(meal.calories) : 0;

  return (
    <Modal visible={!!meal} transparent animationType="slide" onRequestClose={onClose}>
      <View style={mas.modalRoot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss meal actions"
          style={[StyleSheet.absoluteFill, mas.backdrop]}
          onPress={onClose}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel="Meal actions"
          testID="meal-action-sheet"
          style={[mas.sheet, Elevation.sheet, { backgroundColor: colors.background }]}
        >
          <View style={[mas.handle, { backgroundColor: colors.border }]} accessible={false} />

          {/* One quiet brand mark — ENG-797 (the most-used management
              surface no longer reads as borrowed OS chrome). */}
          <View style={mas.brandMark} pointerEvents="none">
            <SupprMark size={16} background="transparent" foreground={colors.textTertiary} />
          </View>

          {/* Header the native sheet cannot render: thumbnail + name + macro preview. */}
          <View style={[mas.header, { borderBottomColor: colors.border }]}>
            {thumbUrl ? (
              <Image
                source={{ uri: thumbUrl }}
                style={mas.thumb}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <View style={[mas.thumb, mas.thumbFallback, { backgroundColor: accent.primary + "14" }]}>
                <UtensilsCrossed size={22} color={accent.primary} />
              </View>
            )}
            <View style={mas.headerMeta}>
              <Text style={[Type.headline, { color: colors.text }]} numberOfLines={2}>
                {meal?.recipeTitle ?? "Meal"}
              </Text>
              <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4 }]} numberOfLines={1}>
                {macroDetail}
              </Text>
            </View>
          </View>

          <View style={mas.list}>
            <MealActionRow
              Glyph={PencilLine}
              label="Edit entry"
              sublabel="Portion, meal slot & macros"
              onPress={() => meal && onEdit(meal)}
              testID="meal-action-edit"
              colors={colors}
            />
            <MealActionRow
              Glyph={CalendarPlus}
              label="Copy to another day"
              sublabel="Re-log this on any date"
              onPress={() => meal && onCopy(meal.id)}
              testID="meal-action-copy"
              colors={colors}
            />
            <MealActionRow
              Glyph={Share2}
              label="Share meal"
              sublabel="Send as a Sloe recipe card"
              onPress={() => meal && onShare(meal)}
              testID="meal-action-share"
              colors={colors}
            />
            <MealActionRow
              Glyph={Trash2}
              label="Delete entry"
              sublabel={`Removes ${kcal} kcal from today`}
              onPress={() => meal && onDelete(meal.id)}
              danger
              testID="meal-action-delete"
              colors={colors}
            />
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            testID="meal-action-cancel"
            style={mas.cancel}
          >
            <Text style={[Type.body, { fontWeight: "700", color: colors.textSecondary }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// Prototype-matched sheet metrics (ENG-799). The `borderRadius` /
// `gap` values below intentionally sit between the tightened `Radius`
// ladder steps (the prototype's 24px sheet corner, 14px row, 11px icon
// chip) — they are sourced from the approved surface prototype, not
// arbitrary. Spacing maps to `Spacing.*` tokens where a clean step exists.
const mas = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { backgroundColor: "rgba(20,18,24,0.4)" },
  sheet: {
    // Prototype sheet corner (24px) — above the tightened Radius.xl (12).
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  handle: {
    width: 38,
    height: 5,
    borderRadius: Radius.sm,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  brandMark: { position: "absolute", top: Spacing.md, right: Spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.sm,
  },
  // eslint-disable-next-line no-restricted-syntax -- prototype thumbnail radius (14px)
  thumb: { width: 52, height: 52, borderRadius: 14, flexShrink: 0 },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  headerMeta: { flex: 1, minWidth: 0 },
  list: { paddingTop: Spacing.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    // eslint-disable-next-line no-restricted-syntax -- prototype action-row radius (14px)
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rowIcon: {
    width: 34,
    height: 34,
    // eslint-disable-next-line no-restricted-syntax -- prototype icon-chip radius (11px)
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rowText: { flex: 1, minWidth: 0, gap: Spacing.xs },
  cancel: { alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, marginTop: Spacing.xs },
});

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
    effectiveCalorieTarget,
    fiberTarget,
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
    onRequestPortion,
    onLogAgain,
    hintVisibleForSlot,
    onDismissUsualMealHint,
    onAcceptUsualMealHint,
    aiFirstLogTooltipMealId,
    onDismissAiFirstLogTooltip,
    quickAddCollapsed,
    onToggleQuickAddCollapsed,
    quickAddPanel,
  } = props;

  // 2026-05-23 (Grace): "usuals etc can just be in the logging section"
  // — the collapsible "Your usuals" header + Duplicate-day pill above
  // the slots were reading as clutter. The same content is reachable
  // via the central + log sheet (QuickAddPanel) and via Plan-tab day
  // operations, so hide both surfaces on Today's main scroll. Props
  // stay wired so a future "logging section" surface can pick them up.
  const showQuickAdd = false;
  const showDuplicateDayInline = false;

  // 2026-05-22 evening (Grace): per-session dismissed "Log usual"
  // pills. Tap the X on a pill → hides for this slot until next app
  // launch. No persistence yet — escalate to AsyncStorage if Grace
  // wants permanent dismissal.
  const [dismissedUsualFor, setDismissedUsualFor] = useState<Set<string>>(
    () => new Set(),
  );
  const dismissUsualFor = (slot: string) =>
    setDismissedUsualFor((prev) => {
      if (prev.has(slot)) return prev;
      const next = new Set(prev);
      next.add(slot);
      return next;
    });
  const [usualPicker, setUsualPicker] = useState<
    { slot: string; options: SavedMeal[] } | null
  >(null);
  const [usualPickerShowAll, setUsualPickerShowAll] = useState(false);
  // Secondary accent (Frost flag → damson, else clay) for the in-slot
  // "Add food" CTA below. The macro/slot tints + plum chrome are NOT
  // secondary-accent and keep their own `MacroColors`/`SlotColors` imports.
  const accent = useAccent();
  const colors = useThemeColors();

  // ENG-1092 "Purposeful empties" — empty slots show "Aim ~X kcal" + render at
  // full opacity. `consumedBySlot` (from the full mealGroups) feeds the shared
  // redistributing helper, so a partial day's aims shrink honestly. Gated on
  // `plan_today_aim_empty_v1`; off → the bare-name empty + the 0.55 dim.
  const aimEmptyOn = isFeatureEnabled("plan_today_aim_empty_v1");
  // ENG-1098 "Calm mode" — quiet the per-slot aim numbers (the empty slot still
  // renders at full opacity; only the "Aim ~X kcal" line is hidden). Shared key
  // with web.
  const [calmMode] = useCalmMode();
  const tierV1 = isFeatureEnabled("today_tracker_tier_v1");
  const consumedBySlot = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of slots) {
      map[s] = (mealGroups[s] ?? []).reduce((a, m) => a + m.calories, 0);
    }
    return map;
  }, [slots, mealGroups]);

  // 2026-05-15 (crowder task) — flag-gated header relayout. When ON, the
  // `Log usual: <name>` chip moves out of the section-header trailing
  // cluster into a dedicated row directly under the header. The header
  // was overflowing on narrow widths with a long saved-meal name
  // (`Snacks` truncated to `S`, item-count digit overlapping the
  // chevron). See `docs/decisions/2026-05-15-today-log-usual-row-v2.md`.
  // Off-branch preserves the prior in-header chip verbatim.
  const usualRowV2 = isFeatureEnabled("today_log_usual_row_v2");

  // ENG-799 (Redesign — Design Direction 2026, 2026-05-31) — the meal
  // long-press gesture. Flag ON → open the branded `MealActionSheet`
  // (cream surface, grabber, thumbnail + macro header, blue accent rows,
  // red Delete). Flag OFF → the prior raw `Alert.alert` path stays alive
  // verbatim. State holds the meal whose row was long-pressed.
  const brandedSheets = isFeatureEnabled("redesign_branded_sheets");
  const [actionSheetMeal, setActionSheetMeal] = useState<JournalMeal | null>(null);

  // Shared "Share meal" handler used by BOTH the native Alert path and
  // the branded sheet so the share-text + analytics stay identical.
  const shareMeal = async (m: JournalMeal) => {
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
  };

  const handleMealLongPress = (m: JournalMeal) => {
    if (brandedSheets) {
      void Haptics.selectionAsync();
      setActionSheetMeal(m);
      return;
    }
    Alert.alert(m.recipeTitle, formatMealMacroDetail(m), [
      { text: "Cancel", style: "cancel" },
      { text: "Edit", onPress: () => onLongPressEdit(m) },
      { text: "Copy to another day", onPress: () => onRequestCopyMeal(m.id) },
      {
        text: "Share meal",
        onPress: () => {
          void shareMeal(m);
        },
      },
      { text: "Delete", style: "destructive", onPress: () => onDeleteMeal(m.id) },
    ]);
  };

  // NOTE — NO "Today's Meals" section title (deliberate, not an oversight).
  // The Sloe `_buildtoday.mjs mealsSection` prototype shows a Title-case
  // "Today's Meals" header, but that exact string is on the locked
  // FORBIDDEN_TODAY_PHRASES list (`src/lib/copy/today.ts`) and is enforced
  // across mobile + web by `tests/unit/todayCopyParity.test.ts`. The locked
  // convention (rooted in landing-screenshot parity + the calm-tone audit)
  // is **per-slot headers only** — Breakfast / Lunch / Dinner / Snacks (each
  // already a Newsreader Sloe header on the slot cards below), never a single
  // generic title. The prototype is a reference, not a mandate; where it
  // collides with a locked product decision, the decision wins. Reconciling
  // the two (retire the rule vs. drop the prototype title) is a Grace call —
  // flagged in the handoff, not silently resolved here.
  return (
    <View>
      {/* Sloe TD4 · Meal log (Figma 481:2 / today-meallog.html) — the meals
          list re-skin (Today re-skin unit 2, 2026-06-03). The pre-TD4 layout
          was ONE outer card containing every slot, divided by hairlines. TD4
          makes each slot its OWN card (warm-grey `card` surface, `line`
          hairline border, rounded), so the slots read as four discrete
          objects you can scan + act on independently — the MyFitnessPal /
          Lifesum grammar the dossier benchmarks. The optional `Your usuals`
          quick-add panel + `Duplicate day` row (both gated OFF on Today's
          main scroll since 2026-05-23, props kept wired) keep their own
          wrapper card above the slot cards so a future "logging section" can
          still surface them. */}
      {(showQuickAdd || (mealsTodayCount > 0 && showDuplicateDayInline)) && (
        // Card chrome is the shared <SupprCard> shell (fill, radius, soft lift on
        // an outer wrapper, corner-clip — the iOS clip fix lives in the shell, so
        // this wrapper can never re-introduce it). Gated OFF on Today's main
        // scroll today (props kept wired for a future "logging section"). Sits on
        // the Today scroll ground → soft lift (one-treatment, Grace 2026-06-09).
        <SupprCard lift={tierV1 ? "flat" : "soft"} padding="none" style={{ marginBottom: Spacing.xs }}>
          {showQuickAdd && (
            <View
              style={{
                // Sloe: hairline `divide-y divide-line`, not a 1pt (3px) rule.
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: cardBorderColor + "60",
              }}
            >
              <Pressable
                onPress={onToggleQuickAddCollapsed}
                accessibilityRole="button"
                accessibilityLabel={quickAddCollapsed ? "Show quick add" : "Hide quick add"}
                accessibilityState={{ expanded: !quickAddCollapsed }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingVertical: Spacing.sm,
                  paddingHorizontal: Spacing.md,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                  <Zap size={16} color={textSecondaryColor} strokeWidth={1.75} />
                  {/* Canonical 2026-05-22 D3: header simplified from
                      "Quick add" + "Your usuals" (two phrases doing one
                      job) to just "Your usuals". The Zap glyph + the
                      section's tab strip below already communicate
                      "quick add"; the explicit feature naming was
                      redundant chrome. */}
                  <Text style={{ ...Type.body, color: textSecondaryColor }}>
                    Your usuals
                  </Text>
                </View>
                {quickAddCollapsed ? (
                  <ChevronDown size={16} color={textTertiaryColor} strokeWidth={2} />
                ) : (
                  <ChevronUp size={16} color={textTertiaryColor} strokeWidth={2} />
                )}
              </Pressable>
              {!quickAddCollapsed ? (
                <View style={{ paddingHorizontal: Spacing.dense, paddingBottom: Spacing.sm }}>{quickAddPanel}</View>
              ) : null}
            </View>
          )}
          {mealsTodayCount > 0 && showDuplicateDayInline && (
            <View
              style={{
                flexDirection: "row",
                justifyContent: "flex-end",
                paddingHorizontal: Spacing.dense,
                paddingTop: Spacing.sm,
                paddingBottom: Spacing.sm,
              }}
            >
              <Pressable
                onPress={onOpenDuplicateDay}
                accessibilityRole="button"
                accessibilityLabel="Duplicate this day to another day"
                hitSlop={8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Copy size={11} color={textSecondaryColor} />
                <Text style={{ ...Type.caption, color: textSecondaryColor }}>Duplicate day</Text>
              </Pressable>
            </View>
          )}
        </SupprCard>
      )}
      {slots.map((slot, slotIndex) => {
          const meals = mealGroups[slot] ?? [];
          const slotCals = Math.round(meals.reduce((a, m) => a + m.calories, 0));
          // 2026-05-22 — slot-total macro icon row (Grace ask: "macro
          // strip needs to match the discover tiles with the little
          // icons, next to the icon and meal name"). Sum across all
          // logged items in this slot for the four canonical macros.
          const slotProtein = meals.reduce((a, m) => a + (m.protein ?? 0), 0);
          const slotCarbs   = meals.reduce((a, m) => a + (m.carbs ?? 0), 0);
          const slotFat     = meals.reduce((a, m) => a + (m.fat ?? 0), 0);
          // Fibre can live in `fiber_g` OR `nutrition_micros` (Health /
          // dense logs). Mirror the day-total + macro-detail screen by
          // resolving via mealContributedFiberG so the slot chip doesn't
          // drop micros-only fibre (e.g. breakfast showed 0g while the
          // Fibre detail + day tile counted it). 2026-05-25.
          const slotFiber   = meals.reduce((a, m) => a + mealContributedFiberG(m), 0);
          const isOpen = !collapsedSlots.has(slot);
          const hasMeals = meals.length > 0;
          const ic = slotIcon(slot);
          const col = slotColor(slot, accent.primary);
          const slotSaved = savedMealsForSlot(savedMeals, slot);
          const hasSaved = slotSaved.length > 0;
          const showSaveRow = meals.length >= 2 && !hasSaved;
          const showHint = !hasSaved && meals.length >= 1 && hintVisibleForSlot(slot);
          const primarySaved = slotSaved[0];
          const extraSavedCount = slotSaved.length - 1;
          return (
            <ReAnimated.View
              key={slot}
              entering={FadeInDown.delay(slotIndex * 50).duration(350)}
              testID={`today-slot-${slot}`}
              style={{
                // TD4 — each slot is its own card. The card CHROME (white fill,
                // radius, FLAT post flat-card surfaces 2026-06-12 — no lift) is the
                // shared <SupprCard> shell below — no more hand-rolled per-slot
                // chrome (Grace 2026-06-04). This animated wrapper only carries the
                // entering animation, the bottom gap, and the empty-slot dim.
                // F-160 (TF57): with the lift retired the cards no longer need air
                // to separate them — the gap tightens to the pre-inversion rhythm
                // (`Spacing.sm` 8, was `Spacing.dense` 12) so the four slots read as
                // a tight grouped block, not floating slabs.
                marginBottom: Spacing.sm,
                // ENG-1092: empty slots read at full opacity once they carry an
                // "Aim ~X kcal" purpose line (matches web); the 0.55 dim made
                // empties look disabled. Flag-off keeps the legacy dim.
                opacity: hasMeals || aimEmptyOn ? 1 : 0.55,
              }}
            >
              {/* Per-slot card sits on the Today scroll ground → soft lift (one-treatment, Grace 2026-06-09). */}
              <SupprCard lift={tierV1 ? "flat" : "soft"} padding="none">
              <View
                testID={`today-slot-header-${slot}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: hasMeals && isOpen ? StyleSheet.hairlineWidth : 0,
                  borderBottomColor: cardBorderColor,
                  // F-160 (TF57): pre-inversion header density — vertical pad +
                  // horizontal pad both snap to `Spacing.dense` (12). The redesign
                  // had ballooned the horizontal pad to `Spacing.md` (16); the
                  // pre-inversion header sat at 12/14 and read tighter. Also drop
                  // the 1pt rule to a hairline (matches the food-row dividers).
                  paddingVertical: Spacing.dense,
                  paddingHorizontal: Spacing.dense,
                  gap: Spacing.sm,
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
                    // F-160 (TF57): icon↔title gap back to the pre-inversion
                    // `Spacing.sm` (8) — the redesign widened it to `Spacing.dense`
                    // (12), pushing the serif title off the left edge.
                    gap: Spacing.sm,
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
                      // Slot icon chip — per-slot tint (dossier D-4: slots stay
                      // distinguishable by hue + icon + position). F-160 (TF57):
                      // back to the pre-inversion 32pt chip (was 36) so the header
                      // row is shorter and the four slots stack tighter; radius
                      // stays `Radius.lg` (8) on-scale.
                      width: 32,
                      height: 32,
                      borderRadius: Radius.lg,
                      backgroundColor: tierV1 ? col + "12" : col + "18",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <SlotIcon Glyph={ic} size={16} color={col} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    {/* TD4 — meal name reads in Newsreader (`Type.headline`),
                        the loudest thing in the card header. `numberOfLines={1}`
                        + `minWidth: 0` on this column keep it from being crowded
                        by the chevron / right cluster (F-80 history). */}
                    <Text
                      style={{ ...Type.headline, color: textColor }}
                      numberOfLines={1}
                    >
                      {slot}
                    </Text>
                    {hasMeals ? (
                      // TD4 — slot total kcal + per-meal coloured macro grams
                      // (P/C/F/fibre) under the name, icon-free (the calm meal-
                      // card variant). Replaces the icon-led MacroIconRow the
                      // pre-TD4 header used. Same summed values, same rounding.
                      <SlotMacroChips
                        kcal={slotCals}
                        protein={slotProtein}
                        carbs={slotCarbs}
                        fat={slotFat}
                        fiber={slotFiber}
                        kcalColor={textSecondaryColor}
                      />
                    ) : aimEmptyOn &&
                      !calmMode &&
                      effectiveCalorieTarget != null &&
                      (() => {
                        // ENG-1092 — empty slot purpose line. Occupies the exact
                        // spot SlotMacroChips fills on a populated card, so empty
                        // and full cards share one rhythm. `null` (day at/over
                        // budget) → no line, never "Aim ~0 kcal".
                        const aim = emptySlotAimKcal(
                          slot,
                          effectiveCalorieTarget,
                          fiberTarget ?? 0,
                          consumedBySlot,
                        );
                        return aim == null ? null : (
                          <EmptyMealSlotAimLine
                            slot={slot}
                            aimKcal={aim}
                            surface="today"
                            color={textSecondaryColor}
                          />
                        );
                      })()}
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
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexShrink: 0 }}>
                    {/* 2026-05-22 evening (Grace): "+" pill removed
                        from populated slot headers. TD4 (2026-06-03)
                        restored an in-card "+ Add food" action in the
                        card body below the rows; the kcal + macro grams
                        live in the `SlotMacroChips` row under the meal
                        name. The empty-state Plus (the `: (` branch
                        below) stays since empty cards have no body. */}
                    {/* Ship M1 — `Log usual: {name}` pill. 2+ matches open
                        the picker modal; 1 match logs on tap.
                        2026-05-15 (crowder task) — when `usualRowV2` is
                        ON, the chip moves to a dedicated row below the
                        header (rendered after this header View). */}
                    {!usualRowV2 && mealsTodayCount > 0 && hasSaved && primarySaved && !dismissedUsualFor.has(slot) && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          paddingHorizontal: Spacing.dense,
                          paddingVertical: 4,
                          borderRadius: Radius.full,
                          backgroundColor: tierV1 ? colors.fillQuiet : col + "18",
                          borderWidth: tierV1 ? 0 : 1,
                          borderColor: tierV1 ? undefined : col + "30",
                          maxWidth: 180,
                          flexShrink: 1,
                        }}
                      >
                        <TodayLogUsualPressable
                          tierV1={tierV1}
                          testID={`today-log-usual-pill-in-header-${slot}`}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            if (slotSaved.length >= 2) {
                              setUsualPicker({ slot, options: slotSaved });
                            } else {
                              // ENG-783 — flag on: tap opens portion editor.
                              (onRequestPortion ?? onLogSavedMeal)(primarySaved, slot);
                            }
                          }}
                          hitSlop={6}
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
                            flexShrink: 1,
                          }}
                        >
                          <RefreshCw size={11} color={textSecondaryColor} />
                          <Text
                            style={{ ...Type.caption, color: textSecondaryColor, maxWidth: 120 }}
                            numberOfLines={1}
                          >
                            {extraSavedCount > 0 ? "Log usual…" : `Log usual: ${primarySaved.name}`}
                          </Text>
                        </TodayLogUsualPressable>
                        {/* Dismiss X — per-session hide. Grace 2026-05-22. */}
                        <Pressable
                          testID={`today-log-usual-dismiss-in-header-${slot}`}
                          onPress={(e) => {
                            e.stopPropagation?.();
                            dismissUsualFor(slot);
                          }}
                          hitSlop={8}
                          accessibilityRole="button"
                          accessibilityLabel={`Dismiss Log usual suggestion for ${slot}`}
                          style={{ paddingHorizontal: 2 }}
                        >
                          <X size={11} color={textSecondaryColor} strokeWidth={2.25} />
                        </Pressable>
                      </View>
                    )}
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
              {usualRowV2 && mealsTodayCount > 0 && hasSaved && primarySaved && !dismissedUsualFor.has(slot) && (
                <View
                  testID={`today-log-usual-row-${slot}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    // TD4 — Log-usual pill sits at the card's content edge,
                    // left-aligned with the food rows below (the Sloe frame
                    // places it first in the card body, not indented under the
                    // icon). Was `paddingLeft: 56` (pre-TD4 single-card indent).
                    paddingTop: Spacing.dense,
                    paddingBottom: 4,
                    paddingLeft: Spacing.md,
                    paddingRight: Spacing.md,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: Spacing.sm,
                      paddingHorizontal: Spacing.dense,
                      paddingVertical: Spacing.sm,
                      borderRadius: Radius.full,
                      backgroundColor: tierV1 ? colors.fillQuiet : col + "18",
                      borderWidth: tierV1 ? 0 : 1,
                      borderColor: tierV1 ? undefined : col + "30",
                      maxWidth: "100%",
                      flexShrink: 1,
                    }}
                  >
                    <TodayLogUsualPressable
                      tierV1={tierV1}
                      testID={`today-log-usual-pill-${slot}`}
                      onPress={() => {
                        if (slotSaved.length >= 2) {
                          setUsualPicker({ slot, options: slotSaved });
                        } else {
                          // ENG-783 — flag on: tap opens portion editor.
                          (onRequestPortion ?? onLogSavedMeal)(primarySaved, slot);
                        }
                      }}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={
                        slotSaved.length >= 2
                          ? `Log a usual ${slot} — choose from ${slotSaved.length} saved meals`
                          : `Log usual ${slot}: ${primarySaved.name}`
                      }
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: Spacing.xs,
                        flexShrink: 1,
                      }}
                    >
                      <RefreshCw size={12} color={textSecondaryColor} />
                      <Text
                        style={{ ...Type.caption, color: textSecondaryColor, flexShrink: 1 }}
                        numberOfLines={1}
                      >
                        {extraSavedCount > 0
                          ? `Log usual ${slot}…`
                          : `Log usual: ${primarySaved.name}`}
                      </Text>
                    </TodayLogUsualPressable>
                    {/* Dismiss X — per-session hide. */}
                    <Pressable
                      testID={`today-log-usual-dismiss-${slot}`}
                      onPress={() => dismissUsualFor(slot)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Dismiss Log usual suggestion for ${slot}`}
                      style={{ paddingHorizontal: 2 }}
                    >
                      <X size={12} color={textSecondaryColor} strokeWidth={2.25} />
                    </Pressable>
                  </View>
                </View>
              )}
              {hasMeals &&
                isOpen &&
                meals.map((m) => (
                  <React.Fragment key={m.id}>
                  <MealRowSwipeable mealId={m.id} onDeleteMeal={onDeleteMeal}>
                    <TodayMealRowPressable
                      tierV1={tierV1}
                      onPress={() => onPressMeal(m.id)}
                      onLongPress={() => {
                        if (brandedSheets) {
                          // ENG-799 — flag ON: branded cream action sheet.
                          void Haptics.selectionAsync();
                          setActionSheetMeal(m);
                          return;
                        }
                        // Flag OFF — prior raw iOS Alert path, kept alive verbatim.
                        Alert.alert(m.recipeTitle, formatMealMacroDetail(m), [
                          { text: "Cancel", style: "cancel" },
                          { text: "Edit", onPress: () => onLongPressEdit(m) },
                          { text: "Copy to another day", onPress: () => onRequestCopyMeal(m.id) },
                          {
                            text: "Share meal",
                            onPress: () => {
                              void shareMeal(m);
                            },
                          },
                          { text: "Delete", style: "destructive", onPress: () => onDeleteMeal(m.id) },
                        ]);
                      }}
                      style={{
                        paddingVertical: Spacing.sm,
                        paddingLeft: Spacing.md,
                        paddingRight: Spacing.md,
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                        // Sloe: hairline `divide-y divide-line` between meal rows.
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: cardBorderColor + "08",
                        backgroundColor: cardColor,
                      }}
                    >
                      <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                        {(() => {
                          const thumbUrl = mealRowImageUrl(m);
                          if (thumbUrl) {
                            return (
                              <View
                                style={{
                                  width: 40,
                                  height: 40,
                                  borderRadius: 8,
                                  overflow: "hidden",
                                  flexShrink: 0,
                                }}
                              >
                                <Image
                                  source={{ uri: thumbUrl }}
                                  style={{ width: 40, height: 40 }}
                                  accessibilityIgnoresInvertColors
                                />
                              </View>
                            );
                          }
                          return (
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: Accent.success, flexShrink: 0 }} />
                          );
                        })()}
                        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                          {/* 2026-05-15 (crowder task) — `flexShrink: 1`
                              + `minWidth: 0` so `numberOfLines: 1`
                              actually ellipsises. Without these, the
                              Text kept its full intrinsic width and
                              ran underneath the right-column kcal
                              value (e.g. "PB2 · Original Powdered
                              Peanut Butter (2 tbsp)" overlapped "60"
                              kcal). RN row children default to
                              `flexShrink: 0`.
                              TD4 (2026-06-03) — food name reads at `Type.body`
                              (14pt) to match the Sloe frame's `text-[14px]`
                              row; it's the primary content of the row now that
                              each slot is its own card. */}
                          <Text
                            style={{ ...Type.body, fontWeight: "400", color: textColor, flexShrink: 1, minWidth: 0 }}
                            numberOfLines={1}
                          >
                            {m.recipeTitle}
                          </Text>
                        </View>
                        {showMealTimestamps
                          ? (() => {
                              const ts = formatMealTimeDisplay(m.time, m.createdAt, m.eatenAt);
                              return ts ? (
                                <Text style={{ ...Type.caption, color: textTertiaryColor, marginLeft: Spacing.dense }}>{ts}</Text>
                              ) : null;
                            })()
                          : null}
                        {/* 2026-05-22 evening (Grace): per-meal source
                            badge ("Manual" / "FatSecret") and inline
                            macro strip both removed — they were eating
                            too much vertical real estate on the meal
                            row. Source provenance + full macros live on
                            the meal detail page (chevron right). The
                            chevron + kcal on the right side make the
                            tap affordance obvious. */}
                      </View>
                      </View>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={{ ...Type.caption, color: textSecondaryColor, fontVariant: ["tabular-nums"] }}>
                          {Math.round(m.calories)}
                        </Text>
                        <Text style={{ fontSize: 10, color: textTertiaryColor, marginLeft: -2 }}>kcal</Text>
                        <ChevronRight size={12} color={textTertiaryColor} />
                      </View>
                    </TodayMealRowPressable>
                  </MealRowSwipeable>
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
                    marginHorizontal: Spacing.dense,
                    marginVertical: Spacing.sm,
                    padding: Spacing.dense,
                    borderRadius: Radius.md,
                    backgroundColor: col + "0C",
                    borderWidth: 1,
                    borderColor: col + "28",
                  }}
                >
                  <Text style={{ ...Type.body, color: textColor }}>
                    {/* 2026-04-26 polish (round 2): match the rendered
                        meal-slot pill casing — slot is already Title-cased
                        in PLANNER_MEAL_SLOT_LABELS. Drop the toLowerCase. */}
                    Make this your usual {slot}.
                  </Text>
                  <Text style={{ ...Type.caption, color: textTertiaryColor, marginTop: 2 }}>
                    One tap to re-log it tomorrow.
                  </Text>
                  <View style={{ flexDirection: "row", gap: Spacing.sm, marginTop: 8 }}>
                    <Pressable
                      onPress={() => onAcceptUsualMealHint(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`Save ${slot} as a usual meal`}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                        paddingHorizontal: Spacing.dense,
                        paddingVertical: Spacing.sm,
                        borderRadius: Radius.sm,
                        backgroundColor: col,
                      }}
                    >
                      <Bookmark size={12} color={colors.primaryForeground} />
                      <Text style={{ ...Type.caption, color: colors.primaryForeground }}>
                        Save as usual
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onDismissUsualMealHint(slot)}
                      accessibilityRole="button"
                      accessibilityLabel={`Dismiss usual-meal hint for ${slot}`}
                      style={{
                        paddingHorizontal: Spacing.dense,
                        paddingVertical: Spacing.sm,
                      }}
                    >
                      <Text style={{ ...Type.caption, color: textSecondaryColor }}>
                        Not now
                      </Text>
                    </Pressable>
                  </View>
                </View>
              )}

              {/* ENG-786 — full-width "Log this/these again" row. Re-logs
                  the slot's current entries as fresh entries on the viewed
                  day (baked macros preserved). Sits above the Save-as-usual
                  row: repeat-now is the action Grace asked for; saving a
                  durable template is the quieter secondary. Flag
                  `today_log_again` gates the prop at the host. */}
              {hasMeals && isOpen && onLogAgain && (
                <Pressable
                  testID={`today-log-again-${slot}`}
                  onPress={() => onLogAgain(slot)}
                  accessibilityRole="button"
                  accessibilityLabel={`Log ${slot} again — re-add ${
                    meals.length > 1 ? "these items" : "this item"
                  } to the day`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: Spacing.sm,
                    paddingVertical: Spacing.dense,
                    paddingHorizontal: Spacing.md,
                    // Sloe: hairline divider above the action row.
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: cardBorderColor + "30",
                  }}
                >
                  <RefreshCw size={14} color={col} />
                  <Text style={{ ...Type.body, color: textColor }}>
                    {meals.length > 1 ? "Log these again" : "Log this again"}
                  </Text>
                </Pressable>
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
                    gap: Spacing.sm,
                    paddingVertical: Spacing.dense,
                    paddingHorizontal: Spacing.md,
                    // Sloe: hairline divider above the action row.
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: cardBorderColor + "30",
                  }}
                >
                  <Bookmark size={14} color={textSecondaryColor} />
                  <Text style={{ ...Type.body, color: textSecondaryColor }}>
                    Save {slot} as a meal
                  </Text>
                </Pressable>
              )}

              {/* Per-card "Add food" action — adds to a populated slot in
                  one tap (routes through the SAME `onOpenFabForSlot(slot)` the
                  empty-slot header tap fires; no new data path). Empty slots
                  keep their header-as-tap-target (no body), so this only renders
                  when the card is open with items.

                  F-160 / flat-card surfaces (2026-06-12 decision — the FIRST
                  quiet-fill adoption): with the card now FLAT, a bare text link
                  reads as floating. The nested affordance sits on the new
                  quiet-fill token (`colors.fillQuiet` — Withings grammar) inside
                  a contained pill — no second white card, no border. Clay deep
                  `primarySolid` keeps AA on the quiet fill. A wrapper carries the
                  card-edge inset so the pill doesn't run to the card corners. */}
              {hasMeals && isOpen && (
                <View
                  style={{
                    paddingHorizontal: Spacing.dense,
                    paddingTop: Spacing.sm,
                    paddingBottom: Spacing.dense,
                  }}
                >
                  <TodayAddFoodPressable
                    tierV1={tierV1}
                    testID={`today-add-food-${slot}`}
                    onPress={() => onOpenFabForSlot(slot)}
                    accessibilityRole="button"
                    accessibilityLabel={`Add food to ${slot}`}
                    hitSlop={6}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: Spacing.sm,
                      paddingVertical: Spacing.sm,
                      paddingHorizontal: Spacing.dense,
                      borderRadius: Radius.lg,
                      backgroundColor: colors.fillQuiet,
                    }}
                  >
                    <Plus size={15} color={accent.primarySolid} strokeWidth={2.25} />
                    <Text style={{ ...Type.body, color: accent.primarySolid }}>
                      Add food
                    </Text>
                  </TodayAddFoodPressable>
                </View>
              )}
              </SupprCard>
            </ReAnimated.View>
          );
      })}

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
          style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: cardColor,
              borderTopLeftRadius: SHEET_RADIUS,
              borderTopRightRadius: SHEET_RADIUS,
              padding: Spacing.lg,
              paddingBottom: Spacing.xl,
              maxHeight: "80%",
            }}
          >
            <Text style={{ ...Type.headline, color: textColor, marginBottom: 2 }}>
              {usualPicker ? `Log a usual ${usualPicker.slot}` : "Log a usual meal"}
            </Text>
            <Text style={{ ...Type.caption, color: textSecondaryColor, marginBottom: Spacing.md }}>
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
                          // ENG-783 — capture the slot, close the picker,
                          // THEN open the portion editor (flag on) or log
                          // instantly (flag off). Closing first avoids
                          // modal-over-modal stacking on iOS.
                          const pickedSlot = usualPicker?.slot;
                          setUsualPicker(null);
                          setUsualPickerShowAll(false);
                          if (pickedSlot) {
                            (onRequestPortion ?? onLogSavedMeal)(m, pickedSlot);
                          }
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
                        <Text style={{ ...Type.body, color: textColor }} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Text style={{ ...Type.caption, color: textSecondaryColor, marginTop: 2 }}>
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
                        paddingVertical: Spacing.dense,
                        alignItems: "center",
                        marginBottom: Spacing.sm,
                      }}
                    >
                      <Text style={{ ...Type.body, color: textSecondaryColor }}>
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
                paddingVertical: Spacing.dense,
                alignItems: "center",
                borderRadius: Radius.md,
                borderWidth: 1,
                borderColor: cardBorderColor,
                marginTop: Spacing.xs,
              }}
            >
              <Text style={{ ...Type.body, color: textColor }}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ENG-799 — branded meal action sheet (flag `redesign_branded_sheets`
          ON). Renders only when a meal row was long-pressed in the branded
          path; `actionSheetMeal` stays null in the flag-off Alert path so
          this is an inert no-op there. Each action closes the sheet first,
          then defers to the host handler (avoids modal-over-modal stacking
          on iOS when Edit opens the edit-entry sheet). */}
      <MealActionSheet
        meal={actionSheetMeal}
        macroDetail={actionSheetMeal ? formatMacroTrailer({
          calories: actionSheetMeal.calories,
          protein: actionSheetMeal.protein,
          carbs: actionSheetMeal.carbs,
          fat: actionSheetMeal.fat,
        }) : ""}
        onEdit={(m) => {
          setActionSheetMeal(null);
          onLongPressEdit(m);
        }}
        onCopy={(id) => {
          setActionSheetMeal(null);
          onRequestCopyMeal(id);
        }}
        onShare={(m) => {
          setActionSheetMeal(null);
          void shareMeal(m);
        }}
        onDelete={(id) => {
          setActionSheetMeal(null);
          onDeleteMeal(id);
        }}
        onClose={() => setActionSheetMeal(null)}
      />
    </View>
  );
}

export default TodayMealsSection;
