import React from "react";
import { View, Text } from "react-native";
import { useRouter, usePathname } from "expo-router";

import { SubTabPill } from "@/components/ui/SubTabPill";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Spacing } from "@/constants/theme";

/**
 * YouSubTabHeader — segmented sub-tab pill bar shown at the top of
 * the Progress + Settings screens.
 *
 * History: shipped 2026-04-27 with three pills (Progress / Settings /
 * More) per the 6→4 tab collapse. Group G IA decision (2026-04-28,
 * `docs/decisions/2026-04-28-group-g-ia-collapse.md`) collapsed to
 * two pills — More is gone as a distinct destination; its sections
 * fold into Settings across batches B-E. The "/more" route stays
 * alive as a redirect so push-notification deep links don't break
 * mid-migration.
 *
 * Default sub-tab is Progress (story-led, per D-2026-04-27-17).
 * Settings is the canonical configuration surface (the consolidated
 * page that Batches B-E build out).
 *
 * Refactored 2026-04-28 (Next-10 #13 from the teardown doc) to use
 * the shared `<SubTabPill>` primitive. `scrollable` is on so the
 * 92pt min-pill-width that prevented squashing in the 3-pill era
 * still kicks in if a future Group G batch adds a pill back.
 *
 * Audit 2026-05-04 #22: previously the bottom-tab said "You" but the
 * top-of-screen title said "Settings" or "Progress" — a customer-lens
 * confusion ("two names for the same destination"). A small "You"
 * eyebrow above the pill ties the bottom-tab label to the segmented
 * sub-view name visually. The screen-level title still names the
 * specific sub-page (Progress / Settings).
 */
type YouTab = "progress" | "settings";

export function YouSubTabHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();

  // Group G IA Batch A (2026-04-28): treat /more as Settings for the
  // purposes of pill highlighting so the redirect from /more →
  // /settings doesn't briefly de-highlight the You tab.
  const onSettings =
    (pathname?.startsWith("/settings") ?? false) ||
    (pathname?.startsWith("/more") ?? false);

  const activeId: YouTab = onSettings ? "settings" : "progress";

  return (
    <View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 1,
          textTransform: "uppercase",
          color: colors.textTertiary,
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.sm,
          paddingBottom: 2,
        }}
        accessibilityRole="header"
      >
        You
      </Text>
      <SubTabPill<YouTab>
        items={[
          { id: "progress", label: "Progress" },
          { id: "settings", label: "Settings" },
        ]}
        activeId={activeId}
        onSelect={(id) => router.replace(`/(tabs)/${id}` as never)}
        accessibilityLabel="You sections"
        scrollable
      />
    </View>
  );
}

export default YouSubTabHeader;
