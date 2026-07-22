import * as React from "react";
import { Pressable, Text, View } from "react-native";
import {
  BookOpen,
  Camera,
  ChevronRight,
  Link2,
  Lock,
  PenLine,
} from "lucide-react-native";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { isFeatureEnabled } from "@/lib/analytics";

type GoFn = (pathname: string, params?: Record<string, string>) => void;

export type CreateRecipeActionSheetGridProps = {
  accentPrimary: string;
  isFreeTier: boolean;
  cookbookImportEnabled: boolean;
  onPhotoPress: () => void;
  go: GoFn;
};

/**
 * ENG-898 — Julienne-style 2×2 source picker (import.md §3.1).
 * Flag: `create_recipe_action_sheet_grid_v1`.
 */
export function CreateRecipeActionSheetGrid({
  accentPrimary,
  isFreeTier,
  cookbookImportEnabled,
  onPhotoPress,
  go,
}: CreateRecipeActionSheetGridProps) {
  const colors = useThemeColors();
  const cardElevation = useCardElevation();

  return (
    <>
      <View style={{ gap: Spacing.dense, marginBottom: Spacing.md }}>
        <View style={{ flexDirection: "row", gap: Spacing.dense }}>
          <SourceTile
            testID="create-action-sheet-link"
            Icon={Link2}
            label="Paste a link"
            primary
            accentPrimary={accentPrimary}
            colors={colors}
            cardElevation={cardElevation}
            onPress={() => go("/import-shared")}
            accessibilityLabel="Import a recipe from a link or social post"
          />
          <SourceTile
            testID="create-action-sheet-photo"
            Icon={Camera}
            label="Scan a photo"
            proLocked={isFreeTier}
            iconColor={Accent.success}
            colors={colors}
            cardElevation={cardElevation}
            onPress={onPhotoPress}
            accessibilityLabel={
              isFreeTier
                ? "Scan a recipe photo — Pro feature, upgrade required"
                : "Scan a recipe photo"
            }
          />
        </View>
        <View style={{ flexDirection: "row", gap: Spacing.dense }}>
          <SourceTile
            testID="create-action-sheet-cookbook"
            Icon={BookOpen}
            label="From a PDF"
            iconColor={Accent.success}
            colors={colors}
            cardElevation={cardElevation}
            comingSoon={!cookbookImportEnabled}
            onPress={
              cookbookImportEnabled ? () => go("/cookbook-import") : undefined
            }
            accessibilityLabel={
              cookbookImportEnabled
                ? "Import recipes from a cookbook PDF"
                : "Import from PDF — coming soon"
            }
          />
          <SourceTile
            testID="create-action-sheet-manual"
            Icon={PenLine}
            label="Create manually"
            iconColor={colors.textSecondary}
            colors={colors}
            cardElevation={cardElevation}
            onPress={() => go("/recipe/create")}
            accessibilityLabel="Create a recipe manually step by step"
          />
        </View>
      </View>

      <View
        style={{
          height: 1,
          backgroundColor: colors.border,
          marginBottom: Spacing.sm,
        }}
      />

      <Pressable
        testID="create-action-sheet-scratch-row"
        accessibilityRole="button"
        accessibilityLabel="Or write from scratch"
        onPress={() => go("/recipe/create")}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          minHeight: 44,
          paddingVertical: Spacing.sm,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Text style={{ ...Type.bodyMuted, color: Accent.success }}>
          Or write from scratch
        </Text>
        <ChevronRight size={16} color={colors.textTertiary} strokeWidth={2} />
      </Pressable>
    </>
  );
}

function SourceTile({
  testID,
  Icon,
  label,
  onPress,
  colors,
  cardElevation,
  accentPrimary,
  iconColor,
  primary = false,
  proLocked = false,
  comingSoon = false,
  accessibilityLabel,
}: {
  testID: string;
  Icon: typeof Link2;
  label: string;
  onPress?: () => void;
  colors: ReturnType<typeof useThemeColors>;
  cardElevation: ReturnType<typeof useCardElevation>;
  accentPrimary?: string;
  iconColor?: string;
  primary?: boolean;
  proLocked?: boolean;
  comingSoon?: boolean;
  accessibilityLabel: string;
}) {
  const disabled = comingSoon || !onPress;
  const resolvedIconColor = iconColor ?? accentPrimary ?? colors.text;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 120,
        padding: Spacing.md,
        borderRadius: Radius.xl,
        backgroundColor: primary ? `${accentPrimary}14` : colors.card,
        borderWidth: cardElevation.useBorder ? 1 : 0,
        borderColor: primary ? `${accentPrimary}40` : colors.border,
        opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
        ...(primary ? {} : (cardElevation.shadowStyle ?? {})),
        justifyContent: "space-between",
      })}
    >
      <View style={{ position: "relative", alignSelf: "flex-start" }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: Radius.lg,
            backgroundColor: `${resolvedIconColor}1A`,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} color={resolvedIconColor} strokeWidth={2} />
        </View>
        {proLocked ? (
          <View
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              width: 20,
              height: 20,
              borderRadius: Radius.full,
              backgroundColor: `${Accent.warning}1A`,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock size={12} color={Accent.warningSolid} strokeWidth={2} />
          </View>
        ) : null}
      </View>
      <View style={{ gap: Spacing.xs }}>
        <Text
          style={{
            ...(isFeatureEnabled("type_scale_v1")
              ? Type.button // all four source tiles share one control label
              : primary
                ? Type.button
                : Type.bodyMuted),
            color: colors.text,
          }}
        >
          {label}
          {proLocked ? " (Pro)" : ""}
        </Text>
        {comingSoon ? (
          <View
            style={{
              alignSelf: "flex-start",
              paddingHorizontal: Spacing.xs,
              paddingVertical: 2,
              borderRadius: Radius.sm,
              backgroundColor: colors.border,
            }}
          >
            <Text style={{ ...Type.caption, color: Accent.success }}>
              Coming soon
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
