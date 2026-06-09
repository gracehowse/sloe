/**
 * "What's new in Sloe" — mobile screen.
 *
 * Entry points:
 *   1. Settings → About → "What's new" (manual).
 *   2. Auto-surface on first launch after a build-number bump (see
 *      `apps/mobile/lib/whatsNew.ts`), pushed from `_layout.tsx`.
 *
 * Content source: `src/lib/changelog/entries.ts` — shared with the
 * web page at `/whats-new`. No network fetch, no remote config.
 *
 * UX notes:
 *   - Native stack header with a "Done" button on the right that
 *     pops the screen (same navigation primitive as Meal nutrition).
 *   - The header title uses Newsreader (serifMedium) via
 *     `headerTitleStyle` so the nav bar reads editorial.
 *   - Sections render in the canonical order defined by
 *     `groupChangelogItems` (New → Fixed → Coming soon) so mobile
 *     and web agree.
 *   - Kind chips differentiate NEW / FIXED / COMING SOON with Sloe
 *     semantic colours (success sage / neutral / amber) matching the
 *     web chip treatment — not raw Tailwind colours.
 *   - Timeline view (all releases) is gated behind
 *     `whats_new_timeline_v1` flag. Default (flag off) shows only the
 *     latest entry, matching the pre-audit behaviour. Flag on mirrors
 *     the web page's scroll-through-all-releases IA.
 *   - Tester attribution is muted and sits below all sections. We
 *     never show individual tester handles — privacy rule in the
 *     task spec.
 *   - Empty-entry fallback: if the latest entry has no items (the
 *     build-N+1 placeholder), we render the header + a one-line
 *     "we're cooking something up" note instead of a blank screen.
 *   - Imagery: text-only is intentional on this surface. The changelog
 *     is a dense information surface; editorial imagery would compete
 *     with the bullet content and inflate scroll depth. The Newsreader
 *     serif title + kind chips carry the editorial register. This is
 *     a deliberate divergence from §11 imagery rules (which target
 *     recipe/meal/marketing surfaces) — not an omission.
 */
import { useLayoutEffect, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  Radius,
  Spacing,
  Type,
  FontFamily,
  Elevation,
  Accent,
} from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  changelogKindLabel,
  getAllChangelogs,
  getLatestChangelog,
  groupChangelogItems,
  type ChangelogItemKind,
} from "@suppr/shared/changelog/entries";
import {
  formatInstalledBuildLabel,
  readInstalledBuild,
} from "@/lib/installedBuild";

/**
 * Parse an ISO YYYY-MM-DD date as a local calendar date, not as UTC
 * midnight. `new Date('2026-05-12')` is UTC midnight — on any timezone
 * west of UTC it shifts back one day (e.g. TZ=America/Los_Angeles gives
 * '11 May 2026'). Splitting and passing (y, m-1, d) to the Date
 * constructor uses the local timezone, which is what a calendar label
 * always intends.
 *
 * Locale pinned to en-GB to match the web /whats-new formatter (which
 * was pinned to avoid SSR/CSR hydration mismatch). Keeping the two in
 * lockstep so a cross-link from mobile to web shows the same string.
 */
