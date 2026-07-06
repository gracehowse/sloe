/**
 * Recipe detail — title block (Figma `332:2`, section 2). Web parity:
 * the title block in `src/app/components/RecipeDetail.tsx`.
 *
 * - Title: Newsreader serif 36/45, plum.
 * - Attribution (when a source exists): `via @handle · See original`. The
 *   handle is tappable (opens the source / creator); "See original" opens the
 *   source URL. Hidden when there is no source.
 * - "Fits your day" verdict chip: sage pill (sage bg @ 10%, sage text) with a
 *   checkmark when the recipe fits roughly half the day or less; amber/red
 *   tones for over-half / over-a-day. This is the recipe's fit-to-target
 *   verdict (the existing "% of your day" computation), restyled per the frame.
 */
import { useEffect } from "react";
import { Linking, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Accent, FontFamily, Radius, Spacing } from "@/constants/theme";
import { useHaptics } from "@/hooks/useHaptics";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { FitsYourDayVerdict } from "@/lib/recipe/recipeDetailLayout";

type Attribution = {
  /** Display handle / author label (e.g. "@getherednutrition"). */
  label: string;
  /** Tappable target for the handle — route ("/creator/…") or URL. */
  handleHref: string | null;
  /** "See original" target — the source URL, when present. */
  originalHref: string | null;
};

function openHref(href: string, push: (route: string) => void) {
  if (href.startsWith("/")) push(href);
  else void Linking.openURL(href);
}

export function RecipeTitleBlock({
  title,
  attribution,
  verdict,
  onNavigate,
  hideTitle = false,
}: {
  title: string;
  attribution: Attribution | null;
  verdict: FitsYourDayVerdict | null;
  onNavigate: (route: string) => void;
  /** ENG-1247 — when the v3 hero title overlay is showing (photo present), the
   *  H1 lives on the hero; the body block then renders attribution + verdict
   *  only, never a duplicate title. */
  hideTitle?: boolean;
}) {
  const colors = useThemeColors();
  const haptics = useHaptics();

  // ENG-1085 — the "Fits your day" differentiator is the screen's reason to
  // exist; render it as a confident SOLID verdict banner (white on a *Solid
  // tone, AA-safe), not the old 10%-wash pill.
  const fits = verdict?.fits ?? false;
  // A one-shot "felt yes" when the recipe fits your day — the moment that
  // builds the import-then-check habit. Fires once per detail open / per
  // re-fit; success notification haptic only.
  useEffect(() => {
    if (fits) {
      haptics.success();
    }
  }, [fits, haptics]);
  // Lead verb loud, the "% of your day" trailing quieter — split the shared
  // verdict label on its " · " separator (degrades to all-head if absent).
  const [bannerHead, ...bannerRest] = (verdict?.label ?? "").split(" · ");
  const bannerTail = bannerRest.join(" · ");
  const bannerBg = verdict
    ? verdict.tone === "success"
      ? Accent.successSolid
      : verdict.tone === "warning"
        ? Accent.warningSolid
        : Accent.destructiveSolid
    : null;

  return (
    <View style={{ gap: Spacing.dense }} testID="recipe-title-block">
      {hideTitle ? null : (
        <Text
          style={{
            fontFamily: FontFamily.serifRegular,
            fontSize: 34,
            lineHeight: 42,
            fontWeight: "400",
            letterSpacing: -0.4,
            color: colors.navPrimary,
          }}
        >
          {title}
        </Text>
      )}

      {attribution ? (
        <Text
          style={{ fontFamily: FontFamily.sansRegular, fontSize: 14, color: colors.textSecondary }}
          testID="recipe-attribution"
        >
          via{" "}
          {attribution.handleHref ? (
            <Text
              onPress={() => openHref(attribution.handleHref as string, onNavigate)}
              style={{ fontFamily: FontFamily.sansMedium, fontWeight: "500", color: colors.text }}
              accessibilityRole="link"
            >
              {attribution.label}
            </Text>
          ) : (
            <Text style={{ fontFamily: FontFamily.sansMedium, fontWeight: "500", color: colors.text }}>
              {attribution.label}
            </Text>
          )}
          {attribution.originalHref ? (
            <Text>
              {"  ·  "}
              <Text
                onPress={() => openHref(attribution.originalHref as string, onNavigate)}
                style={{ textDecorationLine: "underline", color: colors.textSecondary }}
                accessibilityRole="link"
              >
                See original
              </Text>
            </Text>
          ) : null}
        </Text>
      ) : null}

      {verdict && bannerBg ? (
        <View
          testID="recipe-fits-your-day"
          accessibilityRole="text"
          accessibilityLabel={verdict.a11y}
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "stretch",
            gap: Spacing.sm,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.dense,
            borderRadius: Radius.xl,
            backgroundColor: bannerBg,
          }}
        >
          {fits ? <Check size={18} color={Accent.primaryForeground} strokeWidth={3} /> : null}
          <Text
            style={{ fontFamily: FontFamily.sansSemibold, fontSize: 15, fontWeight: "700", color: Accent.primaryForeground }}
            numberOfLines={1}
          >
            {bannerHead}
          </Text>
          {bannerTail ? (
            <Text
              style={{
                fontFamily: FontFamily.sansMedium,
                fontSize: 13,
                color: "rgba(255,255,255,0.82)",
                marginLeft: "auto",
              }}
              numberOfLines={1}
            >
              {bannerTail}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export type { Attribution as RecipeAttribution };
