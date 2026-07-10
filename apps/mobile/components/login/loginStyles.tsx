/**
 * Styles for `app/login.tsx`, extracted to keep the screen file shrinking
 * toward the 400-line target (ENG-1474 touch triggered the extraction).
 *
 * Presentation only — no behaviour, no testIDs. The Sloe DS reskin
 * (Figma chooser `296:2` / continue-with-email `296:33`, 2026-06-08):
 * white/cream ground, plum Newsreader serif wordmark + positioning headline,
 * full-pill ink Apple + outline email buttons, terms fine-print, 24px input
 * radii. The "Sign in with Apple" ink fill uses `colors.text` (theme ink)
 * for the pill and `Accent.primaryForeground` for the glyph/label — Apple's
 * HIG-brand black/white carve-out is applied at the button in `login.tsx`,
 * not here.
 */
import { StyleSheet } from "react-native";

import { Accent, FontFamily, Radius, Spacing, Type } from "@/constants/theme";
import type { useThemeColors } from "@/hooks/use-theme-colors";

export function makeLoginStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: Spacing.xxl,
    },
    closeRow: {
      flexDirection: "row",
      justifyContent: "flex-end",
      paddingTop: Spacing.sm,
    },
    closeBtn: {
      width: 40,
      height: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    centerBody: {
      flex: 1,
      justifyContent: "center",
    },
    brandSection: {
      alignItems: "center",
    },
    // Plum Newsreader serif positioning headline — mirrors the `296:2`
    // chooser H1 (`navPrimary` is theme-aware: light #3B2A4D / dark #815E91).
    headline: {
      fontFamily: FontFamily.serifMedium,
      fontSize: 30,
      fontWeight: "500",
      letterSpacing: -0.3,
      lineHeight: 36,
      color: colors.navPrimary,
      textAlign: "center",
      marginTop: Spacing.xl,
    },
    headlineItalic: {
      fontFamily: FontFamily.serifItalic,
      fontStyle: "italic",
    },
    // Plum Newsreader serif heading for the email step (Welcome back /
    // Create your account).
    title: {
      fontFamily: FontFamily.serifSemibold,
      fontSize: 28,
      fontWeight: "500",
      letterSpacing: -0.4,
      lineHeight: 34,
      color: colors.navPrimary,
      textAlign: "center",
      marginTop: Spacing.md,
    },
    tagline: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: Spacing.md,
      textAlign: "center",
      lineHeight: 20,
    },
    chooser: { marginTop: Spacing.xxxl },
    form: { gap: Spacing.md, marginTop: Spacing.xl },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      color: colors.text,
      fontSize: 16,
    },
    // Primary CTA — clay pill (Sloe three-role colour law: clay is the
    // one commit action per screen).
    btn: {
      backgroundColor: colors.tint,
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      alignItems: "center",
      marginTop: Spacing.sm,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 17 },
    errorText: { color: Accent.destructive, fontSize: 13, textAlign: "center" },
    hint: {
      color: colors.textSecondary,
      fontSize: 13,
      textAlign: "center",
      marginTop: Spacing.sm,
    },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: Spacing.xs,
      alignSelf: "flex-start",
      marginBottom: Spacing.md,
    },
    backText: { color: colors.textSecondary, fontSize: 14, fontWeight: "500" },
    // Continue with Apple — full-pill ink button (`296:2` chooser).
    appleBtn: {
      backgroundColor: colors.text,
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.sm,
    },
    appleBtnText: { color: Accent.primaryForeground, fontWeight: "700", fontSize: 17 },
    // Continue with email — outline pill (`296:2` chooser).
    emailBtn: {
      backgroundColor: colors.background,
      paddingVertical: Spacing.md,
      borderRadius: Radius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    emailBtnText: { color: colors.navPrimary, fontWeight: "700", fontSize: 17 },
    termsFinePrint: {
      ...Type.captionSmall,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: Spacing.xl,
      lineHeight: 17,
    },
    termsFinePrintLink: { textDecorationLine: "underline" },
    termsRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    termsCheckbox: {
      width: 18,
      height: 18,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },
    termsCheckboxChecked: {
      backgroundColor: colors.tint,
      borderColor: colors.tint,
    },
    termsText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 },
    termsLink: { color: colors.text, textDecorationLine: "underline", fontWeight: "600" },
  });
}
