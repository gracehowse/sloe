/**
 * Recipe detail — title block (Figma `332:2`, section 2). Web parity:
 * the title block in `src/app/components/RecipeDetail.tsx`.
 *
 * - Title: Newsreader serif 36/45, plum.
 * - Attribution (when a source exists): `via @handle · See original`. The
 *   handle is tappable (opens the source / creator); "See original" opens the
 *   source URL. Hidden when there is no source.
 * - "Fits your day" verdict: an inline soft pill (`*Soft` tone tint, sage
 *   fits / amber over-half / red over-a-day) behind `recipe_verdict_chip_v1`
 *   (default-OFF; ENG-1612). Flag-off keeps the ENG-1085 confident SOLID
 *   full-width banner as the kill switch — see
 *   docs/decisions/2026-07-19-fits-your-day-verdict-chip.md.
 */
import { useEffect } from "react";
import { Linking, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Accent, FontFamily, Radius, Spacing } from "@/constants/theme";
import { isFeatureEnabled } from "@/lib/analytics";
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
  // exist. It shipped as a confident SOLID verdict banner (white on a *Solid
  // tone, AA-safe). ENG-1612 (2026-07-19, Grace: "fits your day is too big
  // and agressive" — annotated screenshot, Soothing Chicken Congee)
  // supersedes that carve-out: prototype canon
  // (docs/ux/redesign/v3/Sloe-App.html `.rd-fits`, ~L2055) is an inline soft
  // pill, not a full-width slab. Behind `recipe_verdict_chip_v1`
  // (default-OFF — see docs/decisions/2026-07-19-fits-your-day-verdict-chip.md):
  // flag-on renders the soft chip below; flag-off keeps this SOLID banner as
  // the kill switch.
  const verdictChipV1 = isFeatureEnabled("recipe_verdict_chip_v1");
  const fits = verdict?.fits ?? false;
  // A one-shot "felt yes" when the recipe fits your day — the moment that
  // builds the import-then-check habit. Fires once per detail open / per
  // re-fit; success notification haptic only. Unchanged by the chip/banner
  // treatment — this is about the verdict itself, not its presentation.
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
  // ENG-1612 — soft-chip tone pair: `*Soft` tint background + AA-safe text.
  // `Accent.warning` fails as text (2.96:1, documented FILLS-ONLY in
  // theme.ts) so the warning tone reads `warningSolid`, mirroring the web
  // `icon-box` tone map (`bg-warning-soft text-warning-solid`). Success and
  // destructive base tones clear AA as text (~4.7:1 / ~4.9:1+ on the cream
  // ground), matching the existing `TrustChip` soft-pill pairing.
  const chipTone = verdict
    ? verdict.tone === "success"
      ? { bg: Accent.successSoft, fg: Accent.success }
      : verdict.tone === "warning"
        ? { bg: Accent.warningSoft, fg: Accent.warningSolid }
        : { bg: Accent.destructiveSoft, fg: Accent.destructive }
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

      {verdict && verdictChipV1 && chipTone ? (
        // ENG-1612 — prototype-scale inline soft pill (`.rd-fits`): 11px
        // semibold, `*Soft` tone tint, 4/12 padding (Spacing.xs/Spacing.dense —
        // both on-scale), radius full. Same scale as the card-level `.fit-tag`.
        <View
          testID="recipe-fits-your-day"
          accessibilityRole="text"
          accessibilityLabel={verdict.a11y}
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: Spacing.xs,
            paddingHorizontal: Spacing.dense,
            paddingVertical: Spacing.xs,
            borderRadius: Radius.full,
            backgroundColor: chipTone.bg,
          }}
        >
          {fits ? <Check size={12} color={chipTone.fg} strokeWidth={3} /> : null}
          <Text
            style={{ fontFamily: FontFamily.sansSemibold, fontSize: 11, fontWeight: "600", color: chipTone.fg }}
            numberOfLines={1}
          >
            {verdict.label}
          </Text>
        </View>
      ) : verdict && bannerBg ? (
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