function formatReleaseDate(iso: string): string {
  // Defensive: if the ISO is malformed, fall back to the raw string
  // so the screen never errors. Tests pin ISO `YYYY-MM-DD` inputs.
  const parts = iso.split("-");
  if (parts.length !== 3) {
    // Non-YYYY-MM-DD format — fall through to the UTC path as a best-effort.
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return iso;
  // Local calendar date — no TZ shift.
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Kind chip colour mapping for the in-app Sloe semantic palette.
 *
 * Maps changelog item kinds to the locked Sloe semantic colours:
 *   NEW → success sage (`Accent.success` at 12% — the "on track" family)
 *   FIXED → neutral (textSecondary at 10% — informational, not alarming)
 *   COMING SOON → amber (`Accent.warning` at 12% — approaching/future)
 *
 * These mirror the intent of the web chip colours (emerald/sky/amber)
 * without importing Tailwind hex values — all chip colours resolve to
 * the existing Sloe palette tokens.
 */
function kindChipBg(kind: ChangelogItemKind, colors: ReturnType<typeof useThemeColors>): string {
  switch (kind) {
    case "new":
      return `rgba(94, 124, 90, 0.12)`; // Accent.success at 12%
    case "fixed":
      return colors.backgroundSecondary; // warm card neutral
    case "coming_soon":
      return `rgba(201, 137, 44, 0.12)`; // Accent.warning at 12%
  }
}

function kindChipColor(kind: ChangelogItemKind): string {
  switch (kind) {
    case "new":
      return Accent.successSolid; // #466046 — AA on white
    case "fixed":
      return Accent.primarySolid; // plum — neutral info
    case "coming_soon":
      return Accent.warningSolid; // #956619 — AA on white
  }
}

function kindChipBorderColor(kind: ChangelogItemKind): string {
  switch (kind) {
    case "new":
      return `rgba(94, 124, 90, 0.25)`;
    case "fixed":
      return `rgba(59, 42, 77, 0.15)`;
    case "coming_soon":
      return `rgba(201, 137, 44, 0.30)`;
  }
}

/** A single release entry block — header card + kind-grouped section cards. */
function ReleaseBlock({
  entry,
  isLatest,
  styles,
  colors,
  accent,
  insets,
}: {
  entry: ReturnType<typeof getLatestChangelog>;
  isLatest: boolean;
  styles: ReturnType<typeof buildStyles>;
  colors: ReturnType<typeof useThemeColors>;
  accent: ReturnType<typeof useAccent>;
  insets: { bottom: number };
}) {
  const groups = useMemo(() => groupChangelogItems(entry), [entry]);
  const buildLabel = useMemo(
    () =>
      formatInstalledBuildLabel(readInstalledBuild(), {
        appVersion: entry.appVersion,
        buildNumber: entry.buildNumber,
      }),
    [entry.appVersion, entry.buildNumber],
  );

  return (
    <View>
      {/* Header card — outer wrapper carries elevation; inner has overflow:hidden
          so border-radius clips correctly without clipping the shadow. */}
      <View style={[styles.headerCardOuter, Elevation.cardSoft]}>
        <View
          style={styles.headerCard}
          testID={isLatest ? "whats-new-header" : `whats-new-header-${entry.buildNumber}`}
        >
          <View style={styles.headerCardTitle}>
            <Text
              style={styles.buildTitle}
              testID={isLatest ? "whats-new-title" : `whats-new-title-${entry.buildNumber}`}
            >
              {buildLabel}
            </Text>
            {isLatest ? (
              <View style={styles.latestChip}>
                <Text style={styles.latestChipText}>Latest</Text>
              </View>
            ) : null}
          </View>
          <Text
            style={styles.buildMeta}
            testID={isLatest ? "whats-new-date" : `whats-new-date-${entry.buildNumber}`}
          >
            {formatReleaseDate(entry.releaseDate)}
          </Text>
          {entry.releaseTitle ? (
            <Text
              style={styles.releaseHeadline}
              testID={isLatest ? "whats-new-release-headline" : `whats-new-release-headline-${entry.buildNumber}`}
            >
              {entry.releaseTitle}
            </Text>
          ) : null}
        </View>
      </View>

      {groups.length === 0 && isLatest ? (
        <Text style={styles.emptyNote} testID="whats-new-empty">
          We&apos;re cooking up the next set of improvements. Check back after the
          next TestFlight build lands.
        </Text>
      ) : (
        groups.map((group) => {
          const heading = changelogKindLabel(group.kind);
          return (
            <View key={group.kind} style={styles.sectionGroup}>
              {/* Kind chip — coloured semantic chip matching web's treatment */}
              <View
                style={[
                  styles.kindChip,
                  {
                    backgroundColor: kindChipBg(group.kind, colors),
                    borderColor: kindChipBorderColor(group.kind),
                  },
                ]}
                testID={isLatest ? `whats-new-section-${group.kind}` : `whats-new-section-${entry.buildNumber}-${group.kind}`}
              >
                <Text
                  style={[styles.kindChipText, { color: kindChipColor(group.kind) }]}
                >
                  {heading}
                </Text>
              </View>
              {/* Section card — outer wrapper for elevation shadow */}
              <View style={[styles.sectionCardOuter, Elevation.cardSoft]}>
                <View style={styles.sectionCard}>
                  {group.items.map((item, idx) => {
                    const isLast = idx === group.items.length - 1;
                    return (
                      <View
                        key={`${group.kind}-${idx}`}
                        style={[styles.itemRow, isLast && styles.itemRowLast]}
                      >
                        <View style={[styles.bullet, { backgroundColor: kindChipColor(group.kind) }]} />
                        <Text style={styles.itemText}>{item.text}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>
          );
        })
      )}

      {entry.testerAttribution ? (
        <Text
          style={styles.attribution}
          testID={isLatest ? "whats-new-attribution" : `whats-new-attribution-${entry.buildNumber}`}
        >
          {entry.testerAttribution}
        </Text>
      ) : null}
    </View>
  );
}

/** Build the memoised StyleSheet — kept outside the component to allow
 *  typing the return value without importing `StyleSheet` types. */
function buildStyles(
  colors: ReturnType<typeof useThemeColors>,
  insets: { bottom: number },
  accent: ReturnType<typeof useAccent>,
) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: {
      paddingHorizontal: Spacing.xl,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.xxxl + insets.bottom,
      gap: Spacing.lg,
    },
    // Outer wrapper for elevation — RN overflow:hidden clips iOS shadows,
    // so the shadow lives on the outer View and border-radius on the inner.
    headerCardOuter: {
      borderRadius: Radius.lg,
    },
    headerCard: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: Spacing.lg,
      gap: Spacing.xs,
      overflow: "hidden",
    },
    headerCardTitle: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.sm,
    },
    // Build label — Newsreader (serifMedium) per §2.3:
    // "the build label is an achievement-grade headline → display-section/subtitle,
    //  Fraunces 17-22pt 600". We use Type.headline (17pt serifMedium) from the
    // token ramp, which maps to Newsreader_500Medium in this app's font stack.
    buildTitle: {
      ...Type.headline,
      fontSize: 20,
      color: colors.text,
      flex: 1,
    },
    buildMeta: { fontSize: 13, color: colors.textSecondary },
    // Release headline — on-scale marginTop (Spacing.xs = 4) replacing raw 6.
    releaseHeadline: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
      lineHeight: 18,
    },
    // "Latest" chip — damson/plum soft chip (win family, achievement register)
    latestChip: {
      backgroundColor: `rgba(106, 75, 122, 0.12)`,
      borderRadius: Radius.full,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderWidth: 1,
      borderColor: `rgba(106, 75, 122, 0.25)`,
    },
    latestChipText: {
      ...Type.label,
      fontSize: 10,
      color: Accent.purple,
    },
    sectionGroup: {
      gap: Spacing.sm,
    },
    // Kind chip — section label as a coloured chip (not bare uppercase text).
    // §2.6 section-eyebrow token: Inter 10-11pt, weight 600, +0.08em tracking.
    // Chip shape adds colour differentiation matching web's semantic chips.
    kindChip: {
      alignSelf: "flex-start",
      borderRadius: Radius.md,
      borderWidth: 1,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
    },
    kindChipText: {
      fontFamily: FontFamily.sansSemibold,
      fontSize: 11,
      fontWeight: "600",
      letterSpacing: 0.88, // 11pt × 0.08em — section-eyebrow token
      textTransform: "uppercase",
      lineHeight: 16,
    },
    // Outer wrapper for elevation (same pattern as headerCardOuter)
    sectionCardOuter: {
      borderRadius: Radius.lg,
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
      // On-scale: Spacing.md (16) for comfortable reading rhythm
      // (up from raw 12 which was off the 4pt grid).
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.lg,
      // On-scale: Spacing.sm (8) replaces raw 10.
      gap: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    itemRowLast: { borderBottomWidth: 0 },
    bullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      // On-scale: first-line cap-height alignment.
      // body-primary (15pt, lineHeight 22): cap-height ≈ 10pt, so
      // (lineHeight - capHeight) / 2 ≈ 6 → round to Spacing.xs (4) for
      // top-of-line alignment. Raw 7 was off-scale.
      marginTop: Spacing.xs,
    },
    itemText: {
      flex: 1,
      fontSize: 15,
      // On-scale: body-primary token lineHeight (22) from §2.2
      lineHeight: 22,
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
    // Timeline separator between release blocks (flag-on path only).
    releaseSeparator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.border,
      marginVertical: Spacing.md,
    },
  });
}

