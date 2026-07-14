import React from "react";
import { View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Link, Pencil } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { ScreenSectionChrome } from "@/components/suppr/screen-section-chrome";
import { SubTabPill } from "@/components/ui/SubTabPill";
import { IconSize, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

export type RecipesTab = "library" | "discover";

/**
 * Sticky Recipes header — v3 prototype "Cook" tab (ENG-1247, 2026-06-24):
 * an overline "Cook" + serif "Your kitchen" title with pencil (Create) + link
 * (Import) icon actions, then the Cookbook / Discover underline tabs. The
 * "Your kitchen" title + "Cook" overline sit ABOVE the sub-tabs (constant for
 * both scopes), matching the prototype `.t-head` over `.seg-tabs`. Supersedes
 * the 2026-06-08 generic "Recipes" no-overline treatment (Figma retired —
 * the prototype is canonical). Web parity:
 * `src/app/components/suppr/recipes-tab-chrome.tsx`.
 */
export function RecipesTabChrome() {
  const router = useRouter();
  const pathname = usePathname();
  const colors = useThemeColors();

  const activeId: RecipesTab = pathname?.startsWith("/discover") ? "discover" : "library";

  return (
    <ScreenSectionChrome
      testID="recipes-tab-chrome"
      overline="Cook"
      title="Your kitchen"
      trailing={
        <View style={{ flexDirection: "row", gap: Spacing.xs }}>
          <PressableScale
            haptic="selection"
            onPress={() => router.push("/create-recipe")}
            accessibilityRole="button"
            accessibilityLabel="Create recipe"
            hitSlop={8}
            style={{ padding: 6 }}
          >
            {/* Neutral ink (not plum) — these quiet utilities defer to the serif
                title; matches web `text-foreground-secondary` + the prototype
                `.icon-btn` neutral `var(--fg)`. (ENG-1247 S2) */}
            <Pencil size={IconSize.lg} color={colors.textSecondary} strokeWidth={1.75} />
          </PressableScale>
          <PressableScale
            haptic="selection"
            onPress={() => router.push("/import-shared")}
            accessibilityRole="button"
            accessibilityLabel="Import recipe"
            hitSlop={8}
            style={{ padding: 6 }}
          >
            <Link size={IconSize.lg} color={colors.textSecondary} strokeWidth={1.75} />
          </PressableScale>
        </View>
      }
    >
      <SubTabPill<RecipesTab>
        embedded
        items={[
          { id: "library", label: "Cookbook" },
          { id: "discover", label: "Discover" },
        ]}
        activeId={activeId}
        onSelect={(id) => router.replace(`/(tabs)/${id}` as never)}
        accessibilityLabel="Recipes sections"
      />
    </ScreenSectionChrome>
  );
}

/** @deprecated Use `RecipesTabChrome` — kept for tests that import this path. */
export function RecipesSubTabHeader() {
  return <RecipesTabChrome />;
}

export default RecipesTabChrome;
