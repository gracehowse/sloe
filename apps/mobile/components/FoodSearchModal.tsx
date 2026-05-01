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
import { Search as SearchIcon, X } from "lucide-react-native";
import { Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import KeyboardSafeView from "./KeyboardSafeView";
import FoodSearchPanel, {
  type SelectedFood as PanelSelectedFood,
  type SupabaseLike,
} from "./food-search/FoodSearchPanel";
import type { MacroConsumed, MacroTargets } from "../../../src/lib/nutrition/remainingMacros";

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
}: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const [query, setQuery] = useState(initialQuery);

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
        />
      </KeyboardSafeView>
    </Modal>
  );
}
