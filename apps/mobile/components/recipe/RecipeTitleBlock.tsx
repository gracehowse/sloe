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
import { Linking, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { Accent, FontFamily, Radius } from "@/constants/theme";
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
}: {
  title: string;
  attribution: Attribution | null;
  verdict: FitsYourDayVerdict | null;
  onNavigate: (route: string) => void;
}) {
  const colors = useThemeColors();

  const verdictTone = verdict
    ? verdict.tone === "success"
      ? { fg: "#5E7C5A", bg: "rgba(94,124,90,0.1)" }
      : verdict.tone === "warning"
        ? { fg: Accent.warningSolid, bg: "rgba(201,137,44,0.12)" }
        : { fg: Accent.destructiveSolid, bg: "rgba(192,83,63,0.12)" }
    : null;

  return (
    <View style={{ gap: 12 }} testID="recipe-title-block">
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

      {verdict && verdictTone ? (
        <View
          testID="recipe-fits-your-day"
          accessibilityRole="text"
          accessibilityLabel={verdict.a11y}
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            gap: 6,
            height: 36,
            paddingHorizontal: 14,
            borderRadius: Radius.full,
            backgroundColor: verdictTone.bg,
          }}
        >
          {verdict.fits ? <Check size={15} color={verdictTone.fg} strokeWidth={3} /> : null}
          <Text
            style={{ fontFamily: FontFamily.sansSemibold, fontSize: 13, fontWeight: "700", color: verdictTone.fg }}
            numberOfLines={1}
          >
            {verdict.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export type { Attribution as RecipeAttribution };
