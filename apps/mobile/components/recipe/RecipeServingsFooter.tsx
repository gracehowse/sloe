/**
 * Recipe detail — sticky footer (Figma `332:2`, section 8). Web parity:
 * the sticky footer in `src/app/components/RecipeDetail.tsx`.
 *
 * Left: a YIELD label over a servings stepper (cream round − / value / cream
 * round +). This is the canonical servings control — it REPLACES the old
 * mid-body servings card; ingredient amounts + batch totals scale off it.
 * Right: an aubergine OUTLINE "Cook Mode" pill (transparent ground + 1.5px
 * aubergine border + aubergine label/icon) → opens Cook Mode. The everyday
 * primary is an outline, not a filled slab (Sloe treatment system §1); the
 * footer ground is the translucent near-white surface so `primarySolid`
 * reads at full AA contrast.
 *
 * ENG-1247 (v3 conformance, flag `recipe_detail_v3_conformance`): when the
 * `onLog` prop is supplied the bar consolidates the screen's commit actions —
 * YIELD stepper · Cook Mode (outline SECONDARY) · Log (filled PRIMARY,
 * dominant). Log is the single filled slab (one-filled-CTA rule); the prior
 * top-row Log moves here (prototype sticky CTA, Sloe-App.html L4418–4421).
 * Flag-OFF (`onLog` omitted) keeps the legacy stepper + Cook-Mode-outline bar.
 *
 * The footer floats over a translucent white surface, safe-area aware.
 */
import { Text, View } from "react-native";
import { Minus, Plus, PlusCircle, UtensilsCrossed } from "lucide-react-native";

import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PressableScale } from "@/components/ui/PressableScale";
import { SupprButton } from "@/components/ui/SupprButton";

export function RecipeServingsFooter({
  servings,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
  onCookMode,
  bottomInset,
  haptic = "none",
  onLog,
  logging = false,
}: {
  servings: number;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
  onCookMode: () => void;
  bottomInset: number;
  haptic?: "confirm" | "none";
  /** ENG-1247 — when set, render the filled Log primary (dominant) alongside
   *  the outline Cook Mode. Omit (flag-OFF) for the legacy Cook-Mode-only bar. */
  onLog?: () => void;
  /** Log in-flight — disables + shows the SupprButton spinner. */
  logging?: boolean;
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the Cook Mode CTA.
  const accent = useAccent();

  const roundBtn = (enabled: boolean) => ({
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundSecondary,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    opacity: enabled ? 1 : 0.4,
  });

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "rgba(255,255,255,0.94)",
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingHorizontal: 24,
        paddingTop: Spacing.dense,
        paddingBottom: bottomInset + Spacing.dense,
      }}
      testID="recipe-detail-sticky-footer"
    >
      {/* Left — yield + servings stepper. */}
      <View style={{ gap: 4 }}>
        <Text
          // headers census 2026-06-10: density eyebrow → Type.label (11px; the
          // 1px delta from 10 is invisible, the variance was the bug).
          style={{ ...Type.label, color: colors.textSecondary }}
        >
          Yield
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.dense }}>
          <PressableScale
            onPress={onDecrease}
            disabled={!canDecrease}
            accessibilityRole="button"
            accessibilityLabel="Decrease servings"
            testID="recipe-view-servings-minus"
            style={roundBtn(canDecrease)}
          >
            <Minus size={16} color={colors.text} />
          </PressableScale>
          <Text
            style={{
              minWidth: 24,
              textAlign: "center",
              fontFamily: FontFamily.serifRegular,
              fontSize: 20,
              fontWeight: "400",
              color: colors.navPrimary,
              fontVariant: ["tabular-nums"],
            }}
            testID="recipe-view-servings-value"
            accessibilityLiveRegion="polite"
            accessibilityLabel={`${servings} servings`}
          >
            {servings}
          </Text>
          <PressableScale
            onPress={onIncrease}
            disabled={!canIncrease}
            accessibilityRole="button"
            accessibilityLabel="Increase servings"
            testID="recipe-view-servings-plus"
            style={roundBtn(canIncrease)}
          >
            <Plus size={16} color={colors.text} />
          </PressableScale>
        </View>
      </View>

      {/* Right — ENG-1247: Cook Mode (outline SECONDARY) + Log (filled PRIMARY,
          dominant) when `onLog` is set; else the legacy lone Cook Mode pill.
          Log is the single filled slab (one-filled-CTA rule). */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        <PressableScale
          haptic={haptic}
          onPress={onCookMode}
          accessibilityRole="button"
          accessibilityLabel="Start cook mode"
          testID="recipe-cook-mode-cta"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            height: 52,
            paddingHorizontal: onLog ? Spacing.lg : 24,
            borderRadius: Radius.full,
            backgroundColor: "transparent",
            borderWidth: 1.5,
            borderColor: accent.primarySolid,
          }}
        >
          <UtensilsCrossed size={18} color={accent.primarySolid} />
          <Text
            style={{
              fontFamily: FontFamily.sansSemibold,
              fontSize: 15,
              fontWeight: "700",
              color: accent.primarySolid,
            }}
          >
            Cook Mode
          </Text>
        </PressableScale>

        {onLog ? (
          <SupprButton
            variant="primary"
            haptic={haptic}
            onPress={onLog}
            loading={logging}
            accessibilityLabel="Log this recipe"
            testID="recipe-footer-log-cta"
            style={{ height: 52, paddingHorizontal: Spacing.lg, gap: Spacing.sm }}
          >
            <PlusCircle size={18} color="#fff" />
            <Text
              style={{
                fontFamily: FontFamily.sansSemibold,
                fontSize: 15,
                fontWeight: "700",
                color: "#fff",
              }}
            >
              Log
            </Text>
          </SupprButton>
        ) : null}
      </View>
    </View>
  );
}
