import * as React from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link as LinkIcon, Camera, Pencil, Clipboard as ClipboardIcon } from "lucide-react-native";
import { useRouter } from "expo-router";

import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { safeGetClipboardString } from "@/lib/safeClipboard";
import { extractUrlFromShareText } from "@/lib/resolveImportUrl";
import { detectSourcePlatform } from "@/lib/sourcePlatform";

/**
 * CreateRecipeActionSheet — bottom-sheet that replaces the single-route
 * "+ Create" affordance with a multi-source picker (audit refuse-to-pass
 * #8, 2026-05-12). Three entry points:
 *
 *   1. Paste a link — TikTok, Instagram, YouTube, blog post. Routes to
 *      /import-shared. When the clipboard contains a recognised URL,
 *      surfaces a "Paste {host}…" quick action at the top with one
 *      tap to skip the paste step entirely (Recime + Paprika pattern).
 *   2. Photo of a recipe — AI extracts ingredients + macros from a
 *      photo. Routes to /create-recipe with an autoPhoto flag the
 *      existing wizard reads to fire the photo picker immediately.
 *   3. Manual entry — the existing CreateRecipeWizard guided flow.
 *      Routes to /recipe/create.
 *
 * Pre-2026-05-12: tapping "+ Create" hard-routed to manual entry only.
 * The viral-growth lead bet (recipe import from Reel / TikTok URL) was
 * invisible from the canonical entry point. This sheet makes import a
 * first-class action.
 */

export interface CreateRecipeActionSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function CreateRecipeActionSheet({ visible, onClose }: CreateRecipeActionSheetProps) {
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();

  // Clipboard auto-detect: when the sheet opens, peek at the clipboard
  // for a recognised URL (Instagram / TikTok / YouTube / generic web).
  // The quick-action row surfaces only when a URL is present so we
  // don't show an empty placeholder. `null` = not yet read; string =
  // URL ready; "" = nothing useful.
  const [clipboardUrl, setClipboardUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (!visible) {
      setClipboardUrl(null);
      return;
    }
    let cancelled = false;
    (async () => {
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
      // Prefer the platform name where we have one (Instagram / TikTok
      // / YouTube), else fall back to the bare hostname.
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
    // Slight defer so the sheet's slide-down animation can begin
    // before the next route mount — feels less jarring than a hard
    // simultaneous transition.
    setTimeout(() => {
      router.push(params ? { pathname: pathname as never, params } : (pathname as never));
    }, 80);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
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
            backgroundColor: colors.card,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingTop: Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.xl,
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
          <Text
            style={{
              fontSize: 17,
              fontWeight: "700",
              color: colors.text,
              marginBottom: Spacing.md,
            }}
          >
            Add a recipe
          </Text>

          {/* Clipboard quick-action — only when a recognised URL is on
              the clipboard. Lets the user skip the paste step. */}
          {clipboardHost ? (
            <Pressable
              testID="create-action-sheet-clipboard-paste"
              accessibilityRole="button"
              accessibilityLabel={`Paste recipe link from ${clipboardHost}`}
              onPress={() => go("/import-shared", { url: clipboardUrl as string })}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                borderRadius: Radius.md,
                backgroundColor: `${Accent.primary}14`,
                borderWidth: 1,
                borderColor: `${Accent.primary}40`,
                marginBottom: Spacing.md,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <ClipboardIcon size={16} color={Accent.primary} strokeWidth={2} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: Accent.primary,
                  }}
                >
                  Paste from {clipboardHost}
                </Text>
                <Text
                  style={{
                    fontSize: 11,
                    color: colors.textSecondary,
                    marginTop: 1,
                  }}
                  numberOfLines={1}
                >
                  {clipboardUrl}
                </Text>
              </View>
            </Pressable>
          ) : null}

          <ActionRow
            testID="create-action-sheet-link"
            Icon={LinkIcon}
            iconColor={Accent.primary}
            title="Paste a link"
            subtitle="TikTok, Instagram, YouTube, blog post — anywhere on the web."
            onPress={() => go("/import-shared")}
            colors={colors}
          />
          <ActionRow
            testID="create-action-sheet-photo"
            Icon={Camera}
            iconColor={Accent.success}
            title="Photo of a recipe"
            subtitle="Snap a printed recipe or book page — AI fills in the macros."
            onPress={() => go("/create-recipe", { autoPhoto: "1" })}
            colors={colors}
          />
          <ActionRow
            testID="create-action-sheet-manual"
            Icon={Pencil}
            iconColor={colors.textSecondary}
            title="Manual entry"
            subtitle="Build a recipe step by step — ingredients, servings, macros."
            onPress={() => go("/recipe/create")}
            colors={colors}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={onClose}
            style={{ paddingVertical: 14, alignItems: "center", marginTop: 4 }}
          >
            <Text
              style={{
                color: colors.textSecondary,
                fontWeight: "600",
                fontSize: 15,
              }}
            >
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function ActionRow({
  testID,
  Icon,
  iconColor,
  title,
  subtitle,
  onPress,
  colors,
}: {
  testID: string;
  Icon: typeof LinkIcon;
  iconColor: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 12,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: `${iconColor}1A`,
          alignItems: "center",
          justifyContent: "center",
          marginTop: 1,
        }}
      >
        <Icon size={18} color={iconColor} strokeWidth={2} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
          {title}
        </Text>
        <Text
          style={{
            fontSize: 12,
            color: colors.textSecondary,
            marginTop: 3,
            lineHeight: 17,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

export default CreateRecipeActionSheet;
