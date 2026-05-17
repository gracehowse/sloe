/**
 * FoodSearchModal — full-screen page-sheet for food search.
 *
 * As of 2026-04-30 (customer-lens nested-modal teardown), the modal
 * is a thin wrapper that mounts the shared `<FoodSearchPanel>` body.
 * The modal owns:
 *   - the iOS page-sheet `<Modal>` shell
 *   - the search `<TextInput>` (autoFocus on open)
 *   - the close button + header
 *
 * Everything else — debounced search, results list, pagination,
 * preview portion picker + fit-this-in, custom-foods CRUD — lives
 * in `apps/mobile/components/food-search/FoodSearchPanel.tsx`.
 *
 * The same panel is mounted inline by `<LogSheet>` so the user can
 * type-and-see-results without a second modal animation. See the
 * panel's docstring for the why.
 *
 * Call sites preserved (no changes needed):
 *   - `app/(tabs)/index.tsx` — Today, with budget context (fit-this-in
 *      lights up).
 *   - `app/(tabs)/discover.tsx`, `app/(tabs)/search.tsx` — discovery.
 *   - `app/recipe/verify.tsx`, `app/create-recipe.tsx`,
 *      `app/import-shared.tsx` — verify-ingredient.
 *
 * Web mirror: `src/app/components/suppr/FoodSearch.tsx` (the inline
 * lift on web is a separate follow-up commit — flagged in the PR).
 */
import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  Camera as CameraIcon,
  Mic as MicIcon,
  ScanBarcode,
  ScanLine,
  Search as SearchIcon,
  X,
} from "lucide-react-native";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import KeyboardSafeView from "./KeyboardSafeView";
import FoodSearchPanel, {
  type SelectedFood as PanelSelectedFood,
  type SupabaseLike,
} from "./food-search/FoodSearchPanel";
import type { MacroConsumed, MacroTargets } from "@suppr/shared/nutrition/remainingMacros";

/** Re-exported for backwards compat with existing call sites that
 *  imported `SelectedFood` from this module path. */
export type SelectedFood = PanelSelectedFood;

type Props = {
  visible: boolean;
  initialQuery: string;
  initialAmount?: number | null;
  initialUnit?: string | null;
  originalDescription?: string | null;
  macroTargets?: MacroTargets;
  macroConsumed?: MacroConsumed;
  supabase?: SupabaseLike;
  userId?: string | null;
  onSelect: (result: SelectedFood) => void;
  onClose: () => void;
  /**
   * F-128 (Grace, 2026-05-07): "we need to be able to add ingredients
   * by barcode etc (same ways we log food)". When wired, the modal
   * renders quick-add icons in the header so the user can pivot to
   * scan / voice / photo without first dismissing the search sheet.
   * Each callback fires through to the host — the host is responsible
   * for closing this modal (if appropriate) and opening the dedicated
   * sheet. Pass `null`/omit to hide the icon.
   */
  onScanBarcode?: () => void;
  onVoiceLog?: () => void;
  onPhotoLog?: () => void;
  /**
   * 2026-05-12 round 5 (premium-bar audit #12): pass-through to the
   * underlying FoodSearchPanel. When provided, the modal's empty-query
   * state renders "Recent" — last 5 logged foods, tap to log. Hosts
   * that don't have a foodHistory hydrated can omit.
   */
  recentFoods?: Array<{
    recipeTitle: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber?: number;
    source?: string;
  }>;
};

