import { Image, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";

import { FontFamily, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";

/**
 * Paywall photo hero — Sloe Pro paywall (Figma `284:2`).
 *
 * Full-bleed finished-dish photograph at the top of the paywall, with
 * a soft fade into the page background, the "SLOE PRO" clay eyebrow,
 * and the editorial positioning headline overlaid on the fade. The
 * food-before-features opener (Julienne benchmark) — emotional desire
 * before rational comparison.
 *
 * The hero photo is a bundled local asset (`assets/images/
 * paywall-hero.jpg`) — NOT a remote URL. The paywall is trust-critical;
 * a network failure must never break the hero. Editorial finished-dish
 * image per the IMAGERY RULE (ceramic bowl, natural light, shallow DoF).
 *
 * The fade is a `react-native-svg` LinearGradient (transparent → page
 * background) — no new dependency (svg already ships for the rings).
 *
 * `kicker` + `title` + `subtitle` are passed in by the screen so the
 * existing context-adaptive header logic (`SLOE PRO` vs `CHOOSE YOUR
 * PLAN`, trial-aware title/subtitle) is preserved verbatim — this
 * component only restyles the presentation, never the copy logic.
 *
 * `titleStill` renders the frame's italic "Still" pivot when the
 * positioning headline is shown; the screen passes the split parts so
 * the italic span is a real Newsreader italic face, not synthesized.
 */
const HERO_IMAGE = require("../../assets/images/paywall-hero.jpg");

export function PaywallHero({
  kicker,
  title,
  subtitle,
  heroHeight,
  topInset,
}: {
  kicker: string;
  /** Headline. When `null`, the frame's two-line positioning headline
   *  ("Cook what you love. / *Still* reach your goals.") is rendered
   *  with the italic pivot; otherwise this string renders plain (the
   *  context-adaptive titles like "Unlock AI logging"). */
  title: string | null;
  subtitle: string;
  heroHeight: number;
  topInset: number;
}) {
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the hero eyebrow.
  const accent = useAccent();
  // Convert the page background hex to rgb() stops for the SVG fade
  // (svg `stop-color` doesn't take the page token directly). Bottom of
  // the image dissolves fully into the page so the eyebrow/headline sit
  // on the page colour, not on the photo.
  const bg = colors.background;

  return (
    <View style={{ height: heroHeight }}>
      <Image
        source={HERO_IMAGE}
        // Decorative — the headline carries the meaning for VoiceOver.
        accessibilityRole="image"
        accessibilityLabel=""
        accessible={false}
        resizeMode="cover"
        style={[StyleSheet.absoluteFill, { width: "100%", height: "100%" }]}
      />
      {/* Soft fade — transparent at the top third, solid page colour at
          the bottom, so the headline reads on the fade (frame `284:2`). */}
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="paywallHeroFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.25" stopColor={bg} stopOpacity={0} />
            <Stop offset="1" stopColor={bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#paywallHeroFade)" />
      </Svg>

      {/* Eyebrow + headline — bottom-anchored on the fade. */}
      <View
        style={{
          position: "absolute",
          left: Spacing.xl,
          right: Spacing.xl,
          bottom: Spacing.xl,
          // Keep clear of the safe-area / close button at the top.
          paddingTop: topInset,
        }}
      >
        <Text
          style={[
            Type.label,
            { color: accent.primarySolid, marginBottom: Spacing.sm },
          ]}
        >
          {kicker}
        </Text>
        {title === null ? (
          // Frame positioning headline with the italic "Still" pivot.
          <Text
            style={styles.headline(colors)}
            accessibilityRole="header"
            accessibilityLabel="Cook what you love. Still reach your goals."
          >
            Cook what you love.{"\n"}
            <Text style={styles.headlineItalic}>Still</Text> reach your goals.
          </Text>
        ) : (
          <Text style={styles.headline(colors)} accessibilityRole="header">
            {title}
          </Text>
        )}
        {subtitle ? (
          <Text style={[Type.bodyMuted, { color: colors.textSecondary, marginTop: Spacing.xs }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = {
  // Plum Newsreader serif headline — the Sloe display voice (matches the
  // frame `font-headline` headline). navPrimary is the plum brand hue.
  headline: (colors: ReturnType<typeof useThemeColors>) => ({
    fontFamily: FontFamily.serifRegular,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.4,
    color: colors.navPrimary,
  }),
  headlineItalic: {
    fontFamily: FontFamily.serifItalic,
    fontStyle: "italic" as const,
  },
};
