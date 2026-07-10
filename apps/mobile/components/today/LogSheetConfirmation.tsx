import { StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { SupprButton } from "@/components/ui/SupprButton";
import { SourceDot } from "@/components/ui/SourceDot";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { isFeatureEnabled } from "@/lib/analytics";
import { formatQualifiedKcal } from "@suppr/nutrition-core/formatMacro";
import type { LogSheetProps } from "./LogSheet";

/**
 * S13 logged-confirmation (Figma 202:2) — the calm success state shown
 * after a log commits. Presentation-only: the host has already persisted
 * the log; this surface just confirms it and offers Done / Undo. Trust
 * posture: nutrition is always an estimate (never an absolute claim).
 *
 * Extracted from `LogSheet.tsx` (ENG-1484, screen-budget ratchet) —
 * mirror of web `log-sheet-confirmation.tsx`.
 */
export function LoggedConfirmation({
  confirmation,
}: {
  confirmation: NonNullable<LogSheetProps["confirmation"]>;
}) {
  const colors = useThemeColors();
  // The Done/Undo CTAs are SupprButtons (solid-plum / ghost) — they own
  // their own colour. The success check keeps `Accent.successSolid`.
  const { title, kcal, kcalIsVerified, slot, source, onDone, onUndo } = confirmation;
  // ENG-1484 — kcal-qualifier cross-surface consistency: behind the
  // `kcal_trust_qualifier_v1` ramp this surface speaks the same `~` grammar
  // as every other decision surface (planner totals, Cook Mode, north-star,
  // Library) instead of its own "Est." wording. Flag OFF keeps the exact
  // pre-ENG-1484 copy (kill switch). Mirrors web `log-sheet-confirmation.tsx`.
  const kcalLine = isFeatureEnabled("kcal_trust_qualifier_v1")
    ? `${formatQualifiedKcal(kcal, kcalIsVerified)} kcal`
    : `Est. ${kcal} kcal`;
  return (
    <View
      style={styles.confirmWrap}
      accessibilityLiveRegion="polite"
      testID="log-sheet-confirmation"
    >
      {/* Success mark — Sloe sage success tint, calm not loud. */}
      <View style={[styles.confirmMark, { backgroundColor: "rgba(94, 124, 90, 0.12)" }]}>
        <Check size={32} color={Accent.successSolid} strokeWidth={2.5} />
      </View>

      <Text style={[Type.title, { color: colors.navPrimary, marginTop: Spacing.md, textAlign: "center" }]}>
        {slot ? `Logged to ${slot}` : "Logged"}
      </Text>

      {/* Logged-item card — cream slab, 12px corner, hairline. */}
      <View
        style={[
          styles.confirmCard,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[Type.body, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
            {source ? <SourceDot source={source} size={6} /> : null}
            <Text
              style={[
                Type.caption,
                {
                  color: colors.textSecondary,
                  marginLeft: source ? Spacing.xs : 0,
                  fontVariant: ["tabular-nums"],
                },
              ]}
            >
              {kcalLine}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions — primary Done + optional ghost Undo. Button system
          (2026-06-12, docs/decisions/2026-06-12-button-system-solid-primary.md):
          the sheet's single commit action is the SOLID-plum SupprButton
          primary; the secondary Undo is the ghost variant (transparent, plum
          label). The sheet keeps its sanctioned elevation; the buttons inside
          carry none. */}
      <View style={{ width: "100%", marginTop: Spacing.lg, gap: Spacing.sm }}>
        <SupprButton
          variant="primary"
          accessibilityLabel="Done"
          onPress={onDone}
          label="Done"
          style={styles.confirmPrimary}
        />
        {onUndo ? (
          <SupprButton
            variant="ghost"
            accessibilityLabel="Undo log"
            onPress={onUndo}
            label="Undo"
            style={styles.confirmUndo}
          />
        ) : null}
      </View>
    </View>
  );
}

// S13 logged-confirmation (Figma 202:2).
const styles = StyleSheet.create({
  confirmWrap: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  confirmMark: {
    width: 64,
    height: 64,
    // Radius.full — a 64px circle (was a raw 32 in LogSheet.tsx; tokenised
    // on extraction, same pixels).
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Layout-only overrides for the SupprButton CTAs (full-width, no colour/
  // radius/shadow — the primitive owns the pill + solid-fill grammar).
  confirmPrimary: {
    width: "100%",
  },
  confirmUndo: {
    width: "100%",
  },
});

export default LoggedConfirmation;
