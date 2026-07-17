import { memo } from "react";
import * as React from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  BookmarkCheck,
  ChevronRight,
  Clock,
  Copy,
  History,
  ScanBarcode,
  Search,
  X,
} from "lucide-react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { BrowseRow, LibraryRow } from "./LogSheetRows";
import { SupprButton } from "@/components/ui/SupprButton";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";

import { Elevation, IconSize, MacroColors, MacroColorsDark, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent, useResolvedScheme } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useHaptics } from "@/hooks/useHaptics";

import { type SourceDotSource } from "@/components/ui/SourceDot";
import { LoggedConfirmation } from "./LogSheetConfirmation";
import { FatSecretBadge } from "@/components/ui/FatSecretBadge";
import { TrustChip } from "@/components/ui/TrustChip";
import FoodSearchPanel, {
  type SelectedFood as InlineSelectedFood,
  type SupabaseLike as InlineSupabaseLike,
} from "@/components/food-search/FoodSearchPanel";
import type { FavoriteSearchItem as InlineFavoriteSearchItem } from "@suppr/nutrition-core/favoriteFoodsSearch";
import type { MacroConsumed, MacroTargets } from "@suppr/nutrition-core/remainingMacros";
import { looksLikeMealDescription } from "@suppr/nutrition-core/parseMealDescription";
import { isFeatureEnabled } from "@/lib/analytics";
import { LogSheetBarcodeFreePromise } from "@/components/today/LogSheetBarcodeFreePromise";
import { LogSheetDescribeFlow } from "@/components/today/LogSheetDescribeFlow";
import { LogSheetInputModeRow } from "@/components/today/LogSheetInputModeRow";
import {
  LogHubQuickActions,
  type LogHubQuickActionsProps,
} from "@/components/today/LogHubQuickActions";

/** Re-exported for hosts that want the inline-search payload type. */
export type LogSheetInlineSelectedFood = InlineSelectedFood;

/**
 * Mobile `<LogSheet>` — canonical log-entry sheet, search-first.
 *
 * Production design spec — 2026-04-27 Surface B (post-2026-04-28
 * search-first refactor — see `docs/ux/teardown-2026-04-28-daily-loop.md`
 * Next-10 #12, then 2026-04-30 nested-modal teardown — see customer-lens
 * note in `apps/mobile/components/food-search/FoodSearchPanel.tsx`).
 *
 * Pre-2026-04-28 structure: a 6-pill horizontal tab strip (Search / Scan /
 * Recent / Saved / Voice / Photo) where each tab rendered a different
 * content area.
 *
 * 2026-04-28 refactor: search became the canonical primary input as a
 * tap-to-open `Pressable`. The "tap" handler closed LogSheet and
 * opened a separate `<FoodSearchModal>` whose first job was rendering
 * an actual `<TextInput>`. Two modals stacked.
 *
 * 2026-04-30 refactor (CURRENT): the search row is now a real
 * `<TextInput>`. The user opens LogSheet and starts typing
 * IMMEDIATELY. Results render INLINE within the same sheet via a
 * mounted `<FoodSearchPanel>` (the same panel `<FoodSearchModal>`
 * mounts in its full-screen variant). No nested modal, no second
 * animation, no learning step.
 *
 * Wiring fallback: if a host wires the legacy `search.onOpen` but
 * not `search.onSelect`, the search row stays as a tap-to-open
 * `Pressable` and the host's `onOpen` callback fires (preserves the
 * old contract for any sheet that hasn't been migrated yet). Once
 * `search.onSelect` is wired, the sheet flips to inline mode.
 *
 * Right-edge input modes (scan / voice / photo) are unchanged — they
 * still tap-to-open the dedicated modals. Recent + Saved render below
 * the search row WHEN the query is empty; once the user starts typing
 * the panel takes over the content area and Recent/Saved are hidden.
 *
 * Pro gating: voice + photo are Pro-only on free + base tiers. The
 * host passes `locked: true` to surface a small lock badge on those
 * icons; the icon's `onTap` is still called so the host can route
 * to the AI paywall sheet instead of the real flow. The LogSheet
 * itself does not know about user tier.
 *
 * Spec deviation: spec calls for `@gorhom/bottom-sheet` with snap
 * points 50%/92%. That dependency is not yet in the project; rather
 * than introduce it for one component, we use the RN `Modal` pattern
 * that all other Suppr sheets use. Snap behaviour is approximated
 * via a height-controlled inner content. A `KeyboardAvoidingView`
 * wraps the sheet card so the inline results region scrolls above
 * the keyboard. Documented at `docs/journeys/log-sheet-2026-04-27.md`.
 *
 * Web mirror: `src/app/components/suppr/log-sheet.tsx` (web inline
 * lift is a follow-up commit).
 */

/**
 * Legacy tab-id type retained for backwards compat with deep test
 * references (`logSheetPhase3.test.tsx`). Post-2026-04-28 the
 * LogSheet does not render a tab strip; the only "tabs" are the
 * Recent / Saved pill toggle below the search row. The type union
 * stays so any host or test still passing `initialTab` compiles
 * cleanly — the prop is ignored.
 */
export type LogSheetTab =
  | "search"
  | "barcode"
  | "recent"
  | "saved"
  | "voice"
  | "photo";

export interface LogSheetSearchResult {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  thumbnail?: string;
}

export interface LogSheetRecentEntry {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  bucket: "today" | "week";
}

/** ENG-928 — go-to row in the empty Log sheet. */
export interface LogSheetGoToEntry {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
  count: number;
}

export interface LogSheetSavedMeal {
  id: string;
  title: string;
  kcal: number;
  source: SourceDotSource;
}

/**
 * Library tab row (TestFlight Build 40 feedback `AECfotBlQgwfgxYHr4dDaM8` +
 * "no way to add from library here", 2026-05-01).
 *
 * Surfaces the user's saved recipes inline in the LogSheet so a one-tap
 * log no longer requires routing through Recipes -> Library -> Detail
 * -> Log. Distinct from `LogSheetSavedMeal` (which represents a "saved
 * combo of foods") -- Library rows are recipe-level entries with a
 * canonical meal-type tag and per-portion kcal.
 */
export interface LogSheetLibraryRecipe {
  id: string;
  title: string;
  /** Per-portion kcal (recipe.calories / recipe.servings, rounded). */
  kcalPerPortion: number;
  /** Optional thumbnail URL -- falls back to a coloured placeholder. */
  thumbnail?: string | null;
  /** Optional meal-type tag (Breakfast / Lunch / Dinner / Snacks).
   *  Resolved from `recipes.meal_type` via the canonical
   *  `journalSlotFromMealTypes` helper at the host. Surfaced as a
   *  small pill on the row so the user knows which slot the one-tap
   *  log will land in. */
  mealTag?: "Breakfast" | "Lunch" | "Dinner" | "Snacks" | null;
}

