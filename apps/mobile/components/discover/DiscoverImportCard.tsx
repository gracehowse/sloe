import { Pressable, Text, View } from "react-native";
import { Link as LinkIcon, ChevronRight } from "lucide-react-native";

import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { isFeatureEnabled } from "@/lib/analytics";
import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { IconBox } from "@/components/discover/IconBox";

/**
 * DiscoverImportCard — the permanent import-from-Reel slab that leads the mobile
 * Discover feed (premium-bar audit DC13; ENG-1087/1089), the viral-hook
 * acquisition surface. Extracted from the pinned `(tabs)/discover.tsx` host so
 * the screen stays a thin composition shell (ENG-1225 #14 screen-budget).
 *
 * `discover_import_hero_v1` ON (`hero`) → the raised hero affordance (solid plum
 * icon, serif title, "Paste link" pill). OFF → the legacy aubergine soft-tint
 * nav row (kill switch). `sloe_v3_unified_import` ON → the hero opens the unified
 * "import anything" sheet (`onOpenUnified`); else the legacy `/import-shared`
 * nav (`onOpenLegacyImport`). testID `discover-import-cta` preserved for the
 * Maestro 25_import_shared flow.
 */
export interface DiscoverImportCardProps {
  /** `discover_import_hero_v1` — hero affordance vs legacy nav-row slab. */
  hero: boolean;
  /** Discover's one deliberate content accent (clay), for the legacy slab. */
  accentColor: string;
  /** Open the unified import sheet (hero path, `sloe_v3_unified_import`). */
  onOpenUnified: () => void;
  /** Navigate to the legacy `/import-shared` screen. */
  onOpenLegacyImport: () => void;
}

export function DiscoverImportCard({
  hero,
  accentColor,
  onOpenUnified,
  onOpenLegacyImport,
}: DiscoverImportCardProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  if (hero) {
    // ENG-1087 — raised weight: SOLID plum icon + filled "Paste link" pill, the
    // whole slab taps through. ENG-1225 #3: `sloe_v3_unified_import` ON opens the
    // unified sheet; OFF keeps the legacy nav.
    return (
      <Pressable
        onPress={() => (isFeatureEnabled("sloe_v3_unified_import") ? onOpenUnified() : onOpenLegacyImport())}
        accessibilityRole="button"
        accessibilityLabel="Import from TikTok, Instagram, YouTube or a website"
        testID="discover-import-cta"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: Spacing.md,
          padding: Spacing.md,
          borderRadius: CARD_RADIUS,
          // ENG-1094 (Grace): a confident lavender-plum accent — Discover's one
          // deliberate accent — not the muddy ~20% wash that read as grey.
          backgroundColor: colors.importHeroBg,
          marginBottom: Spacing.md,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: Radius.full,
            backgroundColor: accent.primarySolid,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LinkIcon size={20} color={Accent.primaryForeground} />
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ ...Type.headline, color: colors.navPrimary }}>Import from TikTok, Instagram & YouTube</Text>
          <Text style={{ ...Type.caption, color: colors.textSecondary }}>Paste a link or share from any app</Text>
        </View>
        <View
          style={{
            paddingHorizontal: Spacing.dense,
            paddingVertical: Spacing.sm,
            borderRadius: Radius.full,
            backgroundColor: accent.primarySolid,
          }}
        >
          <Text style={{ ...Type.caption, fontWeight: "600", color: Accent.primaryForeground }}>Paste link</Text>
        </View>
      </Pressable>
    );
  }

  // Legacy nav-row slab (flag-off / kill switch). 2026-05-12 premium-bar audit
  // DC13 + ENG-1082: a DELIBERATE soft-tint affordance, NOT a white recipe card,
  // so it stands apart from the white feed cards (Sloe treatment §10).
  return (
    <Pressable
      onPress={onOpenLegacyImport}
      accessibilityRole="button"
      accessibilityLabel="Import from TikTok, Instagram, YouTube or a website"
      testID="discover-import-cta"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: Spacing.md,
        padding: Spacing.md,
        borderRadius: CARD_RADIUS,
        backgroundColor: accent.primarySoft,
        marginBottom: Spacing.md,
      }}
    >
      <IconBox color={accentColor} size={36}>
        <LinkIcon size={18} color={accentColor} />
      </IconBox>
      <View style={{ flex: 1 }}>
        <Text style={{ ...Type.body, fontWeight: "600", color: colors.text }}>Import from TikTok, Instagram & YouTube</Text>
        <Text style={{ ...Type.caption, color: colors.textSecondary, marginTop: 1 }}>Paste a link or share from any app</Text>
      </View>
      <ChevronRight size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

export default DiscoverImportCard;
