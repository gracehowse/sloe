import { Image, StyleSheet, Text, View } from "react-native";
import { CircleCheck } from "lucide-react-native";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { Radius, Spacing, Type } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { decodeEntities } from "@/lib/decodeEntities";
import type { CreatorProfileModel } from "./useCreatorProfile";

export function CreatorProfileHeader({ creator }: { creator: CreatorProfileModel }) {
  const colors = useThemeColors();
  const accent = useAccent();
  const v3 = isFeatureEnabled("creator_profile_v3");

  if (!v3) {
    return (
      <View style={stylesLegacy.header}>
        {creator.avatar_url ? (
          <Image source={{ uri: creator.avatar_url }} style={stylesLegacy.avatar} accessibilityIgnoresInvertColors />
        ) : (
          <View style={[stylesLegacy.avatar, stylesLegacy.avatarFallback, { backgroundColor: accent.primary }]}>
            <Text style={[stylesLegacy.avatarFallbackText, { color: colors.primaryForeground }]}>
              {creator.display_name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={stylesLegacy.headerNameRow}>
          <Text style={[stylesLegacy.displayName, { color: colors.text }]}>
            {decodeEntities(creator.display_name)}
          </Text>
          {creator.is_verified ? (
            <CircleCheck size={18} color={accent.primary} accessibilityLabel="Verified creator" />
          ) : null}
        </View>
        <Text style={[stylesLegacy.handle, { color: colors.textSecondary }]}>@{creator.handle}</Text>
        {creator.bio ? (
          <Text style={[stylesLegacy.bio, { color: colors.text }]}>{decodeEntities(creator.bio)}</Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={stylesV3.row} testID="creator-profile-header-v3">
      {creator.avatar_url ? (
        <Image source={{ uri: creator.avatar_url }} style={stylesV3.avatar} accessibilityIgnoresInvertColors />
      ) : (
        <View style={[stylesV3.avatar, stylesV3.avatarFallback, { backgroundColor: accent.primary }]}>
          <Text style={[stylesV3.avatarInitial, { color: colors.primaryForeground }]}>
            {creator.display_name.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={stylesV3.body}>
        <View style={stylesV3.nameRow}>
          <Text style={[stylesV3.displayName, { color: colors.text }]}>
            {decodeEntities(creator.display_name)}
          </Text>
          {creator.is_verified ? (
            <CircleCheck size={18} color={accent.primary} accessibilityLabel="Verified creator" />
          ) : null}
        </View>
        <Text style={[stylesV3.handle, { color: colors.textSecondary }]}>@{creator.handle}</Text>
        {creator.bio ? (
          <Text style={[stylesV3.bio, { color: colors.text }]}>{decodeEntities(creator.bio)}</Text>
        ) : null}
      </View>
    </View>
  );
}

const stylesLegacy = StyleSheet.create({
  header: { alignItems: "center", paddingVertical: Spacing.lg },
  avatar: { width: 96, height: 96, borderRadius: 48, marginBottom: Spacing.sm },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontSize: 36, fontWeight: "700" },
  headerNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  displayName: { fontSize: 22, fontWeight: "700" },
  handle: { fontSize: 14, marginTop: 2 },
  bio: {
    fontSize: 14,
    textAlign: "center",
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.md,
    lineHeight: 20,
  },
});

const stylesV3 = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, paddingVertical: Spacing.md },
  avatar: { width: 64, height: 64, borderRadius: Radius.full },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  avatarInitial: { ...Type.title, fontWeight: "600" },
  body: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  displayName: { ...Type.title, fontWeight: "600" },
  handle: { ...Type.caption, marginTop: 2 },
  bio: { ...Type.body, marginTop: Spacing.sm, lineHeight: 20 },
});
