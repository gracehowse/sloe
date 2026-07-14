import { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarClearance } from "@/hooks/useTabBarClearance";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, LogOut, Search } from "lucide-react-native";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { supabase } from "@/lib/supabase";
import { Radius, Spacing, Type } from "@/constants/theme";
import { YouSubTabHeader } from "@/components/tabs/YouSubTabHeader";
import { SettingsBundleContent } from "@/components/settings/SettingsBundleContent";
import { DevFlagOverrides } from "@/components/settings/DevFlagOverrides";
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
 *   1. Title + sub                     — "Settings" / one-line subhead.
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
  // ENG-1247 — frosted tab bar overlays scroll content; pad to clear it.
  const tabBarHeight = useTabBarClearance();
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
        // Headers census 2026-06-10 (owner call): left-aligned like every
        // other stack header — the Figma 335:2 dead-centre layout was the
        // app's only centred title and read as drift once the system
        // unified on left serif. Serif + navPrimary stay.
        title: { ...Type.title, color: colors.navPrimary, marginLeft: Spacing.xs },
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
      {/* Top bar — Sloe DS (Figma 09 Settings `335:2`): back chevron on
          the left, "Settings" centered in Newsreader serif plum, with a
          balancing spacer on the right so the title sits dead-centre. No
          subtitle (the profile row below makes context immediately
          visible — the cold subtitle is removed). */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: Spacing.lg,
          // DRIFT-11 fix (2026-05-22): bumped from Spacing.sm to
          // Spacing.md so the Settings header carries the same top
          // breathing room as Discover / Plan / Progress.
          paddingTop: Spacing.md,
          paddingBottom: Spacing.xs,
        }}
      >
        <PressableScale
          haptic="selection"
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)" as never);
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={{ padding: 4, width: 30 }}
        >
          <ChevronLeft size={22} color={colors.text} strokeWidth={2} />
        </PressableScale>
        <Text style={[styles.title, { flex: 1 }]} accessibilityRole="header">
          Settings
        </Text>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: tabBarHeight + Spacing.xl }]}
      >
        {/* Search — sticks at the top of the ScrollView. The bundle
            owns its own section structure and is hidden when the
            query is non-empty so the filter result stays honest. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.dense,
            backgroundColor: colors.card,
            // Sloe reskin: pill search field (was Radius.md 6px) so it
            // reads as a soft Sloe input, not a boxy form field.
            borderRadius: Radius.xl,
            borderWidth: 1,
            borderColor: colors.border,
            gap: Spacing.sm,
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
              ...Type.bodyLarge,
              paddingVertical: 0,
            }}
          />
          {searchQuery.length > 0 ? (
            <PressableScale
              haptic="selection"
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
            </PressableScale>
          ) : null}
        </View>

        {trimmedQuery === "" ? (
          <>
            <SettingsBundleContent context="settings" />
            {/* Single neutral Sign Out row beneath the bundle. Sign
                Out is reversible — red is reserved for irreversible
                actions like Delete Account. (P1-5,
                `claude/settings-mobile-structural-fix` 2026-05-01.) */}
            <PressableScale
              haptic="selection"
              testID="settings-sign-out-row"
              onPress={() =>
                // ENG-1517 — confirm before ending the session. Sign Out sits
                // directly below the destructive Delete-account control, so an
                // instant no-confirm sign-out is a hazardous mis-tap. Not
                // styled destructive (Sign Out is reversible), just gated.
                Alert.alert(
                  "Sign out?",
                  "You'll need to sign in again to get back to your plan.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Sign Out",
                      onPress: () => void supabase.auth.signOut(),
                    },
                  ],
                )
              }
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: Spacing.md,
                paddingHorizontal: Spacing.md,
                marginTop: Spacing.xl,
                // Sloe warm-slab corner (was 14) — matches the section
                // cards so the lone Sign Out row reads as one of them.
                borderRadius: CARD_RADIUS,
                borderWidth: StyleSheet.hairlineWidth,
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
            </PressableScale>
            {/* Dev-only flag-force panel (ENG-840). Renders null in
                release builds — preview flag-gated UI on device/sim
                without a PostHog ramp. */}
            <DevFlagOverrides />
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
              // Sloe warm-slab corner (was 14) — matches the section cards.
              borderRadius: CARD_RADIUS,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: "hidden",
              marginTop: 8,
            }}
          >
            {searchResults.map((entry, idx) => (
              <PressableScale
                key={entry.id}
                haptic="selection"
                testID={`settings-search-result-${entry.id}`}
                accessibilityRole="button"
                accessibilityLabel={entry.label}
                onPress={() => router.push(entry.route as never)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: Spacing.dense,
                  paddingHorizontal: Spacing.md,
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
                      ...Type.captionSmall,
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
              </PressableScale>
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
