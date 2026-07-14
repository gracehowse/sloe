import React from "react";
import { Linking, Text, View, ActivityIndicator } from "react-native";
import { Footprints, Flame, HeartPulse, Scale } from "lucide-react-native";
import { withAlpha, Accent, Radius } from "@/constants/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { useAccent } from "@/context/theme";
import { useMacroColors } from "@/lib/macroColors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * AppleHealthCard (mobile) — D4 implementation of the Apple Health
 * card per `docs/design/apple-health-card.md`.
 *
 * Mobile is the SOURCE of health data. This card is a pure view — the
 * host (`app/(tabs)/progress.tsx`) reads HealthKit (via
 * `syncHealthData`) and passes the four numbers in. The write to
 * `health_snapshots` (so the web card can read them) happens in
 * `apps/mobile/lib/healthSync.ts` after each successful fetch.
 *
 * States covered here (§5 of the brief):
 *  - loading   → 4 skeleton rows, no footer.
 *  - denied    → 4 em-dash rows, permission-prompt footer.
 *  - partial   → real value where we have one, em-dash + hint where not.
 *  - error     → error line with retry.
 *  - ready     → 4 values + methodology footer.
 *
 * "Stale" and "offline" are web-only — mobile's render always reflects
 * what HealthKit just returned, so those states don't apply.
 */

export type AppleHealthCardStatus = "loading" | "ready" | "denied" | "error";

export interface AppleHealthCardProps {
  status: AppleHealthCardStatus;
  steps: number | null;
  activeEnergyKcal: number | null;
  restingBurnKcal: number | null;
  weightKg: number | null;
  useImperial?: boolean;
  onRetry?: () => void;
}

const METHODOLOGY_LINE =
  "Based on your resting rate so far today. Activity bonus may be added if your total burn exceeds the TDEE estimate.";

function formatSteps(v: number | null): string {
  return v == null ? "—" : v.toLocaleString();
}
function formatKcal(v: number | null): string {
  return v == null ? "—" : `${v.toLocaleString()} kcal`;
}
function formatWeight(kg: number | null, imperial: boolean): string {
  if (kg == null) return "—";
  if (imperial) return `${(kg * 2.20462).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

export function AppleHealthCard({
  status,
  steps,
  activeEnergyKcal,
  restingBurnKcal,
  weightKg,
  useImperial = false,
  onRetry,
}: AppleHealthCardProps) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the sync spinner,
  // Retry, and manage link. The not-authorised caution keeps `Accent.warning`.
  const accent = useAccent();
  const { colors: macro } = useMacroColors();
  // One-card-treatment soft lift (2026-06-09): the Apple Health card sits
  // directly on the Progress page ground, so it takes the soft elevation like
  // every sibling content card. Spread onto the OUTER shell View. Mirrors web's
  // page-ground cards getting `elevation="card"`.
  const cardElev = useCardElevation({ variant: "soft" });
  const t = {
    text: colors.text,
    sub: colors.textSecondary,
    dim: colors.textTertiary,
    card: colors.card,
    border: colors.cardBorder,
    muted: colors.cardBorder,
  };

  const shell = (inner: React.ReactNode) => (
    <View
      testID="apple-health-card"
      accessibilityLabel="Apple Health"
      style={[{
        backgroundColor: cardElev.liftBg ?? t.card,
        borderRadius: CARD_RADIUS,
        borderWidth: cardElev.useBorder ? 1 : 0,
        borderColor: t.border,
        padding: 16,
        marginBottom: 14,
      }, cardElev.shadowStyle]}
    >
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: t.dim,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          marginBottom: 10,
        }}
      >
        Apple Health
      </Text>
      {inner}
    </View>
  );

  if (status === "loading") {
    return shell(
      <View testID="apple-health-card-loading">
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: t.border }} />
              <View style={{ width: 100, height: 10, borderRadius: 4, backgroundColor: t.border }} />
            </View>
            <View style={{ width: 60, height: 10, borderRadius: 4, backgroundColor: t.border }} />
          </View>
        ))}
        <ActivityIndicator size="small" color={accent.primary} style={{ marginTop: 8 }} />
      </View>,
    );
  }

  if (status === "error") {
    return shell(
      <View testID="apple-health-card-error">
        <Text style={{ fontSize: 13, color: t.sub, marginBottom: 6 }}>
          Couldn&rsquo;t load Apple Health data.
        </Text>
        {onRetry ? (
          <PressableScale
            testID="apple-health-card-retry"
            haptic="selection"
            accessibilityRole="button"
            onPress={onRetry}
            style={{ alignSelf: "flex-start" }}
          >
            <Text style={{ fontSize: 13, color: accent.primarySolid, fontWeight: "600" }}>Retry</Text>
          </PressableScale>
        ) : null}
      </View>,
    );
  }

  // ready / denied share the 4-row list; denied values will be null (em-dash).
  const rows: {
    key: string;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
    color: string;
    label: string;
    value: string;
    hint?: string;
  }[] = [
    {
      key: "steps",
      Icon: Footprints,
      color: t.sub,
      label: "Steps",
      value: formatSteps(steps),
    },
    {
      key: "active",
      Icon: Flame,
      color: Accent.warningSolid,
      label: "Active energy",
      value: formatKcal(activeEnergyKcal),
    },
    {
      key: "resting",
      Icon: HeartPulse,
      color: macro.fat,
      label: "Resting burn",
      value: formatKcal(restingBurnKcal),
    },
    {
      key: "weight",
      Icon: Scale,
      color: macro.protein,
      label: "Weight",
      value: formatWeight(weightKg, useImperial),
      hint: status === "ready" && weightKg == null ? "No weigh-in today" : undefined,
    },
  ];

  return shell(
    <View testID="apple-health-card-rows">
      {rows.map((row, i) => {
        const missing = row.value === "—";
        return (
          <View
            key={row.key}
            testID={`apple-health-row-${row.key}`}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 10,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: t.border,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: Radius.full,
                  backgroundColor: withAlpha(row.color, 0x1A),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <row.Icon size={16} color={row.color} />
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={{ fontSize: 13, color: t.sub }}>{row.label}</Text>
                {row.hint ? (
                  <Text style={{ fontSize: 11, color: t.dim }}>{row.hint}</Text>
                ) : null}
              </View>
            </View>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "700",
                color: missing ? t.dim : t.text,
                fontVariant: ["tabular-nums"],
              }}
            >
              {row.value}
            </Text>
          </View>
        );
      })}
      {status === "denied" ? (
        <Text
          testID="apple-health-card-denied-footer"
          style={{ fontSize: 11, color: t.dim, marginTop: 10, lineHeight: 16 }}
        >
          Allow Apple Health access in Settings to see this.{" "}
          <Text
            onPress={() => {
              Linking.openURL("app-settings:").catch(() => {
                // `openSettings` fallback — the link above is the iOS
                // canonical Settings deep-link. If the platform rejects
                // it (e.g. simulator), silently swallow; the user can
                // still reach Settings manually.
              });
            }}
            style={{ color: accent.primarySolid, fontWeight: "600" }}
          >
            Open Settings
          </Text>
        </Text>
      ) : (
        <Text
          testID="apple-health-card-footer"
          style={{ fontSize: 11, color: t.dim, marginTop: 10, lineHeight: 16 }}
        >
          {METHODOLOGY_LINE}
        </Text>
      )}
    </View>,
  );
}
