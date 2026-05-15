/**
 * Pattern #9 — "Where this comes from" provenance affordance.
 *
 * Closes the architectural gap behind tracker `AN8GJ1Dr3M` ("steps and
 * total burn are wrong for this day"). Untriageable in build 12 because
 * the tester had no UI to see the underlying source / sample window /
 * sync freshness. This sheet turns vague reports into screenshottable
 * evidence and makes derived activity numbers feel honest.
 *
 * Mirrors the structural language of `WhyThisNumberSheet.tsx` — same
 * bottom-sheet shell + header + 3-row breakdown + secondary action.
 *
 * Two scopes:
 *  - "steps + active energy" combined sheet (Today card)
 *  - "burn breakdown" sheet (Burn detail screen — wired separately)
 *
 * No new schema. Last-sync timestamp is read from AsyncStorage
 * (`@suppr/healthSyncMeta/lastSyncedAt/v1`), which `healthSync.ts`
 * stamps after every successful update. When missing, the sheet
 * falls back to "Synced recently" rather than rendering an empty row.
 */

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { Accent, Radius, Spacing } from "@/constants/theme";

export interface WhereThisComesFromSheetProps {
  visible: boolean;
  onClose: () => void;
  /** "8,420 steps · 312 kcal active" — caller provides exact copy. */
  headline: string;
  /** "Apple Health" / "Apple Health (Apple Watch · iPhone)" / "Manual estimate". */
  source: string;
  /** "Today, 00:00 – 14:32" / "Mon 5 May, full day" / undefined to hide row. */
  range?: string;
  /** ms epoch from AsyncStorage. `null` → "Synced recently" fallback. */
  lastSyncedAtMs: number | null;
  /** "Numbers update when Apple Health does. Pull to refresh…" */
  footerExplainer: string;
  /** Optional secondary CTA: "Sync now" / "Connect Apple Health". */
  primaryCta?: { label: string; onPress: () => void; busy?: boolean };
  backgroundColor: string;
  cardColor: string;
  cardBorderColor: string;
  textColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

/** Format a ms timestamp into "X min ago" / "Yesterday at HH:MM" /
 *  "Synced recently" (when null). Pure for tests. */
export function formatLastSynced(
  lastSyncedAtMs: number | null,
  nowMs: number = Date.now(),
): string {
  if (lastSyncedAtMs == null || !Number.isFinite(lastSyncedAtMs) || lastSyncedAtMs <= 0) {
    return "Synced recently";
  }
  const ageMs = Math.max(0, nowMs - lastSyncedAtMs);
  if (ageMs < 60_000) return "Just now";
  const minutes = Math.floor(ageMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const d = new Date(lastSyncedAtMs);
  const today = new Date(nowMs);
  const isYesterday =
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate() - 1;
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (isYesterday) return `Yesterday at ${time}`;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function WhereThisComesFromSheet({
  visible,
  onClose,
  headline,
  source,
  range,
  lastSyncedAtMs,
  footerExplainer,
  primaryCta,
  backgroundColor,
  cardColor,
  cardBorderColor,
  textColor,
  textSecondaryColor,
  textTertiaryColor,
}: WhereThisComesFromSheetProps) {
  const insets = useSafeAreaInsets();
  const lastSynced = formatLastSynced(lastSyncedAtMs);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          testID="where-this-comes-from-sheet"
          style={{
            backgroundColor,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            paddingTop: Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          }}
        >
          {/* Header — title + close */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingHorizontal: Spacing.lg,
              marginBottom: Spacing.sm,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: textColor }}>
              Where this comes from
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={24} color={textSecondaryColor} strokeWidth={2.25} />
            </Pressable>
          </View>

          {/* Headline */}
          <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.md }}>
            <Text
              style={{
                fontSize: 22,
                fontWeight: "700",
                color: textColor,
                letterSpacing: -0.4,
                fontVariant: ["tabular-nums"],
              }}
              testID="where-this-comes-from-headline"
            >
              {headline}
            </Text>
          </View>

          {/* Breakdown rows */}
          <View
            style={{
              marginHorizontal: Spacing.lg,
              backgroundColor: cardColor,
              borderRadius: Radius.lg,
              borderWidth: 1,
              borderColor: cardBorderColor,
              overflow: "hidden",
            }}
          >
            <Row
              label="Source"
              value={source}
              borderBottom={range != null}
              borderColor={cardBorderColor}
              labelColor={textTertiaryColor}
              valueColor={textColor}
            />
            {range != null ? (
              <Row
                label="Range"
                value={range}
                borderBottom
                borderColor={cardBorderColor}
                labelColor={textTertiaryColor}
                valueColor={textColor}
              />
            ) : null}
            <Row
              label="Last synced"
              value={lastSynced}
              borderBottom={false}
              borderColor={cardBorderColor}
              labelColor={textTertiaryColor}
              valueColor={textColor}
            />
          </View>

          {/* Footer explainer */}
          <Text
            style={{
              paddingHorizontal: Spacing.lg,
              marginTop: Spacing.md,
              fontSize: 12,
              lineHeight: 17,
              color: textTertiaryColor,
            }}
          >
            {footerExplainer}
          </Text>

          {/* Optional primary CTA */}
          {primaryCta ? (
            <Pressable
              onPress={primaryCta.onPress}
              disabled={primaryCta.busy}
              accessibilityRole="button"
              accessibilityLabel={primaryCta.label}
              style={{
                marginHorizontal: Spacing.lg,
                marginTop: Spacing.lg,
                paddingVertical: 12,
                borderRadius: Radius.md,
                backgroundColor: Accent.primary,
                alignItems: "center",
                opacity: primaryCta.busy ? 0.6 : 1,
              }}
              testID="where-this-comes-from-cta"
            >
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 15 }}>
                {primaryCta.busy ? "Syncing…" : primaryCta.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  borderBottom,
  borderColor,
  labelColor,
  valueColor,
}: {
  label: string;
  value: string;
  borderBottom: boolean;
  borderColor: string;
  labelColor: string;
  valueColor: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: borderBottom ? 1 : 0,
        borderBottomColor: borderColor,
        gap: Spacing.md,
      }}
    >
      <Text style={{ fontSize: 13, color: labelColor, fontWeight: "600" }}>{label}</Text>
      <Text
        style={{
          fontSize: 13,
          color: valueColor,
          fontWeight: "500",
          flexShrink: 1,
          textAlign: "right",
        }}
      >
        {value}
      </Text>
    </View>
  );
}