export default function FoodSearchModal({
  visible,
  initialQuery,
  initialAmount,
  initialUnit,
  originalDescription,
  macroTargets,
  macroConsumed,
  supabase,
  userId,
  onSelect,
  onClose,
  onScanBarcode,
  onVoiceLog,
  onPhotoLog,
  recentFoods,
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const hasQuickAdd = !!(onScanBarcode || onVoiceLog || onPhotoLog);
  // 2026-05-14 premium-bar polish #1: inline ScanLine glyph at the
  // right of the input as a low-friction barcode entry point. Only
  // surfaces when (a) the query is empty (the user hasn't started
  // typing) AND (b) the host has NOT wired its own onScanBarcode
  // quick-add icon — otherwise we'd render two barcode affordances
  // in the same row. Tap navigates directly to the barcode tab via
  // expo-router (the canonical scanner surface).
  const showInlineBarcodeShortcut = !query.trim() && !onScanBarcode;

  // On open, sync query → initialQuery so callers that re-mount with a
  // different initialQuery (e.g. recipe-verify) get the right starting
  // search. Closing leaves the state alone (no re-render churn).
  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
    }
  }, [visible, initialQuery]);

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.md,
    },
    title: { fontSize: 18, fontWeight: "700", color: colors.text },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: Spacing.xl,
      backgroundColor: colors.card,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    searchIcon: { marginRight: Spacing.sm },
    searchInput: {
      flex: 1,
      color: colors.text,
      fontSize: 16,
      paddingVertical: 14,
    },
    quickAddDivider: {
      width: 1,
      alignSelf: "stretch",
      marginVertical: 10,
      marginHorizontal: 6,
      backgroundColor: colors.border,
    },
    quickAddBtn: {
      paddingHorizontal: 8,
      paddingVertical: 10,
      alignItems: "center",
      justifyContent: "center",
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardSafeView
        scroll={false}
        dismissOnBackgroundTap={false}
        style={[styles.container, { paddingTop: insets.top + 8 }]}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Search Foods</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close search">
            <X size={24} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <SearchIcon size={18} color={colors.textTertiary} style={styles.searchIcon} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search foods..."
            placeholderTextColor={colors.textTertiary}
            style={styles.searchInput}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search foods"
          />
          {/* 2026-05-14 premium-bar polish #1: inline ScanLine glyph.
              Hidden once the user types so the input chrome doesn't
              compete with the keyboard, and suppressed if the host
              already supplies its own onScanBarcode quick-add icon to
              avoid two barcode affordances side-by-side. */}
          {showInlineBarcodeShortcut ? (
            <Pressable
              onPress={() => router.push("/(tabs)/barcode")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Scan a barcode"
              testID="food-search-inline-barcode"
              style={{ paddingHorizontal: 8, paddingVertical: 10 }}
            >
              <ScanLine size={18} color={colors.textSecondary} />
            </Pressable>
          ) : null}
          {/* F-128 quick-add row — mirrors LogSheet's right-edge input
              modes so the recipe-ingredient flow has the same "scan /
              voice / photo" affordances the food-log flow does. Each
              icon is host-controlled; we don't render any icon whose
              callback isn't wired. */}
          {hasQuickAdd ? (
            <>
              <View style={styles.quickAddDivider} />
              {onScanBarcode ? (
                <Pressable
                  onPress={onScanBarcode}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Scan barcode to add ingredient"
                  testID="food-search-scan-barcode"
                  style={styles.quickAddBtn}
                >
                  <ScanBarcode size={20} color={Accent.primary} strokeWidth={1.75} />
                </Pressable>
              ) : null}
              {onVoiceLog ? (
                <Pressable
                  onPress={onVoiceLog}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Voice log to add ingredient"
                  testID="food-search-voice-log"
                  style={styles.quickAddBtn}
                >
                  <MicIcon size={20} color={Accent.primary} strokeWidth={1.75} />
                </Pressable>
              ) : null}
              {onPhotoLog ? (
                <Pressable
                  onPress={onPhotoLog}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Photo log to add ingredient"
                  testID="food-search-photo-log"
                  style={styles.quickAddBtn}
                >
                  <CameraIcon size={20} color={Accent.primary} strokeWidth={1.75} />
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>

        <FoodSearchPanel
          query={query}
          initialAmount={initialAmount}
          initialUnit={initialUnit}
          originalDescription={originalDescription}
          macroTargets={macroTargets}
          macroConsumed={macroConsumed}
          supabase={supabase}
          userId={userId}
          onSelect={onSelect}
          mode="full"
          recentFoods={recentFoods}
        />
      </KeyboardSafeView>
    </Modal>
  );
}