export default function WhatsNewScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const goBack = useSafeBack("/(tabs)");
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else plum) for the "Done" CTA.
  const accent = useAccent();

  // Timeline flag: when on, show all releases in a scrolling timeline
  // (mirrors web /whats-new IA). Flag off (default) shows only the
  // latest entry — the pre-audit behaviour.
  const showTimeline = isFeatureEnabled("whats_new_timeline_v1");

  const latestEntry = useMemo(() => getLatestChangelog(), []);
  const allEntries = useMemo(
    () =>
      showTimeline
        ? getAllChangelogs().filter((e) => e.items.length > 0)
        : [latestEntry],
    [showTimeline, latestEntry],
  );

  const styles = useMemo(
    () => buildStyles(colors, insets, accent),
    [colors, insets, accent],
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      title: "What's new",
      // §2.3: screen H1 in serif. Apply Newsreader (serifMedium) to the
      // native nav bar title so the header reads "editorial cookbook".
      // Georgia is the iOS system-serif fallback if Newsreader hasn't
      // loaded yet (confirmed in sim capture — font load is async).
      headerTitleStyle: {
        ...Type.headline,
        fontSize: 18,
        color: colors.text,
      },
      headerRight: () => (
        <Pressable
          onPress={goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Done"
          style={{ paddingHorizontal: Spacing.md }}
        >
          <Text style={{ fontSize: 16, fontWeight: "600", color: accent.primary }}>
            Done
          </Text>
        </Pressable>
      ),
    });
  }, [navigation, goBack, accent, colors]);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {allEntries.map((entry, idx) => (
          <View key={entry.buildNumber}>
            {idx > 0 ? <View style={styles.releaseSeparator} /> : null}
            <ReleaseBlock
              entry={entry}
              isLatest={idx === 0}
              styles={styles}
              colors={colors}
              accent={accent}
              insets={insets}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
