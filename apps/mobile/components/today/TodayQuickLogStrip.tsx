import React from "react";
import { Pressable, Text, View } from "react-native";
import {
  Camera,
  Lock,
  Mic,
  ScanBarcode,
  Search,
  type LucideIcon,
} from "lucide-react-native";
import { Accent } from "@/constants/theme";

/**
 * TodayQuickLogStrip — 4 chips: Search / Voice / Snap / Scan.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). Voice + Snap are Pro-gated (Batch 5.13); the gating +
 * paywall dispatch stay in the host.
 *
 * 2026-04-27 — production design spec §1.5: Ionicons → lucide
 * (Search / Mic / Camera / ScanBarcode / Lock).
 */
export interface TodayQuickLogStripProps {
  userTier: "free" | "base" | "pro";
  onOpenSearch: () => void;
  onOpenVoice: () => void;
  onOpenPhoto: () => void;
  onOpenBarcode: () => void;
  cardColor: string;
  cardBorderColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
}

export function TodayQuickLogStrip({
  userTier,
  onOpenSearch,
  onOpenVoice,
  onOpenPhoto,
  onOpenBarcode,
  cardColor,
  cardBorderColor,
  textSecondaryColor,
  textTertiaryColor,
}: TodayQuickLogStripProps) {
  const proLocked = userTier !== "pro";
  const entries: readonly {
    label: string;
    Glyph: LucideIcon;
    color: string;
    onPress: () => void;
    locked: boolean;
  }[] = [
    { label: "Search", Glyph: Search, color: Accent.warning, onPress: onOpenSearch, locked: false },
    { label: "Voice", Glyph: Mic, color: Accent.success, onPress: onOpenVoice, locked: proLocked },
    { label: "Snap", Glyph: Camera, color: Accent.primary, onPress: onOpenPhoto, locked: proLocked },
    { label: "Scan", Glyph: ScanBarcode, color: Accent.magenta, onPress: onOpenBarcode, locked: false },
  ];
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
      {entries.map(({ label, Glyph, color, onPress, locked }) => (
        <Pressable
          key={label}
          testID={`today-quick-log-${label.toLowerCase()}`}
          accessibilityRole="button"
          accessibilityLabel={locked ? `${label} — Pro feature` : label}
          onPress={onPress}
          style={{
            flex: 1,
            alignItems: "center",
            gap: 5,
            paddingVertical: 10,
            paddingHorizontal: 4,
            borderRadius: 12,
            backgroundColor: cardColor,
            borderWidth: 1,
            borderColor: cardBorderColor,
          }}
        >
          <View
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              backgroundColor: color + "18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Glyph size={14} color={color} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Text style={{ fontSize: 10, fontWeight: "500", color: textSecondaryColor }}>{label}</Text>
            {locked && <Lock size={9} color={textTertiaryColor} />}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export default TodayQuickLogStrip;
