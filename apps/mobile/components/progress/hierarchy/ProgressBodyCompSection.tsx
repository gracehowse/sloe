import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Lock } from "lucide-react-native";

import { SupprCard } from "@/components/ui/SupprCard";
import { SupprButton } from "@/components/ui/SupprButton";
import { HierarchyOverline } from "@/components/progress/hierarchy/HierarchyOverline";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { authedFetch } from "@/lib/authedFetch";
import { getSupprApiBase } from "@/lib/supprWeb";
import type { CachedTier } from "@/lib/cachedUserTier";
import type { BodyCompositionTrendCopy } from "@suppr/shared/progress/bodyCompositionTrends";

/**
 * ENG-1525 §4 — Body composition. Absorbs BodyCompositionTrendCard with the
 * delta-2 hard rule: the user's OWN latest values (body fat %, lean mass)
 * always render free when present — only the TREND layer (chart + 90-day
 * deltas + analysis) is Pro-gated.
 *
 *  - Free, has data → values + a masked illustrative mini-trend shape behind
 *    a lock + ghost "See Pro plans" (`onOpenPaywall`).
 *  - Free, no data  → teaser copy + ghost "See Pro plans".
 *  - Pro            → real trend content (same
 *    `/api/progress/body-composition-trends` fetch the legacy card owns,
 *    re-keyed by `refreshKey` so the host's refresh wiring carries over).
 *
 * The masked mini-trend is a FIXED illustrative path (never derived from the
 * user's data) — it teases the feature's shape without claiming a trend the
 * free tier hasn't unlocked.
 */
export interface ProgressBodyCompSectionProps {
  userTier: CachedTier;
  /** User-owned latest values (HealthKit / manual) — free-visible. */
  latestBodyFatPct: number | null;
  latestLeanMassKg: number | null;
  onOpenPaywall: () => void;
  /** Bump to re-fetch the Pro trend payload (bodyCompositionRefreshKey). */
  refreshKey?: number;
}

export function ProgressBodyCompSection({
  userTier,
  latestBodyFatPct,
  latestLeanMassKg,
  onOpenPaywall,
  refreshKey = 0,
}: ProgressBodyCompSectionProps) {
  const colors = useThemeColors();
  const accent = useAccent();
  const isPro = userTier === "pro";
  const [copy, setCopy] = useState<BodyCompositionTrendCopy | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!isPro) {
      setCopy(null);
      return;
    }
    const base = getSupprApiBase();
    if (!base) {
      setCopy(null);
      return;
    }
    void authedFetch(`${base}/api/progress/body-composition-trends`)
      .then(async (res) => {
        if (!res.ok) return null;
        const payload = (await res.json()) as { trends?: BodyCompositionTrendCopy };
        return payload.trends ?? null;
      })
      .then((trends) => {
        if (!cancelled) setCopy(trends);
      })
      .catch(() => {
        if (!cancelled) setCopy(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isPro, refreshKey]);

  // Latest values: prefer the host-plumbed user-owned readings; a Pro trend
  // payload can fill a gap but never overrides a fresher local value.
  const bodyFat = latestBodyFatPct ?? (isPro ? copy?.bodyFat.current ?? null : null);
  const leanMass = latestLeanMassKg ?? (isPro ? copy?.leanMass.current ?? null : null);
  const hasValues = bodyFat != null || leanMass != null;

  return (
    <SupprCard testID="progress-hierarchy-body-comp" lift="soft" padding="lg">
      <HierarchyOverline testID="progress-hierarchy-body-comp-overline">
        {isPro ? "Body composition" : "Body composition · Pro"}
      </HierarchyOverline>

      {/* Delta 2 — the user's own values render for EVERY tier when present. */}
      {hasValues ? (
        <View style={{ flexDirection: "row", marginBottom: Spacing.dense }} testID="progress-hierarchy-body-comp-values">
          <ValueColumn
            label="Body fat"
            display={bodyFat != null ? `${bodyFat}%` : "—"}
            deltaLabel={isPro ? copy?.bodyFat.deltaLabel ?? null : null}
            style={{ flex: 1 }}
          />
          <View style={{ width: 1, backgroundColor: colors.cardBorder, marginHorizontal: Spacing.md }} />
          <ValueColumn
            label="Lean mass"
            display={leanMass != null ? `${leanMass} kg` : "—"}
            deltaLabel={isPro ? copy?.leanMass.deltaLabel ?? null : null}
            style={{ flex: 1 }}
          />
        </View>
      ) : null}

      {isPro ? (
        !hasValues ? (
          <Text style={{ ...Type.body, color: colors.textSecondary, lineHeight: 20 }}>
            Log body fat from Apple Health or your scale — we&apos;ll show how it trends alongside your weight.
          </Text>
        ) : null
      ) : (
        <>
          {hasValues ? (
            // Free + data: the TREND is the gated layer — masked shape + lock.
            <View
              testID="progress-hierarchy-body-comp-locked-trend"
              style={{
                borderRadius: Radius.xl,
                backgroundColor: colors.backgroundSecondary,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: Spacing.md,
              }}
            >
              <MaskedTrendShape color={accent.primary} />
              <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", gap: Spacing.xs }]}>
                <Lock size={16} color={colors.textSecondary} strokeWidth={1.75} />
                <Text style={{ ...Type.captionSmall, color: colors.textSecondary }}>
                  Trends are a Pro feature
                </Text>
              </View>
            </View>
          ) : (
            <Text style={{ ...Type.body, color: colors.textSecondary, lineHeight: 20 }}>
              Track body fat and lean mass trends over time — a quiet read on how your composition is shifting.
            </Text>
          )}
          <SupprButton
            variant="ghost"
            label="See Pro plans"
            testID="progress-hierarchy-body-comp-paywall"
            accessibilityLabel="See Pro plans"
            onPress={onOpenPaywall}
            style={{ marginTop: Spacing.dense, alignSelf: "center", paddingVertical: Spacing.dense, paddingHorizontal: Spacing.md }}
          />
        </>
      )}
    </SupprCard>
  );
}

function ValueColumn({
  label,
  display,
  deltaLabel,
  style,
}: {
  label: string;
  display: string;
  deltaLabel: string | null;
  style?: object;
}) {
  const colors = useThemeColors();
  return (
    <View style={style}>
      <Text style={{ ...Type.statLabel, color: colors.textTertiary, marginBottom: Spacing.xs }}>{label}</Text>
      <Text style={{ ...Type.title, color: colors.text, fontVariant: ["tabular-nums"] }}>{display}</Text>
      {deltaLabel ? (
        <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: Spacing.xs }}>{deltaLabel}</Text>
      ) : null}
    </View>
  );
}

/** Fixed illustrative trend shape — low-opacity, deliberately NOT the user's
 *  data (the tease is the feature's shape, not an unpaid-for reading). */
function MaskedTrendShape({ color }: { color: string }) {
  return (
    <Svg width={220} height={56} viewBox="0 0 220 56">
      <Path
        d="M4 40 C 32 34, 48 44, 72 38 S 120 20, 148 26 S 196 14, 216 18"
        stroke={color}
        strokeOpacity={0.25}
        strokeWidth={2.5}
        fill="none"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default ProgressBodyCompSection;