export interface LogSheetBarcodeManualEntry {
  productName: string;
  brand?: string;
  source?: SourceDotSource;
}

export interface LogSheetTabState {
  loading?: boolean;
  error?: boolean;
  offline?: boolean;
  permissionDenied?: boolean;
  showFirstRunTip?: boolean;
}

export interface LogSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Ignored post-2026-04-28 — kept for backwards compat only. */
  initialTab?: LogSheetTab;
  /** ENG-1450 — pre-fills the inline search on open (onboarding deep-link
   *  via `openLogQuery`, web parity). Consumed once per open. */
  initialQuery?: string;
  /** Search foods.
   *
   *  INLINE MODE (preferred, 2026-04-30):
   *    Wire `onSelect` (and budget context if you want fit-this-in).
   *    The search row renders as a real `<TextInput>` with `autoFocus`,
   *    and as the user types, results render inline within the same
   *    sheet via `<FoodSearchPanel>`. When the user confirms a portion,
   *    `onSelect` fires with the canonical `SelectedFood` payload.
   *
   *  LEGACY TAP-TO-OPEN MODE (kept for hosts that haven't migrated):
   *    Wire `onOpen` only. The search row renders as a tap-to-open
   *    `Pressable` that calls `onOpen` — host is responsible for
   *    closing the LogSheet and opening its own `<FoodSearchModal>`.
   *
   *  When neither is wired the search row renders but is non-interactive
   *  (host has opted out of search entirely). */
  search?: {
    /** Inline mode — fired when the user picks a portion + quantity. */
    onSelect?: (result: LogSheetInlineSelectedFood) => void;
    /** Inline mode — daily targets for fit-this-in projection. */
    macroTargets?: MacroTargets;
    /** Inline mode — today's running totals for fit-this-in projection. */
    macroConsumed?: MacroConsumed;
    /** Inline mode — Supabase client + userId for custom foods. */
    supabase?: InlineSupabaseLike;
    userId?: string | null;
    /** ENG-772 — journal day for food-search preview time picker. */
    logDateKey?: string;
    /** Inline mode — the user's logging history, newest-first (from
     *  `computeRecentMeals`). Powers BOTH the empty-query "Recent" strip and
     *  the typed-query history-first "Past logged" group (ENG-1033). When
     *  omitted, neither history surface renders. */
    recentFoods?: Array<{
      recipeTitle: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      source?: string;
      count?: number;
      imageUrl?: string | null;
    }>;
    /** Favourites-in-search (teardown #1, ENG-1041) — the user's starred
     *  foods, surfaced as a "Favourites" group above "Past logged" and
     *  favourites-first in the empty-query Recent strip. Threaded straight
     *  through to `<FoodSearchPanel>`. When omitted, no favourites surface. */
    favoriteFoods?: InlineFavoriteSearchItem[];
    /** Star/unstar handler — host owns the optimistic write + revert. */
    onToggleFavorite?: (food: {
      recipeTitle: string;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      fiber?: number;
      source?: string;
      favoriteId?: string;
    }) => void;
    /** Keys of favourite toggles currently in flight (no double-submit). */
    favoritePendingKeys?: Set<string>;
    /** Legacy mode — tap-to-open the host's separate FoodSearchModal. */
    onOpen?: () => void;
    /** @deprecated */ query?: string;
    /** @deprecated */ onQueryChange?: (q: string) => void;
    /** @deprecated */ results?: LogSheetSearchResult[];
    /** @deprecated */ onAdd?: (result: LogSheetSearchResult) => void;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /** Scan barcode. Tap the scan icon → host opens
   *  BarcodeScannerModal. When host injects `manualEntry` (after a
   *  scan resolves to a 0-kcal product), the LogSheet replaces its
   *  default content with the manual-entry recovery form. */
  barcode?: {
    onOpen?: () => void;
    locked?: boolean;
    manualEntry?: LogSheetBarcodeManualEntry | null;
    onConfirmManual?: (
      payload: LogSheetBarcodeManualEntry & {
        portionGrams: number;
        kcal: number;
        protein: number;
        carbs: number;
        fat: number;
      },
    ) => void;
    /** @deprecated */ cameraSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  recent?: {
    entries: LogSheetRecentEntry[];
    onPick: (entry: LogSheetRecentEntry) => void;
    state?: LogSheetTabState;
  };
  saved?: {
    meals: LogSheetSavedMeal[];
    onPick: (meal: LogSheetSavedMeal) => void;
    /** ENG-776 — open the host's save-usual-meal flow (SaveMealDialog /
     *  SaveMealSheet). Shown in the Saved tab empty state and as a footer
     *  CTA when the user has saved meals but wants to create another. */
    onCreateSavedMeal?: () => void;
    /** ENG-783 — when set (flag `today-edit-entry-v2` on), tapping a saved
     *  meal opens the portion editor first instead of logging 1× instantly.
     *  Falls back to `onPick` when undefined (flag off → instant one-tap). */
    onRequestPortion?: (meal: LogSheetSavedMeal) => void;
    state?: LogSheetTabState;
  };
  /** Library tab -- user's saved recipes, surfaced inline so one-tap
   *  logging no longer requires routing through Recipes -> Library ->
   *  Detail. Sourced from TestFlight Build 40 feedback
   *  `AECfotBlQgwfgxYHr4dDaM8` ("No way to add recipes saved to
   *  library from here") + sibling reports, 2026-05-01.
   *
   *  Browse-tab order is Recent / Library / Saved meals -- Recent
   *  remains the most-frequent default (eat-again loop); Library
   *  sits next so the saved-recipe path is discoverable but doesn't
   *  steal first-tap from the eat-again user.
   *
   *  When `library` is undefined the tab is hidden entirely. When
   *  `library` is provided with an empty list, the empty state with
   *  a "Browse recipes" CTA renders. */
  library?: {
    recipes: LogSheetLibraryRecipe[];
    onPick: (recipe: LogSheetLibraryRecipe) => void;
    /** Empty-state CTA -- typically routes to /recipes. When
     *  undefined, the empty state hides the button. */
    onBrowseRecipes?: () => void;
    state?: LogSheetTabState;
  };
  /** Voice log. Tap the mic icon → host closes LogSheet and opens
   *  VoiceLogSheet (or the AI paywall sheet for free/base tiers). */
  voice?: {
    onStart?: () => void;
    locked?: boolean;
    /** @deprecated */ micSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /** Photo log. Tap the camera icon → host closes LogSheet and
   *  opens PhotoLogSheet (or the AI paywall for free/base). */
  photo?: {
    onCapture?: () => void;
    locked?: boolean;
    /** @deprecated */ shutterSlot?: React.ReactNode;
    /** @deprecated */ state?: LogSheetTabState;
  };
  /**
   * ENG-1252 — host-gated discoverability tooltip ("AI logging — available
   * with Pro.") under the LOCKED Voice / Snap chip in `InputModeRow`. The
   * sheet stays tier-agnostic, rendering the bubble only under a chip it
   * already shows as locked. Gate: `@suppr/shared/today/aiMethodTooltip`. */
  aiMethodTooltipVisible?: boolean;
  /** "Or add manually →" footer link. Host typically wires this to
   *  open the manual quick-add form. When undefined the footer is
   *  hidden. */
  onAddManually?: () => void;
  /** "Copy yesterday" quick-log shortcut (ENG-709). When provided,
   *  a row appears above the browse tabs showing the number of meals
   *  from yesterday. `onTap` fires when the user confirms; the host
   *  is responsible for the confirmation alert and the actual copy.
   *  When undefined (or count === 0) the row is hidden. */
  copyYesterday?: { count: number; onTap: () => void } | null;
  /** ENG-1247 — LogHub quick-action row (Log usual / Copy yesterday /
   *  Duplicate day) rendered above the browse tabs, replacing the
   *  standalone `copyYesterday` row. When provided, the row renders ONLY
   *  the actions whose handlers are present (no dead buttons) and the
   *  standalone `CopyYesterdayRow` is suppressed. The host flag-gates which
   *  prop it threads: `loghub_quick_actions_v1` ON → `quickActions`; OFF →
   *  `copyYesterday`. Presentation-only — reuses existing commit paths.
   *  Shape: {@link LogHubQuickActionsProps}. */
  quickActions?: LogHubQuickActionsProps | null;
  /** ENG-928 — slot-aware go-to foods above browse tabs. */
  goTos?: {
    entries: LogSheetGoToEntry[];
    onPick: (entry: LogSheetGoToEntry) => void;
  };
  /** ENG-973 — show free-barcode promise under search row. */
  showBarcodeFreePromise?: boolean;
  /** ENG-972 — inline natural-language describe + parse inside the sheet. */
  describe?: {
    locked?: boolean;
    /** Active meal slot label (Breakfast/Lunch/…) shown on describe review. */
    slotLabel?: string;
    onParse: (text: string) => Promise<import("@suppr/nutrition-core/parseMealDescription").ParseMealDescriptionResult>;
    onCommit: (items: import("@suppr/nutrition-core/aiLogging").AiLoggedItem[]) => void;
    onPaywall?: () => void;
  };
  /** Log-time meal-slot selector (ENG-773). When provided, a 4-segment
   *  Breakfast/Lunch/Dinner/Snacks control renders under the header so
   *  the user can see AND choose which meal the item lands in, instead
   *  of it being a hidden clock-inferred guess only fixable via a
   *  long-press edit. `current` is the active slot (host seeds it from
   *  time-of-day); `onChange` updates the host's active slot, which
   *  every commit path already reads. */
  slot?: {
    current: string;
    options: readonly string[];
    onChange: (slot: string) => void;
  };
  /** S13 logged-confirmation (Figma 202:2). Presentation-only success
   *  state shown AFTER the host has committed a log. The host owns all
   *  logging + persistence; this is purely the confirming surface. When
   *  set, the sheet content is replaced by a calm "Logged" confirmation
   *  card (item title, estimated kcal, slot) with a primary "Done" and an
   *  optional "Undo". When `null`/undefined the sheet shows its normal
   *  search-first composition. Mirror of the web `LogSheet`
   *  `confirmation` prop. */
  confirmation?: {
    /** What was logged — e.g. the food/meal title. */
    title: string;
    /** Estimated kcal of the logged item (always "estimated" copy). */
    kcal: number;
    /** ENG-1484 — verification state of the logged item's kcal, feeding the
     *  canonical `~` trust qualifier (`formatQualifiedKcal`, ENG-1417) behind
     *  `kcal_trust_qualifier_v1`. Absent = unverified (the ENG-1417 safe
     *  default — an unknown trust state never reads as confident), so hosts
     *  that don't yet thread per-item verification still render honestly. */
    kcalIsVerified?: boolean;
    /** Slot it landed in (Breakfast / Lunch / Dinner / Snacks). */
    slot?: string;
    /** Provenance dot for the logged item. */
    source?: SourceDotSource;
    /** Dismiss the confirmation (host closes the sheet / resets state). */
    onDone: () => void;
    /** Optional undo — host reverses the just-committed log. Hidden when
     *  undefined. */
    onUndo?: () => void;
  } | null;
}

type BrowseTab = "gotos" | "recent" | "library" | "saved";

function LogSheetImpl({
  visible,
  onClose,
  search,
  barcode,
  recent,
  saved,
  library,
  voice,
  photo,
  aiMethodTooltipVisible = false,
  onAddManually,
  copyYesterday,
  quickActions,
  slot,
  confirmation,
  goTos,
  showBarcodeFreePromise = false,
  describe,
  initialQuery,
}: LogSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the active slot pill.
  const accent = useAccent();

  // Pill toggle defaults to Recent. Resets on every fresh open so a
  // returning user doesn't land on Saved if they last left the sheet
  // there — the primary read is "what did I eat recently".
  const [browseTab, setBrowseTab] = React.useState<BrowseTab>("recent");
  React.useEffect(() => {
    if (!visible) setBrowseTab("recent");
    else if (goTos && goTos.entries.length > 0) setBrowseTab("gotos");
  }, [visible, goTos]);

  const inManualEntryMode = !!barcode?.manualEntry;
  const inConfirmationMode = !!confirmation;
  // ENG-1303 — v3 sheet header copy. OFF → the legacy "Log a meal" (kill switch).
  const sheetTitle = isFeatureEnabled("sloe_v3_log") ? "Add to today" : "Log a meal";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot} testID="log-sheet-root">
        <Pressable
          accessible
          accessibilityRole="button"
          accessibilityLabel="Dismiss log sheet"
          testID="log-sheet-backdrop"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: MODAL_OVERLAY_SCRIM }]}
        />
        {/* iOS keyboard-avoidance — when the user focuses the inline
            search TextInput, the sheet card lifts above the keyboard
            so result rows remain tappable. `behavior="padding"` is
            the iOS-standard for sheet-style layouts (see
            `KeyboardSafeView` docstring). */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.keyboardAvoid}
          pointerEvents="box-none"
        >
          <View
            accessibilityViewIsModal
            accessibilityLabel="Log a meal"
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                paddingBottom: insets.bottom,
              },
            ]}
          >
            {/* Drag handle */}
            <View style={[styles.handle, { backgroundColor: colors.border }]} accessible={false} />

            {/* Header — Sloe DS: Newsreader serif title in brand plum
                (`navPrimary`), the editorial-heading grammar shared with
                the Today section headers. */}
            <View style={styles.header}>
              <Text style={[Type.title, { color: colors.navPrimary }]}>{sheetTitle}</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close log sheet"
                hitSlop={8}
                style={({ pressed }) => [
                  styles.closeBtn,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <X size={IconSize.hero} color={colors.textSecondary} strokeWidth={2.25} />
              </Pressable>
            </View>

            {/* ENG-773 — log-time meal-slot selector. The slot the item
                will land in is now visible and tappable here, instead of
                a hidden clock guess only fixable via long-press edit.
                Hidden in confirmation mode (the log already committed). */}
            {slot && !inConfirmationMode ? (
              <View
                style={styles.slotRow}
                accessibilityRole="radiogroup"
                accessibilityLabel="Meal to log to"
                testID="log-sheet-slot-row"
              >
                {slot.options.map((s) => {
                  const active = slot.current === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => slot.onChange(s)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={`Log to ${s}`}
                      testID={`log-sheet-slot-${s.toLowerCase()}`}
                      style={[
                        styles.slotPill,
                        {
                          // Canonical selection language (2026-05-22, see
                          // onboarding/segmented.tsx): soft primary tint +
                          // primary border, NOT solid indigo. The label
                          // stays foreground (colors.text) when active —
                          // primary text on the tint is only ~3.34:1 and
                          // would fail WCAG AA 4.5:1 for this 12px label,
                          // whereas foreground clears it comfortably.
                          // §7 (2026-06-10): tint IS the signal — no ring.
                          borderColor: active ? accent.primarySoft : colors.border,
                          backgroundColor: active
                            ? accent.primarySoft
                            : "transparent",
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: Type.captionSmall.fontFamily,
                          fontSize: Type.captionSmall.fontSize,
                          lineHeight: Type.captionSmall.lineHeight,
                          fontWeight: "700",
                          color: colors.text,
                        }}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {inConfirmationMode ? (
              <LoggedConfirmation confirmation={confirmation!} />
            ) : inManualEntryMode ? (
              <BarcodeManualEntry
                entry={barcode!.manualEntry!}
                onConfirm={barcode?.onConfirmManual}
              />
            ) : (
              <DefaultComposition
                visible={visible}
                search={search}
                barcode={barcode}
                recent={recent}
                saved={saved}
                library={library}
                voice={voice}
                photo={photo}
                aiMethodTooltipVisible={aiMethodTooltipVisible}
                browseTab={browseTab}
                onBrowseTabChange={setBrowseTab}
                onAddManually={onAddManually}
                copyYesterday={copyYesterday}
                quickActions={quickActions}
                goTos={goTos}
                showBarcodeFreePromise={showBarcodeFreePromise}
                describe={describe}
                initialQuery={initialQuery}
                slotName={slot?.current ?? null}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

/* -------------------------- Logged confirmation (S13) -------------------------- */

// S13 logged-confirmation — extracted to `LogSheetConfirmation.tsx`
// (ENG-1484, screen-budget ratchet).

/* -------------------------- Default composition -------------------------- */

function DefaultComposition({
  visible,
  search,
  barcode,
  recent,
  saved,
  library,
  voice,
  photo,
  aiMethodTooltipVisible,
  browseTab,
  onBrowseTabChange,
  onAddManually,
  copyYesterday,
  quickActions,
  goTos,
  showBarcodeFreePromise,
  describe,
  initialQuery,
  slotName,
}: {
  visible: boolean;
  search: LogSheetProps["search"];
  barcode: LogSheetProps["barcode"];
  recent: LogSheetProps["recent"];
  saved: LogSheetProps["saved"];
  library: LogSheetProps["library"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  aiMethodTooltipVisible?: boolean;
  browseTab: BrowseTab;
  onBrowseTabChange: (tab: BrowseTab) => void;
  onAddManually?: () => void;
  copyYesterday?: LogSheetProps["copyYesterday"];
  quickActions?: LogSheetProps["quickActions"];
  goTos?: LogSheetProps["goTos"];
  showBarcodeFreePromise?: boolean;
  describe?: LogSheetProps["describe"];
  /** ENG-1450 — pre-fills the inline search on open (onboarding deep-link). */
  initialQuery?: LogSheetProps["initialQuery"];
  /** Active meal slot — feeds the food-thumb slot tier (ENG-1448). */
  slotName?: string | null;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const [describeReviewActive, setDescribeReviewActive] = React.useState(false);
  const [describeSeedText, setDescribeSeedText] = React.useState<string | null>(null);
  // ENG-1303 — the Describe method tile expands the inline describe flow via a
  // monotonically-bumped signal (opens EMPTY); paywalls a locked describe.
  const [describeExpandSignal, setDescribeExpandSignal] = React.useState(0);
  const onDescribe = React.useCallback(() => {
    if (describe?.locked) return void describe.onPaywall?.();
    setDescribeExpandSignal((n) => n + 1);
  }, [describe]);
  const showRecent = !!recent;
  const showSaved = !!saved;
  const showLibrary = !!library;
  const showGoTos = !!(goTos && goTos.entries.length > 0);
  const visibleTabs = React.useMemo<BrowseTab[]>(() => {
    const tabs: BrowseTab[] = [];
    if (showGoTos) tabs.push("gotos");
    if (showRecent) tabs.push("recent");
    if (showLibrary) tabs.push("library");
    if (showSaved) tabs.push("saved");
    return tabs;
  }, [showGoTos, showRecent, showLibrary, showSaved]);
  const showBrowseToggle = visibleTabs.length >= 2;

  // `search.onSelect` owns an inline input/results path; `onOpen`-only
  // callers retain the legacy external modal.
  const inlineMode = !!search?.onSelect;

  // Local query state — owned by LogSheet so the TextInput is
  // controlled and `<FoodSearchPanel>` reacts in lock-step. Reset
  // every time the sheet opens so a returning user lands on an
  // empty input, not their previous query — or to ENG-1450's
  // `initialQuery` (onboarding deep-link) when set.
  const [query, setQuery] = React.useState(initialQuery ?? "");
  const searchQueryActive = inlineMode && query.trim().length > 0;
  const showSecondaryMethodChrome = !(isFeatureEnabled("component_grammar_dedup") && searchQueryActive);
  React.useEffect(() => {
    if (!visible) {
      setQuery("");
      setDescribeReviewActive(false);
      setDescribeSeedText(null);
    } else if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  return (
    <View style={{ flex: 1 }}>
      {!describeReviewActive ? (
        <>
      {/* Search row — primary input. ENG-1532: the right-edge scan icon
          renders only while `component_grammar_dedup` is OFF (ON = the
          loud CTA is the single scanner entry; OFF = today's render,
          byte-intact — keep in sync with web). Inline mode = real
          `<TextInput>`; legacy mode = `Pressable` firing `search.onOpen`. */}
      <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}>
        {inlineMode ? (
          <View
            testID="log-sheet-search-row"
            style={[
              styles.searchInputWrap,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <Search size={IconSize.base} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search foods or scan"
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Search foods"
              testID="log-sheet-search-input"
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              style={{
                flex: 1,
                color: colors.text,
                fontSize: 14,
                paddingVertical: 0,
              }}
            />
            {barcode?.onOpen && !isFeatureEnabled("component_grammar_dedup") ? (
              <Pressable
                onPress={() => barcode.onOpen?.()}
                accessibilityRole="button"
                accessibilityLabel="Scan barcode"
                hitSlop={6}
                style={({ pressed }) => ({ opacity: pressed ? 0.55 : 1 })}
              >
                <ScanBarcode size={18} color={colors.textTertiary} strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search foods"
            accessibilityHint="Opens the food search where you can find foods, brands, and recipes"
            testID="log-sheet-search-row"
            onPress={() => search?.onOpen?.()}
            style={({ pressed }) => [
              styles.searchInputWrap,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Search size={IconSize.base} color={colors.textSecondary} />
            <Text
              style={{ flex: 1, color: colors.textSecondary, fontSize: 14 }}
              numberOfLines={1}
            >
              Search foods or scan
            </Text>
            {barcode?.onOpen && !isFeatureEnabled("component_grammar_dedup") ? (
              <ScanBarcode size={18} color={colors.textTertiary} strokeWidth={2} />
            ) : null}
          </Pressable>
        )}
        <LogSheetInputModeRow
          barcode={barcode}
          voice={voice}
          photo={photo}
          describe={describe ? { locked: describe.locked } : undefined}
          aiMethodTooltipVisible={aiMethodTooltipVisible}
          onQuickAdd={onAddManually}
          onDescribe={describe ? onDescribe : undefined}
          hidden={!showSecondaryMethodChrome}
        />
      </View>

      {showSecondaryMethodChrome && showBarcodeFreePromise && barcode?.onOpen ? (
        <LogSheetBarcodeFreePromise onOpen={() => barcode.onOpen?.()} />
      ) : null}
        </>
      ) : null}

      {describe ? (
        <LogSheetDescribeFlow
          sheetOpen={visible}
          locked={describe.locked}
          slotLabel={describe.slotLabel}
          seedText={describeSeedText}
          onSeedConsumed={() => setDescribeSeedText(null)}
          expandSignal={describeExpandSignal}
          onParse={describe.onParse}
          onCommit={describe.onCommit}
          onPaywall={describe.onPaywall}
          onReviewActiveChange={setDescribeReviewActive}
          inputHidden={!describeReviewActive && searchQueryActive}
          collapsedEntryHidden={isFeatureEnabled("component_grammar_dedup")}
        />
      ) : null}

      {!describeReviewActive ? (
      <View style={{ flex: 1, minHeight: 0 }}>
      {/* Inline search results — only mounted when the user has
          actually started typing. Empty query keeps the existing
          Recent / Saved browse content visible so the sheet doesn't
          look "blank" on open. */}
      {inlineMode && query.trim().length > 0 ? (
        <View style={{ flex: 1, marginTop: Spacing.sm }}>
          {describe && looksLikeMealDescription(query) ? (
            <Pressable
              testID="log-sheet-describe-from-search"
              accessibilityRole="button"
              accessibilityLabel="Estimate search text as meal description"
              onPress={() => {
                setDescribeSeedText(query.trim());
                setQuery("");
              }}
              style={({ pressed }) => ({
                marginHorizontal: Spacing.md,
                marginBottom: Spacing.sm,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.sm,
                borderRadius: Radius.lg,
                borderWidth: 1,
                borderColor: accent.primarySoft,
                backgroundColor: accent.primarySoft,
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: accent.primarySolid }}>
                Estimate as meal description
              </Text>
            </Pressable>
          ) : null}
          <FoodSearchPanel
            query={query}
            macroTargets={search?.macroTargets}
            macroConsumed={search?.macroConsumed}
            supabase={search?.supabase}
            userId={search?.userId}
            logDateKey={search?.logDateKey}
            recentFoods={search?.recentFoods}
            favoriteFoods={search?.favoriteFoods}
            onToggleFavorite={search?.onToggleFavorite}
            favoritePendingKeys={search?.favoritePendingKeys}
            onSelect={(result) => {
              search?.onSelect?.(result);
              // After a successful pick the user has logged something —
              // clear the input so the sheet returns to Recent / Saved
              // view (or the host may close the sheet via its own
              // `onSelect` handler).
              setQuery("");
            }}
            mode="compact"
          />
        </View>
      ) : (
        <>
          {quickActions ? (
            <LogHubQuickActions quickActions={quickActions} />
          ) : copyYesterday && copyYesterday.count > 0 ? (
            <CopyYesterdayRow count={copyYesterday.count} onTap={copyYesterday.onTap} />
          ) : null}
          <BrowseAndFooter
            showBrowseToggle={showBrowseToggle}
            visibleTabs={visibleTabs}
            showRecent={showRecent}
            showSaved={showSaved}
            showLibrary={showLibrary}
            showGoTos={showGoTos}
            goTos={goTos}
            recent={recent}
            saved={saved}
            library={library}
            browseTab={browseTab}
            onBrowseTabChange={onBrowseTabChange}
            macroTargets={search?.macroTargets}
            macroConsumed={search?.macroConsumed}
            slotName={slotName}
          />
        </>
      )}
      </View>
      ) : null}
    </View>
  );
}

/* -------------------------- Go-to foods (ENG-928) -------------------------- */

function GoToList({
  goTos,
  embedded = false,
  slotName,
}: {
  goTos: NonNullable<LogSheetProps["goTos"]>;
  embedded?: boolean;
  slotName?: string | null;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  return (
    <View
      style={embedded ? undefined : { paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}
      testID="log-sheet-go-tos"
    >
      {embedded ? null : (
        <Text
          style={{
            fontSize: 11,
            fontWeight: "600",
            letterSpacing: 0.6,
            textTransform: "uppercase",
            color: colors.textSecondary,
            marginBottom: Spacing.xs,
          }}
        >
          Go-tos for this meal
        </Text>
      )}
      {goTos.entries.map((entry) => (
        <BrowseRow
          key={entry.id}
          title={entry.title}
          kcal={entry.kcal}
          source={entry.source}
          onPick={() => goTos.onPick(entry)}
          slotName={slotName}
        />
      ))}
    </View>
  );
}

/* -------------------------- Copy yesterday row -------------------------- */

function CopyYesterdayRow({ count, onTap }: { count: number; onTap: () => void }) {
  const colors = useThemeColors();
  const label = count === 1 ? "1 meal" : `${count} meals`;
  return (
    <PressableScale
      haptic="selection"
      accessibilityRole="button"
      accessibilityLabel={`Copy yesterday's ${label} to today`}
      testID="copy-yesterday-row"
      onPress={onTap}
      style={[
        styles.copyYesterdayRow,
        {
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Copy size={16} color={colors.tint} strokeWidth={2} />
      <Text style={[Type.body, { color: colors.text, flex: 1 }]}>
        Copy yesterday&apos;s meals
      </Text>
      <Text style={[Type.caption, { color: colors.textSecondary }]}>{label}</Text>
      <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
    </PressableScale>
  );
}

/* -------------------------- Browse + footer (empty-query mode) -------------------------- */

function BrowseAndFooter({
  showBrowseToggle,
  visibleTabs,
  showRecent,
  showSaved,
  showLibrary,
  showGoTos,
  goTos,
  recent,
  saved,
  library,
  browseTab,
  onBrowseTabChange,
  macroTargets,
  macroConsumed,
  slotName,
}: {
  showBrowseToggle: boolean;
  visibleTabs: BrowseTab[];
  showRecent: boolean;
  showSaved: boolean;
  showLibrary: boolean;
  showGoTos: boolean;
  goTos?: LogSheetProps["goTos"];
  recent: LogSheetProps["recent"];
  saved: LogSheetProps["saved"];
  library: LogSheetProps["library"];
  browseTab: BrowseTab;
  onBrowseTabChange: (tab: BrowseTab) => void;
  macroTargets?: MacroTargets;
  macroConsumed?: MacroConsumed;
  /** Active meal slot — feeds the food-thumb slot tier (ENG-1448). */
  slotName?: string | null;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  // Secondary accent (Frost flag → damson, else clay) for the saved-tab
  // indicator dot.
  // The active tab can become stale if a host removes one of its
  // sources mid-flight (rare). Snap back to the first visible tab to
  // keep the content area legible.
  const activeTab: BrowseTab = visibleTabs.includes(browseTab)
    ? browseTab
    : (visibleTabs[0] ?? "recent");

  const labelFor = (id: BrowseTab) =>
    id === "gotos"
      ? "Favourites"
      : id === "recent"
        ? "Recent"
        : id === "library"
          ? "My recipes"
          : "Saved meals";

  return (
    <>
      {/* Browse tabs — Figma 336:2 underline rail; pans horizontally instead
          of clipping at accessibility type sizes (ENG-1529). */}
      {showBrowseToggle ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          accessibilityRole="tablist"
          testID="log-sheet-browse-tab-scroll"
          style={[styles.browseTabRow, { borderBottomColor: colors.border }]}
          contentContainerStyle={styles.browseTabRowContent}
        >
          {visibleTabs.map((id) => {
            const active = activeTab === id;
            const savedCount = saved?.meals?.length ?? 0;
            const showSavedDot = id === "saved" && savedCount >= 3;
            const baseLabel = labelFor(id);
            return (
              <PressableScale
                key={id}
                haptic="selection"
                onPress={() => {
                  if (id === activeTab) return;
                  onBrowseTabChange(id);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  showSavedDot ? `${baseLabel} — ${savedCount} saved` : baseLabel
                }
                testID={`log-sheet-tab-${id}`}
                style={[
                  styles.browseTab,
                  {
                    borderBottomColor: active ? colors.text : "transparent",
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.browseTabLabel,
                    {
                      color: active ? colors.text : colors.textTertiary,
                      fontWeight: active ? "600" : "400",
                    },
                  ]}
                >
                  {baseLabel}
                </Text>
                {showSavedDot ? (
                  <View
                    testID="log-sheet-tab-saved-dot"
                    style={[styles.savedDot, { backgroundColor: accent.primary }]}
                  />
                ) : null}
              </PressableScale>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Browse content */}
      <View style={{ flex: 1 }}>
        {showGoTos && activeTab === "gotos" && goTos ? (
          <ScrollView contentContainerStyle={{ paddingBottom: Spacing.xxl + 72 }}>
            <GoToList goTos={goTos} embedded slotName={slotName} />
          </ScrollView>
        ) : null}
        {showRecent && activeTab === "recent" ? (
          <RecentList recent={recent!} slotName={slotName} />
        ) : null}
        {showLibrary && activeTab === "library" ? (
          <LibraryList library={library!} slotName={slotName} />
        ) : null}
        {showSaved && activeTab === "saved" ? (
          <SavedList saved={saved!} slotName={slotName} />
        ) : null}
        {!showGoTos && !showRecent && !showSaved && !showLibrary ? (
          <View style={{ flex: 1, padding: Spacing.lg, alignItems: "center", justifyContent: "center" }}>
            <Text style={[Type.caption, { color: colors.textSecondary, textAlign: "center" }]}>
              Search above for foods, or scan / speak / snap a photo.
            </Text>
          </View>
        ) : null}
      </View>

      {macroTargets && macroConsumed ? (
        <LogSheetDailyProgress
          macroTargets={macroTargets}
          macroConsumed={macroConsumed}
        />
      ) : null}
    </>
  );
}

/* -------------------------- Daily progress footer (Figma 336:2) -------------------------- */

function LogSheetDailyProgress({
  macroTargets,
  macroConsumed,
}: {
  macroTargets: MacroTargets;
  macroConsumed: MacroConsumed;
}) {
  const colors = useThemeColors(), mc = useResolvedScheme() === "dark" ? MacroColorsDark : MacroColors;
  const kcalTarget = Math.round(macroTargets.calories);
  const kcalConsumed = Math.round(macroConsumed.calories);
  // ENG-1453: the kcal figure carries state colour like its P/C/F
  // siblings — over-budget amber when past target, neutral otherwise
  // (same treatment as the calorie figure in CalorieRingDial).
  const kcalOver = kcalTarget > 0 && kcalConsumed > kcalTarget;
  return (
    <View
      testID="log-sheet-daily-progress"
      style={[styles.dailyProgressRow, { borderTopColor: colors.border }]}
    >
      <View>
        <Text style={[Type.label, { color: colors.textTertiary, fontSize: 10 }]}>
          Daily progress
        </Text>
        <Text
          style={[
            Type.title,
            { color: kcalOver ? colors.overBudgetFg : colors.text, fontSize: 20, marginTop: 2 },
          ]}
        >
          {kcalConsumed}{" "}
          <Text style={{ fontSize: 14, color: colors.textSecondary, fontFamily: Type.body.fontFamily }}>
            / {kcalTarget} kcal
          </Text>
        </Text>
      </View>
      <View style={styles.dailyMacroRow}>
        {(
          [
            ["P", macroConsumed.protein, mc.protein],
            ["C", macroConsumed.carbs, mc.carbs],
            ["F", macroConsumed.fat, mc.fat],
          ] as const
        ).map(([letter, grams, color]) => (
          <View key={letter} style={{ alignItems: "center" }}>
            <Text
              style={{
                ...Type.bodyLarge,
                color,
                fontVariant: ["tabular-nums"],
              }}
            >
              {Math.round(grams)}g
            </Text>
            <Text style={{ fontSize: 10, color: colors.textTertiary, marginTop: 2 }}>{letter}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/* -------------------------- Recent list -------------------------- */

function RecentList({ recent, slotName }: { recent: NonNullable<LogSheetProps["recent"]>; slotName?: string | null }) {
  const colors = useThemeColors();
  const accent = useAccent();
  const { entries, onPick, state } = recent;
  const today = entries.filter((e) => e.bucket === "today");
  const week = entries.filter((e) => e.bucket === "week");

  if (state?.loading) {
    return <SkeletonList colors={colors} />;
  }

  if (entries.length === 0) {
    return (
      <View style={[styles.emptyBlock, { borderColor: colors.border, margin: Spacing.md }]}>
        <Clock size={32} color={colors.textTertiary} />
        <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
          Your recent foods will appear here
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4, textAlign: "center" }]}>
          {"Log something once and it'll show up next time."}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}>
      {today.length > 0 ? (
        <View>
          <Text style={[Type.label, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
            {"Today's recents"}
          </Text>
          {today.map((e) => (
            <BrowseRow key={e.id} title={e.title} kcal={e.kcal} source={e.source} onPick={() => onPick(e)} slotName={slotName} />
          ))}
        </View>
      ) : null}
      {week.length > 0 ? (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={[Type.label, { color: colors.textSecondary, marginBottom: Spacing.sm }]}>
            Earlier this week
          </Text>
          {week.map((e) => (
            <BrowseRow key={e.id} title={e.title} kcal={e.kcal} source={e.source} onPick={() => onPick(e)} slotName={slotName} />
          ))}
        </View>
      ) : null}
      {entries.some((e) => e.source === "fatsecret") ? (
        <FatSecretBadge variant="text" style={{ marginTop: 8, marginHorizontal: 4 }} />
      ) : null}
    </ScrollView>
  );
}

/* -------------------------- Saved list -------------------------- */

function SavedList({ saved, slotName }: { saved: NonNullable<LogSheetProps["saved"]>; slotName?: string | null }) {
  const colors = useThemeColors();
  const accent = useAccent();
  const { meals, onPick, onRequestPortion, onCreateSavedMeal, state } = saved;

  if (state?.loading) {
    return <SkeletonList colors={colors} />;
  }

  if (meals.length === 0) {
    return (
      <View style={[styles.emptyBlock, { borderColor: colors.border, margin: Spacing.md }]}>
        <History size={32} color={colors.textTertiary} />
        <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
          No saved meals yet
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4, textAlign: "center" }]}>
          Save a meal you eat often to log it in one tap.
        </Text>
        {onCreateSavedMeal ? (
          <SupprButton
            variant="ghost"
            accessibilityLabel="Save a usual meal"
            label="Save a usual meal"
            haptic="selection"
            onPress={onCreateSavedMeal}
            style={styles.libraryEmptyCta}
          />
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}>
      {meals.map((m) => (
        <BrowseRow
          key={m.id}
          title={m.title}
          kcal={m.kcal}
          source={m.source}
          // ENG-783 — flag on: tap opens the portion editor; flag off:
          // instant one-tap log (onPick).
          onPick={() => (onRequestPortion ?? onPick)(m)}
          slotName={slotName}
          accessibilityLabel={
            onRequestPortion ? `Edit portion for ${m.title}` : undefined
          }
        />
      ))}
      {onCreateSavedMeal ? (
        <SupprButton
          variant="ghost"
          accessibilityLabel="Save another usual meal"
          label="Save another usual meal"
          haptic="selection"
          onPress={onCreateSavedMeal}
          style={{ marginTop: Spacing.sm }}
        />
      ) : null}
    </ScrollView>
  );
}

/* -------------------------- Library list -------------------------- */

function LibraryList({ library, slotName }: { library: NonNullable<LogSheetProps["library"]>; slotName?: string | null }) {
  const colors = useThemeColors();
  const accent = useAccent();
  // The empty-state "Browse recipes" CTA is now a ghost SupprButton (it owns
  // its own plum label).
  const { recipes, onPick, onBrowseRecipes, state } = library;

  if (state?.loading) {
    return <SkeletonList colors={colors} />;
  }

  if (recipes.length === 0) {
    return (
      <View style={[styles.emptyBlock, { borderColor: colors.border, margin: Spacing.md }]}>
        <BookmarkCheck size={32} color={colors.textTertiary} />
        <Text style={[Type.body, { color: colors.text, marginTop: 8, fontWeight: "600" }]}>
          No saved recipes yet
        </Text>
        <Text style={[Type.caption, { color: colors.textSecondary, marginTop: 4, textAlign: "center" }]}>
          Save recipes from the Recipes tab to see them here. We&rsquo;ll show your most-cooked recipes first.
        </Text>
        {onBrowseRecipes ? (
          <SupprButton
            variant="ghost"
            accessibilityLabel="Browse recipes"
            label="Browse recipes"
            // Navigation, not a commit → the lighter selection haptic (the
            // primitive fires it via PressableScale, so no manual call here).
            haptic="selection"
            onPress={onBrowseRecipes}
            // Button system (2026-06-12): the empty-state "Browse recipes" is a
            // SECONDARY action → ghost (transparent, plum label), replacing the
            // old off-white colors.card fill. Mirror of web.
            style={styles.libraryEmptyCta}
          />
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}>
      {recipes.map((r) => (
        <LibraryRow key={r.id} recipe={r} onPick={() => onPick(r)} slotName={slotName} />
      ))}
    </ScrollView>
  );
}

/* -------------------------- Skeleton -------------------------- */

function SkeletonList({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ padding: Spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.skeletonThumb, { backgroundColor: colors.skeleton }]} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.skeleton, width: "65%" }]} />
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.skeleton, width: "30%", marginTop: Spacing.xs, height: 8 },
              ]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

/* -------------------------- Barcode manual entry -------------------------- */

function BarcodeManualEntry({
  entry,
  onConfirm,
}: {
  entry: LogSheetBarcodeManualEntry;
  onConfirm?: NonNullable<NonNullable<LogSheetProps["barcode"]>["onConfirmManual"]>;
}) {
  const colors = useThemeColors();
  const accent = useAccent();
  const haptics = useHaptics();
  // The "Log it" commit CTA is now a solid-plum SupprButton (it owns its own
  // colour).
  const [portion, setPortion] = React.useState("100");
  const [kcal, setKcal] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");

  const inputStyle = {
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: 8,
    borderRadius: Radius.lg,
    color: colors.text,
    textAlign: "right" as const,
    fontVariant: ["tabular-nums"] as ("tabular-nums")[],
  };

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md, paddingBottom: 80 }}
      keyboardShouldPersistTaps="handled"
    >
      <View
        style={{
          padding: Spacing.md,
          borderRadius: Radius.xl,
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.border,
          gap: 8,
        }}
      >
        <Text style={[Type.body, { color: colors.text, fontWeight: "700" }]}>{entry.productName}</Text>
        {entry.brand ? (
          <Text style={[Type.caption, { color: colors.textSecondary }]}>{entry.brand}</Text>
        ) : null}
        <TrustChip variant="manual" />
      </View>

      <Text style={[Type.caption, { color: colors.textSecondary }]}>
        {"No nutrition data — enter manually. We'll save this so the next scan finds it."}
      </Text>

      <View style={styles.inputRow}>
        <Text style={[Type.body, { color: colors.textSecondary }]}>Portion (g)</Text>
        <TextInput
          accessibilityLabel="Portion in grams"
          keyboardType="decimal-pad"
          value={portion}
          onChangeText={setPortion}
          style={[inputStyle, { width: 100 }]}
        />
      </View>
      <View style={styles.inputRow}>
        <Text style={[Type.body, { color: colors.textSecondary }]}>kcal</Text>
        <TextInput
          accessibilityLabel="Kilocalories"
          keyboardType="decimal-pad"
          value={kcal}
          onChangeText={setKcal}
          style={[inputStyle, { width: 100 }]}
        />
      </View>
      <Text style={[Type.caption, { color: colors.textSecondary, fontWeight: "600" }]}>
        Macros (g)
      </Text>
      <View style={{ flexDirection: "row", gap: Spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}
          >
            Protein
          </Text>
          <TextInput
            accessibilityLabel="Protein grams"
            keyboardType="decimal-pad"
            value={protein}
            onChangeText={setProtein}
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}
          >
            Carbs
          </Text>
          <TextInput
            accessibilityLabel="Carbs grams"
            keyboardType="decimal-pad"
            value={carbs}
            onChangeText={setCarbs}
            style={inputStyle}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            numberOfLines={1}
            style={[Type.caption, { color: colors.textSecondary, marginBottom: 4 }]}
          >
            Fat
          </Text>
          <TextInput
            accessibilityLabel="Fat grams"
            keyboardType="decimal-pad"
            value={fat}
            onChangeText={setFat}
            style={inputStyle}
          />
        </View>
      </View>

      {/* Button system (2026-06-12): the manual-entry commit is the sheet's
          single primary action → SOLID-plum SupprButton primary. The success
          notification haptic stays (it's the "logged" confirmation, not press
          feedback), so the primitive's own press haptic is suppressed to avoid
          a double buzz on one tap. */}
      <SupprButton
        variant="primary"
        accessibilityLabel="Log it"
        label="Log it"
        haptic="none"
        onPress={() => {
          if (!onConfirm) return;
          haptics.success();
          onConfirm({
            ...entry,
            portionGrams: Number(portion) || 100,
            kcal: Number(kcal) || 0,
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
          });
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  keyboardAvoid: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    height: "92%",
    // Sloe DS — 24px sheet corner (matches web `rounded-t-card-lg` /
    // `--radius-card-lg`); sheet shadow via the Elevation token (ENG-1500 —
    // overlays KEEP their float under the flat card grammar).
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: "hidden",
    ...Elevation.sheet,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: Spacing.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  // ENG-773 — log-time slot selector pills under the header.
  slotRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  slotPill: {
    flex: 1,
    paddingVertical: Spacing.sm,
    // Chips census (2026-06-10): option chips join the §7 family —
    // fully round, soft tint carries selection (no accent ring).
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    minHeight: 48, // ENG-1529 — grows with Dynamic Type; 48 stays the floor
    borderRadius: Radius.full,
    borderWidth: StyleSheet.hairlineWidth,
  },
  browseTabRow: {
    flexGrow: 0,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  browseTabRowContent: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  browseTab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingBottom: Spacing.sm,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  browseTabLabel: {
    fontSize: 14,
  },
  savedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dailyProgressRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dailyMacroRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  copyYesterdayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Flat-card grammar (2026-06-12): quiet-fill add affordance — inset
  // chip-row (margin + radius 12), no border, no top divider.
  manualFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skeletonThumb: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    opacity: 0.6,
  },
  skeletonLine: {
    height: 10,
    borderRadius: Radius.sm,
    opacity: 0.6,
  },
  emptyBlock: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: Radius.xl,
    paddingVertical: 32,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  // Layout-only override for the ghost "Browse recipes" SupprButton (the
  // primitive owns the pill radius + padding + plum label).
  libraryEmptyCta: {
    marginTop: Spacing.md,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  // S13 logged-confirmation styles moved with the component to
  // `LogSheetConfirmation.tsx` (ENG-1484).
});

export const LogSheet = memo(LogSheetImpl);

export default LogSheet;
