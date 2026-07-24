import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { Radius, Spacing, Type, type Accent as AccentTokens } from "@/constants/theme";
import type { CardElevation } from "@/hooks/useCardElevation";
import type { ThemeColors } from "@/hooks/use-theme-colors";

/**
 * Static page-chrome styles for the recipe detail screen (container, cards,
 * "official recipe" panel, source-attribution panel). Extracted from the
 * screen component to keep `apps/mobile/app/recipe/[id].tsx` under the
 * 400-line-target ratchet's pinned budget.
 */
export function useRecipeDetailStyles(
  colors: ThemeColors,
  cardElevation: CardElevation,
  accent: typeof AccentTokens,
) {
  return useMemo(
    () =>
      StyleSheet.create({
        // Figma 332:2 — warm cream editorial page (`#F6F5F2`). White slab cards lift
        // off this cream base. Mirrors the public-share page.
        container: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
        errorText: { color: colors.text, fontSize: 16 },

        // Page body — single-scroll editorial stack (Figma 332:2 §2–7).
        body: { padding: Spacing.xl, gap: Spacing.xl },

        // ENG-748 — persistent gluten-chip disclaimer caption.
        glutenDisclaimer: {
          fontSize: 11,
          lineHeight: 15,
          color: colors.textSecondary,
        },

        // Canonical card shell (2026-06-10 §1/§2: the app converged to recipe
        // detail's white-on-cream grammar, so the standard tokens now ARE that
        // grammar — the old `colors.background` fill silently went cream-on-cream
        // when the ground inverted).
        card: {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: CARD_RADIUS,
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.cardBorder,
          padding: Spacing.xl,
          gap: Spacing.md,
          ...(cardElevation.shadowStyle ?? {}),
        },
        descText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },

        officialCard: {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: CARD_RADIUS,
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.cardBorder,
          padding: Spacing.xl,
          gap: Spacing.sm,
          ...(cardElevation.shadowStyle ?? {}),
        },
        officialTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
        officialCopy: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
        officialButton: {
          alignSelf: "flex-start",
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.lg,
          borderRadius: Radius.full,
          borderWidth: 1,
          borderColor: colors.cardBorder,
          marginTop: Spacing.xs,
        },
        officialButtonText: { fontSize: 14, fontWeight: "700", color: accent.primarySolid },

        sourceCard: {
          backgroundColor: cardElevation.liftBg ?? colors.card,
          borderRadius: CARD_RADIUS,
          borderWidth: cardElevation.useBorder ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.cardBorder,
          padding: Spacing.xl,
          gap: Spacing.sm,
          ...(cardElevation.shadowStyle ?? {}),
        },
        // headers census 2026-06-10: eyebrow → Type.label (was the app's heaviest +
        // widest hand-rolled eyebrow at 11/800/ls2).
        sourceLabel: { ...Type.label, color: colors.textTertiary },
        sourceName: { fontSize: 16, fontWeight: "600", color: colors.text },
        sourceNameLink: { color: accent.primarySolid, textDecorationLine: "underline" },
        sourceLinkBtn: {
          marginTop: Spacing.xs,
          alignSelf: "flex-start",
          paddingVertical: Spacing.sm,
          paddingHorizontal: Spacing.lg,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: accent.primarySoftStrong,
        },
        sourceLinkText: { color: accent.primarySolid, fontSize: 14, fontWeight: "600" },
        // ENG-858 — import disclaimer caption. Matches the gluten-disclaimer
        // treatment (the nearest disclaimer sibling): 11/15, textSecondary.
        sourceDisclaimer: {
          fontSize: 11,
          lineHeight: 15,
          color: colors.textSecondary,
          marginTop: Spacing.sm,
        },
      }),
    [colors, cardElevation, accent],
  );
}
