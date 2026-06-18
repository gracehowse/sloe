import * as React from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import { PressableScale } from "@/components/ui/PressableScale";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Link2,
  Camera,
  PenLine,
  Clipboard as ClipboardIcon,
  BookOpen,
  Lock,
  ChevronRight,
} from "lucide-react-native";
import { useRouter } from "expo-router";

import { Accent, FontFamily, MacroColors, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useCardElevation } from "@/hooks/useCardElevation";
import { isFeatureEnabled } from "@/lib/analytics";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import { extractUrlFromShareText } from "@/lib/resolveImportUrl";
import { detectSourcePlatform } from "@/lib/sourcePlatform";
import { supabase } from "@/lib/supabase";

/**
 * CreateRecipeActionSheet — "Add a recipe" entry (import.md §3.1).
 * 2×2 source tile grid + clipboard quick-action + scratch row.
 */

export interface CreateRecipeActionSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateRecipeActionSheet({ visible, onClose }: CreateRecipeActionSheetProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const accent = useAccent();
  const cardElevation = useCardElevation();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const cookbookImportEnabled = isFeatureEnabled("cookbook_import_enabled");

  const [userTier, setUserTier] = React.useState<"free" | "base" | "pro">("free");
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { loadCachedUserTier } = await import("@/lib/cachedUserTier");
      const cached = await loadCachedUserTier();
      if (!cancelled) setUserTier(cached);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  React.useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_tier")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      const tier = (data?.user_tier as string | null) ?? null;
      const resolved: "free" | "base" | "pro" =
        tier === "free" || tier === "base" || tier === "pro" ? tier : "free";
      setUserTier(resolved);
      void import("@/lib/cachedUserTier").then(({ saveCachedUserTier }) =>
        saveCachedUserTier(resolved),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);
  const isFreeTier = userTier === "free";

  const [clipboardUrl, setClipboardUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!visible) {
      setClipboardUrl(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const raw = await safeGetClipboardString();
        if (cancelled) return;
        const url = raw ? extractUrlFromShareText(raw) : null;
        setClipboardUrl(url ?? "");
      } catch {
        if (!cancelled) setClipboardUrl("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const clipboardHost = React.useMemo(() => {
    if (!clipboardUrl) return null;
    try {
      const u = new URL(clipboardUrl);
      const platform = detectSourcePlatform(clipboardUrl);
      if (platform && platform !== "unknown") {
        const platformLabels: Record<string, string> = {
          instagram: "Instagram",
          tiktok: "TikTok",
          youtube: "YouTube",
          reddit: "Reddit",
          pinterest: "Pinterest",
          web: u.hostname.replace(/^www\./, ""),
        };
        return platformLabels[platform] ?? u.hostname.replace(/^www\./, "");
      }
      return u.hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }, [clipboardUrl]);

  const go = (pathname: string, params?: Record<string, string>) => {
    onClose();
    setTimeout(() => {
      router.push(params ? { pathname: pathname as never, params } : (pathname as never));
    }, 80);
  };

  const onPhotoPress = () => {
    if (isFreeTier) {
      go("/paywall", { from: "create_photo" });
      return;
    }
    go("/create-recipe", { autoPhoto: "1" });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
          }}
          onPress={onClose}
        />
        <View
          style={{
            backgroundColor: colors.background,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          }}
        >
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: colors.border,
              alignSelf: "center",
              marginBottom: Spacing.lg,
            }}
          />

          {clipboardHost ? (
            <PressableScale
              haptic="confirm"
              testID="create-action-sheet-clipboard-paste"
              accessibilityRole="button"
              accessibilityLabel={`Import recipe from ${clipboardHost} on clipboard`}
              onPress={() => go("/import-shared", { url: clipboardUrl as string })}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: Spacing.sm,
                paddingHorizontal: Spacing.md,
                paddingVertical: Spacing.md,
                borderRadius: Radius.xl,
                backgroundColor: colors.card,
                borderLeftWidth: 3,
                borderLeftColor: accent.primary,
                marginBottom: Spacing.md,
                ...(cardElevation.shadowStyle ?? {}),
              }}
            >
              <Link2 size={20} color={accent.primary} strokeWidth={2} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ ...Type.body, color: colors.text }} numberOfLines={1}>
                  {clipboardHost} — tap to import
                </Text>
              </View>
              <ChevronRight size={16} color={colors.border} strokeWidth={2} />
            </PressableScale>
          ) : null}

          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm }}>
            <SourceTile
              testID="create-action-sheet-link"
              Icon={Link2}
              iconColor={accent.primary}
              label="Paste a link"
              primary
              accessibilityLabel="Import a recipe from a link or social post"
              onPress={() => go("/import-shared")}
              colors={colors}
              cardElevation={cardElevation}
            />
            <SourceTile
              testID="create-action-sheet-photo"
              Icon={Camera}
              iconColor={accent.primary}
              label="Scan a photo"
              subtitle={isFreeTier ? "(Pro)" : undefined}
              proLocked={isFreeTier}
              accessibilityLabel={
                isFreeTier
                  ? "Scan a photo of a recipe — Pro feature, upgrade required"
                  : "Scan a photo of a recipe"
              }
              onPress={onPhotoPress}
              colors={colors}
              cardElevation={cardElevation}
            />
          </View>
          <View style={{ flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md }}>
            <SourceTile
              testID="create-action-sheet-cookbook"
              Icon={BookOpen}
              iconColor={MacroColors.protein}
              label="From a PDF"
              comingSoon={!cookbookImportEnabled}
              accessibilityLabel={
                cookbookImportEnabled
                  ? "Import a cookbook PDF"
                  : "Import a cookbook PDF — coming soon"
              }
              onPress={cookbookImportEnabled ? () => go("/cookbook-import") : undefined}
              colors={colors}
              cardElevation={cardElevation}
            />
            <SourceTile
              testID="create-action-sheet-manual"
              Icon={PenLine}
              iconColor={colors.textSecondary}
              label="Create manually"
              accessibilityLabel="Create a recipe manually"
              onPress={() => go("/recipe/create")}
              colors={colors}
              cardElevation={cardElevation}
            />
          </View>

          <View
            style={{
              height: 1,
              backgroundColor: colors.border,
              marginBottom: Spacing.sm,
            }}
          />
          <PressableScale
            haptic="selection"
            accessibilityRole="button"
            accessibilityLabel="Or write from scratch"
            onPress={() => go("/recipe/create")}
            style={{
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingVertical: Spacing.sm,
            }}
          >
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Or write from scratch</Text>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </PressableScale>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={{ paddingVertical: Spacing.md, alignItems: "center", marginTop: 4 }}
          >
            <Text style={{ color: colors.textSecondary, fontWeight: "600", fontSize: 15 }}>
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SourceTile({
  testID,
  Icon,
  iconColor,
  label,
  subtitle,
  primary,
  proLocked,
  comingSoon,
  accessibilityLabel,
  onPress,
  colors,
  cardElevation,
}: {
  testID: string;
  Icon: typeof Link2;
  iconColor: string;
  label: string;
  subtitle?: string;
  primary?: boolean;
  proLocked?: boolean;
  comingSoon?: boolean;
  accessibilityLabel: string;
  onPress?: () => void;
  colors: ReturnType<typeof useThemeColors>;
  cardElevation: ReturnType<typeof useCardElevation>;
}) {
  const disabled = comingSoon || !onPress;
  return (
    <PressableScale
      haptic={disabled ? "none" : "confirm"}
      testID={testID}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={{
        flex: 1,
        minHeight: 120,
        alignItems: "center",
        justifyContent: "center",
        gap: Spacing.sm,
        padding: Spacing.md,
        borderRadius: Radius.xl,
        backgroundColor: primary ? Accent.primary + "12" : colors.card,
        borderWidth: cardElevation.useBorder ? 1 : 0,
        borderColor: colors.border,
        opacity: disabled ? 0.72 : 1,
        ...(cardElevation.shadowStyle ?? {}),
      }}
    >
      <View style={{ position: "relative" }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.background,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={20} color={iconColor} strokeWidth={2} />
        </View>
        {proLocked ? (
          <View
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              width: 18,
              height: 18,
              borderRadius: 9,
              backgroundColor: Accent.warning + "1F",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock size={10} color={Accent.warningSolid} strokeWidth={2.5} />
          </View>
        ) : null}
      </View>
      <Text
        style={{
          fontFamily: FontFamily.serifMedium,
          fontSize: 15,
          color: colors.text,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
      {subtitle ? (
        <Text style={{ fontSize: 12, color: Accent.warningSolid, marginTop: -4 }}>{subtitle}</Text>
      ) : null}
      {comingSoon ? (
        <View
          style={{
            paddingHorizontal: Spacing.sm,
            paddingVertical: 2,
            borderRadius: Radius.full,
            backgroundColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 11, color: colors.textSecondary }}>Coming soon</Text>
        </View>
      ) : null}
    </PressableScale>
  );
}

export default CreateRecipeActionSheet;
