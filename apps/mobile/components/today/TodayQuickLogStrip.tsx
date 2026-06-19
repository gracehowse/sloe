import React, { memo } from "react";
import { Pressable, Text, View } from "react-native";
import {
  Camera,
  Lock,
  Mic,
  ScanBarcode,
  Search,
  type LucideIcon,
} from "lucide-react-native";
import { Accent, IconSize, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";

/**
 * TodayQuickLogStrip — 4 chips: Search / Voice / Snap / Scan.
 *
 * Extracted from `apps/mobile/app/(tabs)/index.tsx` (audit H3,
 * 2026-04-18). Voice + Snap are Pro-gated (Batch 5.13); the gating +
 * paywall dispatch stay in the host.
 *
 * 2026-04-27 — production design spec §1.5: Ionicons → lucide
 * (Search / Mic / Camera / ScanBarcode / Lock).
 *
 * 2026-05-01 — ui-critic finding #1 (P0). Lifted from a 28pt tinted
 * square + 10pt label into a 56pt tile + 36pt tinted icon container
 * (`IconSize.lg` = 18pt glyph) + 12pt `Type.caption` label. The tile
 * is the primary log-affordance under the hero ring; "primary" should
 * read primary. The redundant `cardColor` outer border was dropped —
 * the tinted icon container now carries the colour identity, which
 * is the same model the web `IconBox` uses.
 */
/** Outer tile minimum height — matches the web `<button>` after the
 *  2026-05-01 sizing lift (`IconBox size="md"` + `text-sm` label). */
const TILE_MIN_HEIGHT = 56;
/** Tinted icon-container size — large enough to host an 18pt glyph
 *  with breathing room. Mirrors web `IconBox size="md"` (`size-9` = 36px). */
const ICON_TILE = 36;
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

function TodayQuickLogStripImpl({
  userTier,
  onOpenSearch,
  onOpenVoice,
  onOpenPhoto,
  onOpenBarcode,
  cardColor,
  cardBorderColor: _cardBorderColor,
  textSecondaryColor,
  textTertiaryColor,
}: TodayQuickLogStripProps) {
  // The redundant outer border was dropped 2026-05-01 (ui-critic #1) —
  // the tinted icon container carries the colour identity. Prop kept on
  // the public contract for caller compatibility / future opt-in.
  void _cardBorderColor;
  // Snap chip uses the scheme-resolved accent primary so the camera icon
  // tint stays visible on dark (deep plum #3B2A4D is invisible on near-black).
  const accent = useAccent();
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
    { label: "Snap", Glyph: Camera, color: accent.primary, onPress: onOpenPhoto, locked: proLocked },
    { label: "Scan", Glyph: ScanBarcode, color: Accent.magenta, onPress: onOpenBarcode, locked: false },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        gap: Spacing.sm,
        marginTop: Spacing.md,
        marginBottom: Spacing.lg,
      }}
    >
      {entries.map(({ label, Glyph, color, onPress, locked }) => (
        <Pressable
          key={label}
          testID={`today-quick-log-${label.toLowerCase()}`}
          accessibilityRole="button"
          accessibilityLabel={locked ? `${label} — Pro feature` : label}
          onPress={onPress}
          style={{
            flex: 1,
            minHeight: TILE_MIN_HEIGHT,
            alignItems: "center",
            justifyContent: "center",
            gap: Spacing.xs,
            paddingVertical: Spacing.sm,
            paddingHorizontal: Spacing.xs,
            borderRadius: CARD_RADIUS,
            backgroundColor: cardColor,
          }}
        >
          <View
            style={{
              width: ICON_TILE,
              height: ICON_TILE,
              borderRadius: Radius.sm,
              backgroundColor: color + "18",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Glyph size={IconSize.lg} color={color} strokeWidth={2.25} />
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs }}>
            <Text
              style={{
                ...Type.caption,
                color: textSecondaryColor,
                fontVariant: ["tabular-nums"],
              }}
            >
              {label}
            </Text>
            {locked && <Lock size={9} color={textTertiaryColor} strokeWidth={2.25} />}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export const TodayQuickLogStrip = memo(TodayQuickLogStripImpl);

export default TodayQuickLogStrip;
