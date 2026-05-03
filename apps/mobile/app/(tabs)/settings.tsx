import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, LogOut, Search } from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { supabase } from "@/lib/supabase";
import { Radius, Spacing } from "@/constants/theme";
import { YouSubTabHeader } from "@/components/tabs/YouSubTabHeader";
import { SettingsBundleContent } from "@/components/settings/SettingsBundleContent";
import { filterSettingsIndex } from "@/lib/settingsSearchIndex";

/**
 * `/(tabs)/settings` — single source of truth for Settings.
 *
 * Pre-2026-05-01 the screen rendered TWO settings shells stacked: a
 * legacy in-file set of sections (Plan / Appearance / Account / Body
 * & activity / Journal display / Notifications / Tracking extras /
 * About / Data) AND the canonical `<SettingsBundleContent>` directly
 * underneath. Same Sign Out twice, same Export rows twice, three
 * inconsistent visual languages on one scroll. The
 * `claude/settings-mobile-structural-fix` audit (2026-05-01) collapsed
 * to a single shell:
 *
 *   1. `<YouSubTabHeader>`             — Progress / Settings pills.
 *   2. Title + sub                     — "Settings" / one-line subhead.
 *   3. Search input                    — pinned to the top of scroll.
 *   4. `<SettingsBundleContent>`       — canonical body (Profile,
 *      Stats, Membership, Goals & targets, Display & extras,
 *      Connections, Recipes, App, Legal, Build, Danger zone).
 *   5. Single neutral Sign Out row     — beneath the bundle.
 *
 * The bundle absorbed every legacy in-file feature the user could
 * reach: tracking extras (Display & extras), Manage subscription +
 * promo-code redemption (Membership). Anything else routes to
 * /targets, /notifications, /health-sync or hangs off the bundle's
 * existing rows.
 *
 * Search behaviour: when the query is non-empty we hide the bundle
 * entirely and show an empty-state row. This is intentionally honest
 * — the bundle owns its own section structure (it's also rendered on
 * `/more` as a redirect target) so we don't try to filter inside it.
 * If/when in-bundle filter ships, the gate moves there.
 */
export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const colors = useThemeColors();

  // Wave-2 (2026-04-30 audit-vs-competitors) — Settings search.
  // Empty query shows the canonical bundle body. Non-empty query
  // runs the filter against the routable settings index
  // (`apps/mobile/lib/settingsSearchIndex.ts`); matched rows are
  // shown directly, no-match falls back to the empty-state copy.
  // Search is intentional, not sticky — cleared on tab navigation
  // away by the parent navigator.
  //
  // 2026-05-02 (Build 40 outstanding feedback): pre-fix, ANY
  // non-empty query showed "No matches" because the gate hid the
  // entire bundle without filtering. Typing "fast" — even though
  // the user has a fasting pill on Today and a /fasting screen —
  // returned a dead-end. The keyword index (Fasting, Daily targets,
  // Notifications, Apple Health, …) closes that gap; a tap on a
  // search result routes to the destination screen.
  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim();
  const searchResults = useMemo(
    () => filterSettingsIndex(trimmedQuery),
    [trimmedQuery],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        scrollContent: {
          paddingHorizontal: Spacing.xl,
          paddingBottom: 120,
          gap: Spacing.md,
        },
        title: { fontSize: 22, fontWeight: "700", color: colors.text },
        sub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
        muted: { color: colors.textSecondary, paddingHorizontal: Spacing.xl },
      }),
    [colors],
  );

  if (!userId) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.muted}>Sign in to manage settings.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <YouSubTabHeader />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.sub}>Plan, targets, and how the app shows up.</Text>

        {/* Search — sticks at the top of the ScrollView. The bundle
            owns its own section structure and is hidden when the
            query is non-empty so the filter result stays honest. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 10,
            backgroundColor: colors.card,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 8,
          }}
        >
          {/* P0-3 (2026-05-01) — lucide Search. Replaces the emoji
              magnifying-glass character which rendered fuzzy +
              off-vertical against the search input baseline. */}
          <Search size={16} color={colors.textTertiary} strokeWidth={1.75} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search settings"
            placeholderTextColor={colors.textTertiary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            accessibilityLabel="Search settings"
            testID="settings-search-input"
            style={{
              flex: 1,
              color: colors.text,
              fontSize: 15,
              paddingVertical: 0,
            }}
          />
          {searchQuery.length > 0 ? (
            <Pressable
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={8}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: 13,
                  fontWeight: "600",
                }}
              >
                Clear
              </Text>
            </Pressable>
          ) : null}
        </View>

        {trimmedQuery === "" ? (
          <>
            <SettingsBundleContent context="settings" />
            {/* Single neutral Sign Out row beneath the bundle. Sign
                Out is reversible — red is reserved for irreversible
                actions like Delete Account. (P1-5,
                `claude/settings-mobile-structural-fix` 2026-05-01.) */}
            <Pressable
              testID="settings-sign-out-row"
              onPress={() => void supabase.auth.signOut()}
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 16,
                paddingHorizontal: 16,
                marginTop: 22,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.card,
              }}
            >
              <Text
                style={{ color: colors.text, fontSize: 15, fontWeight: "600" }}
              >
                Sign Out
              </Text>
              <LogOut
                size={18}
                color={colors.textTertiary}
                strokeWidth={1.75}
              />
            </Pressable>
          </>
        ) : searchResults.length > 0 ? (
          /* Search results — only routable destinations are indexed
             today (see `lib/settingsSearchIndex.ts` for the
             rationale). Each match links straight to a full-screen
             config surface so a tap from the search result is a
             real tap-to-configure path, not a dead end. */
          <View
            testID="settings-search-results"
            style={{
              backgroundColor: colors.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              marginTop: 8,
            }}
          >
            {searchResults.map((entry, idx) => (
              <Pressable
                key={entry.id}
                testID={`settings-search-result-${entry.id}`}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                onPress={() => router.push(entry.route as never)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 14,
                  paddingHorizontal: 14,
                  borderTopWidth: idx === 0 ? 0 : 1,
                  borderTopColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "600",
                      color: colors.text,
                      lineHeight: 18,
                    }}
                  >
                    {entry.label}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 2,
                      lineHeight: 16,
                    }}
                    numberOfLines={2}
                  >
                    {entry.section} · {entry.sub}
                  </Text>
                </View>
                <ChevronRight
                  size={16}
                  color={colors.textTertiary}
                  strokeWidth={1.75}
                />
              </Pressable>
            ))}
          </View>
        ) : (
          <Text
            testID="settings-search-empty"
            style={{
              color: colors.textSecondary,
              fontSize: 14,
              textAlign: "center",
              marginTop: 24,
              paddingHorizontal: 16,
            }}
          >
            No matches for &quot;{trimmedQuery}&quot; — try a different word.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
