/**
 * "What's new in Suppr" — mobile screen.
 *
 * Entry points:
 *   1. Settings → About → "What's new in Suppr" (manual).
 *   2. Auto-surface on first launch after a build-number bump (see
 *      `apps/mobile/lib/whatsNew.ts`), pushed from `_layout.tsx`.
 *
 * Content source: `src/lib/changelog/entries.ts` — shared with the
 * web page at `/whats-new`. No network fetch, no remote config.
 *
 * UX notes:
 *   - Native stack header with a "Done" button on the right that
 *     pops the screen (same navigation primitive as Meal nutrition).
 *   - Sections render in the canonical order defined by
 *     `groupChangelogItems` (New → Fixed → Coming soon) so mobile
 *     and web agree.
 *   - Tester attribution is muted and sits below all sections. We
 *     never show individual tester handles — privacy rule in the
 *     task spec.
 *   - Empty-entry fallback: if the latest entry has no items (the
 *     build-N+1 placeholder), we render the header + a one-line
 *     "we're cooking something up" note instead of a blank screen.
 */
import { useLayoutEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Accent, Radius, Spacing } from "@/constants/theme";
import {
  changelogKindLabel,
  getLatestChangelog,
  groupChangelogItems,
} from "../../../src/lib/changelog/entries";

function formatReleaseDate(iso: string): string {
  // Defensive: if the ISO is malformed, fall back to the raw string
  // so the screen never errors. Tests pin ISO `YYYY-MM-DD` inputs.
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function WhatsNewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const goBack = useSafeBack("/(tabs)");
  const colors = useThemeColors();

  const entry = useMemo(() => getLatestChangelog(), []);
  const groups = useMemo(() => groupChangelogItems(entry), [entry]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "What's new",
      headerRight: () => (
        <Pressable
          onPress={goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={{ paddingHorizontal: Spacing.md }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: Accent.primary }}>
            Done
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, goBack]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: colors.background },
        scroll: {
          paddingHorizontal: Spacing.xl,
          paddingTop: Spacing.lg,
          paddingBottom: Spacing.xxxl + insets.bottom,
          gap: Spacing.lg,
        },
        headerCard: {
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          padding: Spacing.lg,
          gap: 4,
        },
        buildTitle: { fontSize: 20, fontWeight: "700", color: colors.text },
        buildMeta: { fontSize: 13, color: colors.textSecondary },
        sectionHeading: {
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 1.1,
          textTransform: "uppercase",
          color: colors.textSecondary,
          marginTop: Spacing.sm,
          marginBottom: 8,
        },
        sectionCard: {
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.card,
          overflow: "hidden",
        },
        itemRow: {
          flexDirection: "row",
          alignItems: "flex-start",
          paddingVertical: 12,
          paddingHorizontal: Spacing.lg,
          gap: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        itemRowLast: { borderBottomWidth: 0 },
        bullet: {
          width: 6,
          height: 6,
          borderRadius: 3,
          marginTop: 7,
          backgroundColor: Accent.primary,
        },
        itemText: {
          flex: 1,
          fontSize: 15,
          lineHeight: 21,
          color: colors.text,
        },
        attribution: {
          fontSize: 12,
          lineHeight: 18,
          color: colors.textTertiary,
          marginTop: Spacing.sm,
          textAlign: "center",
        },
        emptyNote: {
          fontSize: 14,
          lineHeight: 21,
          color: colors.textSecondary,
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.md,
          paddingBottom: Spacing.lg,
        },
      }),
    [colors, insets.bottom],
  );

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard} testID="whats-new-header">
          <Text style={styles.buildTitle} testID="whats-new-title">
            {`Build ${entry.buildNumber} (${entry.appVersion} #${entry.buildNumber})`}
          </Text>
          <Text style={styles.buildMeta} testID="whats-new-date">
            {formatReleaseDate(entry.releaseDate)}
          </Text>
        </View>

        {groups.length === 0 ? (
          <Text style={styles.emptyNote} testID="whats-new-empty">
            We&apos;re cooking up the next set of improvements. Check back after the
            next TestFlight build lands.
          </Text>
        ) : (
          groups.map((group) => {
            const heading = changelogKindLabel(group.kind);
            return (
              <View key={group.kind}>
                <Text style={styles.sectionHeading} testID={`whats-new-section-${group.kind}`}>
                  {heading}
                </Text>
                <View style={styles.sectionCard}>
                  {group.items.map((item, idx) => {
                    const isLast = idx === group.items.length - 1;
                    return (
                      <View
                        key={`${group.kind}-${idx}`}
                        style={[styles.itemRow, isLast && styles.itemRowLast]}
                      >
                        <View style={styles.bullet} />
                        <Text style={styles.itemText}>{item.text}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })
        )}

        {entry.testerAttribution ? (
          <Text style={styles.attribution} testID="whats-new-attribution">
            {entry.testerAttribution}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
