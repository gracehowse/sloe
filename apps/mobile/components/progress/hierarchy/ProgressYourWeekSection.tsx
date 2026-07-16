import { useCallback } from "react";
import { Platform, Share, Text, View } from "react-native";
import { Share2 } from "lucide-react-native";

import { SupprCard } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { HierarchyOverline } from "@/components/progress/hierarchy/HierarchyOverline";
import { FontFamily, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

/**
 * ENG-1525 §5 — Your Week. The digest's editorial layer only: a serif
 * verdict sentence (the host's `resolveDigestHeadline` output) + ONE
 * net-new texture line + a ghost Share. NO restated avg/streak numerals —
 * those live in §2.
 *
 * Composition note: the Digest component itself is NOT mounted here — its
 * mount fires `weekly_recap_shown` once per weekKey, and §5 renders far
 * more often than the recap window, which would silently inflate that
 * metric (seam hazard). This section instead composes from the same
 * `resolveDigestHeadline` / `buildDigestWeekView` outputs, passed as
 * props, and deliberately does NOT emit `weekly_recap_shown` (that event
 * stays owned by the Digest card, which remains legacy-branch-only).
 * Share ownership mirrors Digest exactly: this component fires
 * `weekly_recap_shared` and opens the RN share sheet itself; the host's
 * `onShare` stays a hook, not the owner.
 *
 * Texture-line priority: the usual-meal insight (host-built) wins, else
 * the closest-to-target best day from `buildDigestWeekView`. One line,
 * never both.
 */
export interface ProgressYourWeekSectionProps {
  /** `recap.weekKey` — the analytics + share anchor. */
  weekKey: string;
  /** `resolveDigestHeadline(...)` output — the serif verdict sentence. */
  headline: string;
  /** Host-built usual-meal line (from `buildUsualMealRecapInsight`), if any. */
  usualMealLine?: string | null;
  /** `recap.bestDay` — the closest-to-target day. */
  bestDay: { label: string; protein: number; calories: number } | null;
  /** `formatRecapForShare(recap)` — the share sheet body. */
  shareText: string;
  /** Optional host hook, fired alongside the owned share analytics
   *  (mirrors Digest, where the host's onShare is a no-op). */
  onShare?: () => void;
}

export function ProgressYourWeekSection({
  weekKey,
  headline,
  usualMealLine,
  bestDay,
  shareText,
  onShare,
}: ProgressYourWeekSectionProps) {
  const colors = useThemeColors();

  const handleShare = useCallback(async () => {
    track(AnalyticsEvents.weekly_recap_shared, { weekKey, platform: Platform.OS });
    onShare?.();
    try {
      await Share.share({ message: shareText });
    } catch {
      /* user cancelled */
    }
  }, [weekKey, shareText, onShare]);

  const textureLine =
    usualMealLine ??
    (bestDay ? `Closest to target: ${bestDay.label} — ${bestDay.protein}g protein` : null);

  return (
    <SupprCard testID="progress-hierarchy-your-week" lift="soft" padding="lg">
      <HierarchyOverline testID="progress-hierarchy-your-week-overline">Your week</HierarchyOverline>

      {/* Serif verdict — an editorial sentence, not a stat readout. */}
      <Text
        testID="progress-hierarchy-your-week-verdict"
        style={{ ...Type.title, color: colors.text }}
      >
        {headline}
      </Text>

      {textureLine ? (
        <Text
          testID="progress-hierarchy-your-week-texture"
          style={{
            fontFamily: FontFamily.serifItalic,
            fontSize: Type.captionStrong.fontSize,
            lineHeight: Type.captionStrong.lineHeight,
            color: colors.textSecondary,
            marginTop: Spacing.sm,
          }}
        >
          {textureLine}
        </Text>
      ) : null}

      <SupprButton
        variant="ghost"
        testID="progress-hierarchy-your-week-share"
        accessibilityLabel="Share your week"
        onPress={() => void handleShare()}
        style={{ marginTop: Spacing.md, alignSelf: "center", paddingVertical: Spacing.dense, paddingHorizontal: Spacing.md }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <Share2 size={16} color={colors.navPrimary} strokeWidth={1.75} />
          <Text style={{ ...Type.button, color: colors.navPrimary }}>Share</Text>
        </View>
      </SupprButton>
    </SupprCard>
  );
}

export default ProgressYourWeekSection;
