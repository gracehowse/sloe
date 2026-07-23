/**
 * Cookbook import pressable chrome (ENG-1565).
 * Extracted from `app/cookbook-import.tsx` for PressableScale + screen budget.
 */
import React from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { PressableScale } from "@/components/ui/PressableScale";
import { FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import type { PlanImportNutritionMode, PlanImportVerifiedRecipe } from "@suppr/shared/planning/planImport/types";

type InlineBanner =
  | { kind: "error"; message: string }
  | { kind: "warning"; message: string; upgradeAction?: () => void }
  | null;

export function CookbookImportBanner({
  banner,
  styles,
}: {
  banner: InlineBanner;
  styles: ReturnType<typeof makeCookbookImportPressableStyles>;
}) {
  if (!banner) return null;
  return (
    <View style={banner.kind === "error" ? styles.bannerError : styles.bannerWarning}>
      <Text style={styles.bannerText}>{banner.message}</Text>
      {banner.kind === "warning" && banner.upgradeAction ? (
        <PressableScale haptic="selection" onPress={banner.upgradeAction}>
          <Text style={styles.bannerUpgradeBtnText}>View plans</Text>
        </PressableScale>
      ) : null}
    </View>
  );
}

export function CookbookHeaderSaveButton({
  committing,
  onPress,
  accentPrimarySolid,
}: {
  committing: boolean;
  onPress: () => void;
  accentPrimarySolid: string;
}) {
  return (
    <PressableScale haptic="confirm" onPress={onPress} disabled={committing} hitSlop={8}>
      <Text
        style={[
          Type.bodyLarge,
          { fontFamily: FontFamily.sansSemibold, color: accentPrimarySolid },
        ]}
      >
        {committing ? "…" : "Save"}
      </Text>
    </PressableScale>
  );
}

export function CookbookNutritionModeSeg({
  nutritionMode,
  onSelect,
  styles,
}: {
  nutritionMode: PlanImportNutritionMode;
  onSelect: (mode: PlanImportNutritionMode) => void;
  styles: ReturnType<typeof makeCookbookImportPressableStyles>;
}) {
  return (
    <View style={styles.seg}>
      {(["author", "match"] as const).map((mode) => (
        <PressableScale
          key={mode}
          haptic="selection"
          style={[styles.segBtn, nutritionMode === mode && styles.segBtnActive]}
          onPress={() => onSelect(mode)}
        >
          <Text style={styles.segBtnText}>
            {mode === "author" ? "Author's numbers" : "Match & verify"}
          </Text>
        </PressableScale>
      ))}
    </View>
  );
}

export function CookbookFooterSaveButton({
  label,
  committing,
  onPress,
  styles,
  containerStyle,
}: {
  label: string;
  committing: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeCookbookImportPressableStyles>;
  containerStyle?: ViewStyle;
}) {
  return (
    <PressableScale
      haptic="confirm"
      style={[styles.footerSaveBtn, containerStyle]}
      onPress={onPress}
      disabled={committing}
    >
      <Text style={styles.primaryBtnText}>{label}</Text>
    </PressableScale>
  );
}

export function CookbookLegacyRecipeCard({
  item,
  excluded,
  nutritionMode,
  onToggle,
  styles,
  colors,
}: {
  item: PlanImportVerifiedRecipe;
  excluded: boolean;
  nutritionMode: PlanImportNutritionMode;
  onToggle: (key: string) => void;
  styles: ReturnType<typeof makeCookbookImportPressableStyles>;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const kcal =
    nutritionMode === "author" && item.authorNutrition?.calories
      ? item.authorNutrition.calories
      : item.supprNutrition.calories;
  return (
    <PressableScale
      haptic="selection"
      style={styles.cardOuter}
      onPress={() => onToggle(item.key)}
      testID={`cookbook-recipe-${item.key}`}
    >
      <View style={[styles.card, excluded && { opacity: 0.45 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text
            style={[styles.cardTitle, excluded && { textDecorationLine: "line-through" }]}
          >
            {item.title}
          </Text>
          <Text style={{ fontFamily: FontFamily.sansSemibold, fontSize: 14, color: colors.text }}>
            {kcal} kcal
          </Text>
        </View>
        <Text style={styles.cardMeta}>
          Serves {item.serves} · {item.ingredientCount ?? item.ingredients.length} ingredients ·{" "}
          {item.confidence} confidence{excluded ? " · excluded" : ""}
        </Text>
      </View>
    </PressableScale>
  );
}

export function CookbookUploadZone({
  pickedFileName,
  onPress,
  styles,
}: {
  pickedFileName: string | null;
  onPress: () => void;
  styles: ReturnType<typeof makeCookbookImportPressableStyles>;
}) {
  return (
    <PressableScale
      haptic="selection"
      testID="cookbook-import-pick-pdf"
      style={styles.uploadZone}
      onPress={onPress}
    >
      <Text style={styles.uploadTitle}>
        {pickedFileName ?? "Choose cookbook PDF"}
      </Text>
      <Text style={styles.uploadHint}>
        {pickedFileName
          ? "Tap to replace · export a searchable PDF (not a flat scan)"
          : "Searchable PDF export (not a flat scan) — 4 MB max"}
      </Text>
    </PressableScale>
  );
}

export function CookbookParseButton({
  onPress,
  styles,
}: {
  onPress: () => void;
  styles: ReturnType<typeof makeCookbookImportPressableStyles>;
}) {
  return (
    <PressableScale
      haptic="confirm"
      testID="cookbook-import-parse"
      style={styles.primaryBtn}
      onPress={onPress}
    >
      <Text style={styles.primaryBtnText}>Parse cookbook</Text>
    </PressableScale>
  );
}

export function makeCookbookImportPressableStyles(
  colors: ReturnType<typeof useThemeColors>,
  accent: ReturnType<typeof useAccent>,
  insetsBottom: number,
) {
  return StyleSheet.create({
    uploadZone: {
      borderWidth: 1,
      borderColor: colors.border,
      borderStyle: "dashed",
      borderRadius: Radius.xl,
      backgroundColor: colors.card,
      padding: Spacing.xl,
      marginTop: Spacing.sm,
    },
    uploadTitle: { ...Type.headline, color: colors.text },
    uploadHint: {
      fontFamily: FontFamily.sansRegular,
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
      lineHeight: 18,
    },
    primaryBtn: {
      backgroundColor: accent.primary,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.md,
      alignItems: "center",
      marginTop: Spacing.md,
      minHeight: 48,
      justifyContent: "center",
    },
    primaryBtnText: {
      fontFamily: FontFamily.sansSemibold,
      fontSize: Type.bodyLarge.fontSize,
      lineHeight: Type.bodyLarge.lineHeight,
      color: accent.primaryForeground,
    },
    cardOuter: {
      borderRadius: Radius.lg,
      marginBottom: Spacing.md,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: { ...Type.headline, color: colors.text },
    cardMeta: {
      ...Type.captionSmall,
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    seg: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
    segBtn: {
      flex: 1,
      paddingVertical: Spacing.sm,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
    },
    segBtnActive: {
      borderWidth: 2,
      borderColor: accent.primary,
      backgroundColor: accent.primarySoft,
    },
    segBtnText: {
      fontFamily: FontFamily.sansSemibold,
      fontSize: 13,
      color: colors.text,
    },
    bannerError: {
      backgroundColor: `${accent.destructive}14`,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: `${accent.destructive}40`,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    bannerWarning: {
      backgroundColor: `${accent.warning}14`,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: `${accent.warning}40`,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    bannerText: {
      fontFamily: FontFamily.sansRegular,
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    bannerUpgradeBtnText: {
      fontFamily: FontFamily.sansSemibold,
      fontSize: 14,
      color: accent.primarySolid,
      marginTop: Spacing.xs,
    },
    reviewFooter: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
      padding: Spacing.md,
      paddingBottom: insetsBottom + Spacing.md,
    },
    reviewCount: {
      ...Type.bodyLarge,
      color: colors.text,
      marginBottom: Spacing.sm,
    },
    footerSaveBtn: {
      backgroundColor: accent.primary,
      borderRadius: Radius.xl,
      paddingVertical: Spacing.md,
      alignItems: "center",
      minHeight: 48,
      justifyContent: "center",
    },
  });
}
