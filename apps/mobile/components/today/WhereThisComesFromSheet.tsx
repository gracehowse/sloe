/**
 * Pattern #9 — "Where this comes from" provenance affordance.
 *
 * Sloe re-skin (2026-06-04): light dim veil, white sheet, flat #F6F5F2
 * grouped rows, full-width clay "Sync now". SSOT:
 * `docs/prototypes/stitch-sloe/energy-source-sheet.html`.
 */

import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RefreshCw, X } from "lucide-react-native";

import { FontFamily, Radius, Spacing } from "@/constants/theme";
import { useAccent } from "@/context/theme";

export interface WhereThisComesFromSheetProps {
  visible: boolean;
  onClose: () => void;
  /** "492 kcal · Active 11 · Resting 481" — caller provides exact copy. */
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
  textColor,
  textSecondaryColor,
}: WhereThisComesFromSheetProps) {
  const insets = useSafeAreaInsets();
  const accent = useAccent();
  const lastSynced = formatLastSynced(lastSyncedAtMs);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(34,27,38,0.22)" }]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          testID="where-this-comes-from-sheet"
          style={{
            backgroundColor,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingBottom: insets.bottom + Spacing.lg,
          }}
        >
          <View style={{ alignItems: "center", paddingTop: Spacing.dense, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 6, borderRadius: 3, backgroundColor: "#E8E2EC" }} />
          </View>

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              paddingHorizontal: Spacing.lg,
              paddingTop: Spacing.sm,
            }}
          >
            <Text
              style={{
                flex: 1,
                fontFamily: FontFamily.serifRegular,
                fontSize: 24,
                lineHeight: 28,
                color: textColor,
              }}
            >
              Where this comes from
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={{ marginTop: 2, marginLeft: 8 }}
            >
              <X size={24} color={textSecondaryColor} strokeWidth={2.25} />
            </Pressable>
          </View>

          <Text
            style={{
              paddingHorizontal: Spacing.lg,
              marginTop: 4,
              fontSize: 14,
              color: textSecondaryColor,
              fontVariant: ["tabular-nums"],
            }}
            testID="where-this-comes-from-headline"
          >
            {headline}
          </Text>

          <View style={{ paddingHorizontal: Spacing.lg, marginTop: Spacing.lg }}>
            <View
              style={{
                backgroundColor: cardColor,
                borderRadius: Radius.xl,
                paddingHorizontal: Spacing.md,
                overflow: "hidden",
              }}
            >
              <ProvenanceRow label="Source" value={source} borderColor="#E8E2EC" labelColor={textSecondaryColor} valueColor={textColor} showBorder={range != null} />
              {range != null ? (
                <ProvenanceRow label="Range" value={range} borderColor="#E8E2EC" labelColor={textSecondaryColor} valueColor={textColor} showBorder />
              ) : null}
              <ProvenanceRow label="Last synced" value={lastSynced} borderColor="#E8E2EC" labelColor={textSecondaryColor} valueColor={textColor} showBorder={false} />
            </View>
          </View>

          <Text
            style={{
              paddingHorizontal: Spacing.lg,
              marginTop: Spacing.lg,
              fontSize: 13,
              lineHeight: 20,
              color: textSecondaryColor,
            }}
          >
            {footerExplainer}
          </Text>

          {primaryCta ? (
            // Sloe treatment system (2026-06-08): primary inline CTA →
            // aubergine outline (transparent fill + 1.5px primarySolid
            // border + primarySolid label/glyph), not a filled slab.
            <Pressable
              onPress={primaryCta.onPress}
              disabled={primaryCta.busy}
              accessibilityRole="button"
              accessibilityLabel={primaryCta.label}
              style={{
                marginHorizontal: Spacing.lg,
                marginTop: Spacing.lg,
                paddingVertical: Spacing.md,
                borderRadius: Radius.full,
                backgroundColor: "transparent",
                borderWidth: 1.5,
                borderColor: accent.primarySolid,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: primaryCta.busy ? 0.6 : 1,
              }}
              testID="where-this-comes-from-cta"
            >
              <RefreshCw size={17} color={accent.primarySolid} strokeWidth={2} />
              <Text style={{ color: accent.primarySolid, fontWeight: "600", fontSize: 15 }}>
                {primaryCta.busy ? "Syncing…" : primaryCta.label}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function ProvenanceRow({
  label,
  value,
  borderColor,
  labelColor,
  valueColor,
  showBorder,
}: {
  label: string;
  value: string;
  borderColor: string;
  labelColor: string;
  valueColor: string;
  showBorder: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: Spacing.md,
        paddingVertical: Spacing.md,
        borderBottomWidth: showBorder ? StyleSheet.hairlineWidth : 0,
        borderBottomColor: borderColor,
      }}
    >
      <Text style={{ fontSize: 14, color: labelColor, flexShrink: 0 }}>{label}</Text>
      <Text style={{ fontSize: 14, color: valueColor, fontWeight: "500", flexShrink: 1, textAlign: "right" }}>
        {value}
      </Text>
    </View>
  );
}
