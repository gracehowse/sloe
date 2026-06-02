import * as React from "react";
import {
  Image,
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
  Camera,
  ChevronRight,
  Clock,
  Copy,
  History,
  Lock,
  Mic,
  PencilLine,
  ScanBarcode,
  Search,
  X,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";

import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

import { SourceDot, type SourceDotSource } from "@/components/ui/SourceDot";
import { FatSecretBadge } from "@/components/ui/FatSecretBadge";
import { TrustChip } from "@/components/ui/TrustChip";
import FoodSearchPanel, {
  type SelectedFood as InlineSelectedFood,
  type SupabaseLike as InlineSupabaseLike,
} from "@/components/food-search/FoodSearchPanel";
import type { MacroConsumed, MacroTargets } from "@suppr/shared/nutrition/remainingMacros";

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
}

type BrowseTab = "recent" | "library" | "saved";

export function LogSheet({
  visible,
  onClose,
  search,
  barcode,
  recent,
  saved,
  library,
  voice,
  photo,
  onAddManually,
  copyYesterday,
  slot,
}: LogSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();

  // Pill toggle defaults to Recent. Resets on every fresh open so a
  // returning user doesn't land on Saved if they last left the sheet
  // there — the primary read is "what did I eat recently".
  const [browseTab, setBrowseTab] = React.useState<BrowseTab>("recent");
  React.useEffect(() => {
    if (!visible) setBrowseTab("recent");
  }, [visible]);

  const inManualEntryMode = !!barcode?.manualEntry;

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
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }]}
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

            {/* Header */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <Text style={[Type.headline, { color: colors.text }]}>Log a meal</Text>
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
                a hidden clock guess only fixable via long-press edit. */}
            {slot ? (
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
                          borderColor: active ? Accent.primary : colors.border,
                          backgroundColor: active
                            ? Accent.primarySoft
                            : "transparent",
                        },
                      ]}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: active ? colors.text : colors.textSecondary,
                        }}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {inManualEntryMode ? (
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
                browseTab={browseTab}
                onBrowseTabChange={setBrowseTab}
                onAddManually={onAddManually}
                copyYesterday={copyYesterday}
              />
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

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
  browseTab,
  onBrowseTabChange,
  onAddManually,
  copyYesterday,
}: {
  visible: boolean;
  search: LogSheetProps["search"];
  barcode: LogSheetProps["barcode"];
  recent: LogSheetProps["recent"];
  saved: LogSheetProps["saved"];
  library: LogSheetProps["library"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
  browseTab: BrowseTab;
  onBrowseTabChange: (tab: BrowseTab) => void;
  onAddManually?: () => void;
  copyYesterday?: LogSheetProps["copyYesterday"];
}) {
  const colors = useThemeColors();
  const showRecent = !!recent;
  const showSaved = !!saved;
  const showLibrary = !!library;
  // Show the multi-tab toggle whenever 2+ browse sources are wired.
  // With Library added (2026-05-01), order is Recent / Library / Saved.
  const visibleTabs = React.useMemo<BrowseTab[]>(() => {
    const tabs: BrowseTab[] = [];
    if (showRecent) tabs.push("recent");
    if (showLibrary) tabs.push("library");
    if (showSaved) tabs.push("saved");
    return tabs;
  }, [showRecent, showLibrary, showSaved]);
  const showBrowseToggle = visibleTabs.length >= 2;

  // Inline-search mode is active when the host wired `search.onSelect`.
  // In that case the search row is a real `<TextInput>` and results
  // render via `<FoodSearchPanel>` within this same sheet. Without
  // `onSelect` we fall back to the legacy tap-to-open path that
  // routes to a separate `<FoodSearchModal>` (preserves any host
  // that hasn't migrated yet).
  const inlineMode = !!search?.onSelect;

  // Local query state — owned by LogSheet so the TextInput is
  // controlled and `<FoodSearchPanel>` reacts in lock-step. Reset
  // every time the sheet opens so a returning user lands on an
  // empty input, not their previous query.
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    if (!visible) {
      setQuery("");
    }
  }, [visible]);

  return (
    <View style={{ flex: 1 }}>
      {/* Search row — primary input. Right-edge icons (scan / voice
          / photo) ride along when the host wires the corresponding
          callbacks. In inline mode the row is a real `<TextInput>`
          (focused on first appearance); in legacy tap-to-open mode
          it's a `Pressable` that fires `search.onOpen`. */}
      <View style={{ paddingHorizontal: Spacing.md, paddingTop: Spacing.md }}>
        {inlineMode ? (
          <View
            testID="log-sheet-search-row"
            style={[
              styles.searchInputWrap,
              { backgroundColor: colors.inputBg },
            ]}
          >
            <Search size={IconSize.base} color={colors.textSecondary} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search foods, brands, or recipes"
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
            <RightEdgeIcons barcode={barcode} voice={voice} photo={photo} />
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
                backgroundColor: colors.inputBg,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Search size={IconSize.base} color={colors.textSecondary} />
            <Text
              style={{ flex: 1, color: colors.textSecondary, fontSize: 14 }}
              numberOfLines={1}
            >
              Search foods, brands, or recipes
            </Text>
            <RightEdgeIcons barcode={barcode} voice={voice} photo={photo} />
          </Pressable>
        )}
      </View>

      {/* Inline search results — only mounted when the user has
          actually started typing. Empty query keeps the existing
          Recent / Saved browse content visible so the sheet doesn't
          look "blank" on open. */}
      {inlineMode && query.trim().length > 0 ? (
        <View style={{ flex: 1, marginTop: Spacing.sm }}>
          <FoodSearchPanel
            query={query}
            macroTargets={search?.macroTargets}
            macroConsumed={search?.macroConsumed}
            supabase={search?.supabase}
            userId={search?.userId}
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
          {copyYesterday && copyYesterday.count > 0 && (
            <CopyYesterdayRow count={copyYesterday.count} onTap={copyYesterday.onTap} />
          )}
          <BrowseAndFooter
            showBrowseToggle={showBrowseToggle}
            visibleTabs={visibleTabs}
            showRecent={showRecent}
            showSaved={showSaved}
            showLibrary={showLibrary}
            recent={recent}
            saved={saved}
            library={library}
            browseTab={browseTab}
            onBrowseTabChange={onBrowseTabChange}
            onAddManually={onAddManually}
          />
        </>
      )}
    </View>
  );
}

/* -------------------------- Copy yesterday row -------------------------- */

function CopyYesterdayRow({ count, onTap }: { count: number; onTap: () => void }) {
  const colors = useThemeColors();
  const label = count === 1 ? "1 meal" : `${count} meals`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Copy yesterday's ${label} to today`}
      testID="copy-yesterday-row"
      onPress={() => {
        void Haptics.selectionAsync();
        onTap();
      }}
      style={({ pressed }) => [
        styles.copyYesterdayRow,
        {
          borderBottomColor: colors.border,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Copy size={16} color={colors.tint} strokeWidth={2} />
      <Text style={[Type.body, { color: colors.text, flex: 1 }]}>
        Copy yesterday&apos;s meals
      </Text>
      <Text style={[Type.caption, { color: colors.textSecondary }]}>{label}</Text>
      <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
    </Pressable>
  );
}

/* -------------------------- Browse + footer (empty-query mode) -------------------------- */

function BrowseAndFooter({
  showBrowseToggle,
  visibleTabs,
  showRecent,
  showSaved,
  showLibrary,
  recent,
  saved,
  library,
  browseTab,
  onBrowseTabChange,
  onAddManually,
}: {
  showBrowseToggle: boolean;
  visibleTabs: BrowseTab[];
  showRecent: boolean;
  showSaved: boolean;
  showLibrary: boolean;
  recent: LogSheetProps["recent"];
  saved: LogSheetProps["saved"];
  library: LogSheetProps["library"];
  browseTab: BrowseTab;
  onBrowseTabChange: (tab: BrowseTab) => void;
  onAddManually?: () => void;
}) {
  const colors = useThemeColors();
  // The active tab can become stale if a host removes one of its
  // sources mid-flight (rare). Snap back to the first visible tab to
  // keep the content area legible.
  const activeTab: BrowseTab = visibleTabs.includes(browseTab)
    ? browseTab
    : (visibleTabs[0] ?? "recent");

  const labelFor = (id: BrowseTab) =>
    id === "recent" ? "Recent" : id === "library" ? "Library" : "Saved meals";

  return (
    <>
      {/* Browse pill toggle — Recent / Library / Saved. Hidden when
          only one source is available; the available one renders
          directly.
          2026-05-01 (journey-architect P1): all pills carry equal
          weight (font / active-state / touch target) and the Saved
          pill carries a small dot indicator when the user has 3+
          saved meals to nudge first-time users to the tab they don't
          know exists yet. */}
      {showBrowseToggle ? (
        <View
          style={[styles.browsePillRow, { backgroundColor: colors.inputBg }]}
          accessibilityRole="tablist"
        >
          {visibleTabs.map((id) => {
            const active = activeTab === id;
            const savedCount = saved?.meals?.length ?? 0;
            const showSavedDot = id === "saved" && savedCount >= 3;
            const baseLabel = labelFor(id);
            return (
              <Pressable
                key={id}
                onPress={() => {
                  if (id === activeTab) return;
                  onBrowseTabChange(id);
                  if (process.env.EXPO_OS === "ios") {
                    void Haptics.selectionAsync();
                  }
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                accessibilityLabel={
                  showSavedDot ? `${baseLabel} — ${savedCount} saved` : baseLabel
                }
                testID={
                  id === "recent"
                    ? "log-sheet-tab-recent"
                    : id === "library"
                      ? "log-sheet-tab-library"
                      : "log-sheet-tab-saved"
                }
                style={[
                  styles.browsePill,
                  { backgroundColor: active ? colors.background : "transparent" },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Text
                    style={[
                      styles.browsePillLabel,
                      { color: active ? colors.text : colors.textSecondary },
                    ]}
                  >
                    {baseLabel}
                  </Text>
                  {showSavedDot ? (
                    <View
                      testID="log-sheet-tab-saved-dot"
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: Accent.primary,
                      }}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* Browse content */}
      <View style={{ flex: 1 }}>
        {showRecent && activeTab === "recent" ? (
          <RecentList recent={recent!} />
        ) : null}
        {showLibrary && activeTab === "library" ? (
          <LibraryList library={library!} />
        ) : null}
        {showSaved && activeTab === "saved" ? (
          <SavedList saved={saved!} />
        ) : null}
        {!showRecent && !showSaved && !showLibrary ? (
          <View style={{ flex: 1, padding: Spacing.lg, alignItems: "center", justifyContent: "center" }}>
            <Text style={[Type.caption, { color: colors.textSecondary, textAlign: "center" }]}>
              Search above for foods, or scan / speak / snap a photo.
            </Text>
          </View>
        ) : null}
      </View>

      {/* Footer: "Or add manually" — escape hatch for users who want
          to type macros directly. Host wires this to the manual
          quick-add form. */}
      {onAddManually ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Or add manually"
          onPress={onAddManually}
          style={({ pressed }) => [
            styles.manualFooter,
            { borderTopColor: colors.border, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <PencilLine size={IconSize.base} color={colors.textSecondary} strokeWidth={2} />
          <Text style={[Type.body, { color: colors.textSecondary, flex: 1 }]}>
            Or add manually
          </Text>
          <ChevronRight size={IconSize.base} color={colors.textTertiary} />
        </Pressable>
      ) : null}
    </>
  );
}

/* -------------------------- Right-edge icons -------------------------- */

function RightEdgeIcons({
  barcode,
  voice,
  photo,
}: {
  barcode: LogSheetProps["barcode"];
  voice: LogSheetProps["voice"];
  photo: LogSheetProps["photo"];
}) {
  const colors = useThemeColors();
  // Render the icons in the documented order: Scan → Voice → Photo
  // (matches the prior tab order to preserve user muscle memory from
  // the 6-tab era). Each icon only renders when the host wires its
  // open/start/capture callback — no callback, no icon (host has
  // opted out of that input mode).
  const icons: {
    key: "scan" | "voice" | "photo";
    label: string;
    Icon: typeof Search;
    onPress?: () => void;
    locked: boolean;
  }[] = [
    {
      key: "scan",
      label: "Scan barcode",
      Icon: ScanBarcode,
      onPress: barcode?.onOpen,
      locked: barcode?.locked ?? false,
    },
    {
      key: "voice",
      label: "Voice log",
      Icon: Mic,
      onPress: voice?.onStart,
      locked: voice?.locked ?? false,
    },
    {
      key: "photo",
      label: "Photo log",
      Icon: Camera,
      onPress: photo?.onCapture,
      locked: photo?.locked ?? false,
    },
  ];
  return (
    <View style={styles.rightEdgeIcons}>
      {icons.map(({ key, label, Icon, onPress, locked }) =>
        onPress ? (
          <Pressable
            key={key}
            onPress={() => {
              if (process.env.EXPO_OS === "ios") {
                void Haptics.selectionAsync();
              }
              onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={locked ? `${label} (Pro)` : label}
            hitSlop={6}
            style={({ pressed }) => [
              styles.rightEdgeIcon,
              { opacity: pressed ? 0.55 : 1 },
            ]}
          >
            <Icon size={IconSize.base} color={colors.textSecondary} strokeWidth={2} />
            {locked ? (
              <View style={styles.lockBadge}>
                <Lock size={8} color="#fff" strokeWidth={2.5} />
              </View>
            ) : null}
          </Pressable>
        ) : null,
      )}
    </View>
  );
}

/* -------------------------- Recent list -------------------------- */

function RecentList({ recent }: { recent: NonNullable<LogSheetProps["recent"]> }) {
  const colors = useThemeColors();
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
          <Text style={[Type.label, { color: colors.textSecondary, marginBottom: 6 }]}>
            {"Today's recents"}
          </Text>
          {today.map((e) => (
            <BrowseRow key={e.id} title={e.title} kcal={e.kcal} source={e.source} onPick={() => onPick(e)} />
          ))}
        </View>
      ) : null}
      {week.length > 0 ? (
        <View style={{ marginTop: Spacing.lg }}>
          <Text style={[Type.label, { color: colors.textSecondary, marginBottom: 6 }]}>
            Earlier this week
          </Text>
          {week.map((e) => (
            <BrowseRow key={e.id} title={e.title} kcal={e.kcal} source={e.source} onPick={() => onPick(e)} />
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

function SavedList({ saved }: { saved: NonNullable<LogSheetProps["saved"]> }) {
  const colors = useThemeColors();
  const { meals, onPick, onRequestPortion, state } = saved;

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
          accessibilityLabel={
            onRequestPortion ? `Edit portion for ${m.title}` : undefined
          }
        />
      ))}
    </ScrollView>
  );
}

/* -------------------------- Library list -------------------------- */

function LibraryList({ library }: { library: NonNullable<LogSheetProps["library"]> }) {
  const colors = useThemeColors();
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Browse recipes"
            onPress={() => {
              if (process.env.EXPO_OS === "ios") {
                void Haptics.selectionAsync();
              }
              onBrowseRecipes();
            }}
            style={({ pressed }) => [
              styles.libraryEmptyCta,
              {
                backgroundColor: Accent.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={styles.libraryEmptyCtaText}>Browse recipes</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: Spacing.xxl }}>
      {recipes.map((r) => (
        <LibraryRow key={r.id} recipe={r} onPick={() => onPick(r)} />
      ))}
    </ScrollView>
  );
}

/* -------------------------- Library row -------------------------- */

function LibraryRow({
  recipe,
  onPick,
}: {
  recipe: LogSheetLibraryRecipe;
  onPick: () => void;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Log ${recipe.title}`}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPick();
      }}
      style={({ pressed }) => [styles.resultRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      {recipe.thumbnail ? (
        // The recipe row uses a real thumbnail when one's available
        // (recipes typically have an `image_url`); falls back to the
        // shared coloured placeholder when not. <Image> is fine for
        // small (~36x36) cells -- no FastImage dependency.
        <Image
          source={{ uri: recipe.thumbnail }}
          style={[styles.resultThumb, { backgroundColor: colors.inputBg }]}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.resultThumb, { backgroundColor: colors.inputBg }]} />
      )}
      <View style={{ flex: 1, marginLeft: Spacing.sm, minWidth: 0 }}>
        <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
          {recipe.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <Text
            style={[
              Type.caption,
              { color: colors.textSecondary, fontVariant: ["tabular-nums"] },
            ]}
          >
            {recipe.kcalPerPortion} kcal
          </Text>
          {recipe.mealTag ? (
            <View
              style={[
                styles.libraryMealTag,
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.libraryMealTagText, { color: colors.textSecondary }]}>
                {recipe.mealTag}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

/* -------------------------- Browse row -------------------------- */

function BrowseRow({
  title,
  kcal,
  source,
  onPick,
  accessibilityLabel,
}: {
  title: string;
  kcal: number;
  source: SourceDotSource;
  onPick: () => void;
  /** ENG-783 — optional override (e.g. "Edit portion for X" when the
   *  tap opens the portion editor rather than logging instantly). */
  accessibilityLabel?: string;
}) {
  const colors = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `Log ${title}`}
      onPress={() => {
        if (process.env.EXPO_OS === "ios") {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPick();
      }}
      style={({ pressed }) => [styles.resultRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.resultThumb, { backgroundColor: colors.inputBg }]} />
      <View style={{ flex: 1, marginLeft: Spacing.sm }}>
        <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
          <SourceDot source={source} size={6} />
          <Text
            style={[
              Type.caption,
              { color: colors.textSecondary, marginLeft: 6, fontVariant: ["tabular-nums"] },
            ]}
          >
            {kcal} kcal
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

/* -------------------------- Skeleton -------------------------- */

function SkeletonList({ colors }: { colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ padding: Spacing.md }}>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={[styles.skeletonThumb, { backgroundColor: colors.inputBg }]} />
          <View style={{ flex: 1, marginLeft: Spacing.sm }}>
            <View style={[styles.skeletonLine, { backgroundColor: colors.inputBg, width: "65%" }]} />
            <View
              style={[
                styles.skeletonLine,
                { backgroundColor: colors.inputBg, width: "30%", marginTop: 6, height: 8 },
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
    borderRadius: 8,
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
          borderRadius: Radius.md,
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

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log it"
        onPress={() => {
          if (!onConfirm) return;
          if (process.env.EXPO_OS === "ios") {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          onConfirm({
            ...entry,
            portionGrams: Number(portion) || 100,
            kcal: Number(kcal) || 0,
            protein: Number(protein) || 0,
            carbs: Number(carbs) || 0,
            fat: Number(fat) || 0,
          });
        }}
        style={{
          height: 44,
          borderRadius: Radius.md,
          backgroundColor: Accent.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Log it</Text>
      </Pressable>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 8,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
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
    paddingVertical: 7,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    height: 48,
    borderRadius: Radius.md,
  },
  rightEdgeIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  rightEdgeIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.sm,
    position: "relative",
  },
  lockBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Accent.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  browsePillRow: {
    flexDirection: "row",
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: 3,
    borderRadius: Radius.md,
  },
  browsePill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  browsePillLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  copyYesterdayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  manualFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  skeletonThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    opacity: 0.6,
  },
  skeletonLine: {
    height: 10,
    borderRadius: 5,
    opacity: 0.6,
  },
  emptyBlock: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: Radius.md,
    paddingVertical: 32,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  libraryEmptyCta: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: Radius.md,
  },
  libraryEmptyCtaText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  libraryMealTag: {
    marginLeft: Spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  libraryMealTagText: {
    fontSize: 10,
    fontWeight: "600",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: Radius.sm,
  },
  resultThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});

export default LogSheet;
