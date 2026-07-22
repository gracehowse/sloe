import { useMemo } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { CheckCircle2, ChefHat, BarChart3, Flag, Tag, ChevronDown, ChevronUp, type LucideIcon } from "lucide-react-native";

import { PressableScale } from "@/components/ui/PressableScale";
import { Accent, Spacing, Radius, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { PaywallHero } from "@/components/paywall/PaywallHero";
import { PaywallValueGrid } from "@/components/paywall/PaywallValueGrid";
import { PaywallComparison } from "@/components/paywall/PaywallComparison";
import { PaywallPlanSelector } from "@/components/paywall/PaywallPlanSelector";
import { PaywallCta } from "@/components/paywall/PaywallCta";
import { PaywallNoPaymentChip } from "@/components/paywall/PaywallNoPaymentChip";
import { PaywallTrustStrip } from "@/components/paywall/PaywallTrustStrip";
import { PaywallPersonalisedPlanCard } from "@/components/paywall/PaywallPersonalisedPlanCard";
import { PaywallTrajectoryChart } from "@/components/paywall/PaywallTrajectoryChart";
import { TrialEndReminderPaywallBlock } from "@/components/paywall/TrialEndReminderPaywallBlock";
import { isFeatureEnabled } from "@/lib/analytics";
import type { useOnboardingInlinePaywall } from "./useOnboardingInlinePaywall";

/** Render timing of the Day-7-trial-ends timeline — mirrors `apps/mobile/app/paywall.tsx`. */
const TIMELINE: { icon: LucideIcon; color: string; soft: string; title: string; desc: string }[] = [
  {
    icon: CheckCircle2, color: Accent.success, soft: Accent.successSoft,
    title: "Your targets are set",
    desc: "Calorie budget and macro targets based on your goals.",
  },
  {
    icon: ChefHat, color: Accent.success, soft: Accent.successSoft,
    title: "Today: Start importing recipes",
    desc: "Grab recipes from Instagram, TikTok, or any website — we'll handle the nutrition.",
  },
  {
    icon: BarChart3, color: Accent.info, soft: Accent.infoSoft,
    title: "This week: Save and plan",
    desc: "Save recipes, verify nutrition, and start a meal plan.",
  },
  {
    icon: Flag, color: Accent.warningSolid, soft: Accent.warningSoft,
    title: "Day 7: Trial ends",
    desc: "Your trial ends. Continue with Pro or switch to the free plan.",
  },
];

export interface PaywallContentProps {
  offer: ReturnType<typeof useOnboardingInlinePaywall>;
}

/**
 * ENG-1459 — the onboarding terminal step's merged inline paywall body.
 * Sibling of `apps/mobile/app/paywall.tsx`'s render tree, adapted for
 * inline placement inside `MobileStepBody` (already a `ScrollView` —
 * see its own doc comment): no outer `ScrollView`, no close button, no
 * `position: absolute` sticky footer. The primary CTA + "Restore
 * purchase" that live in the standalone route's sticky footer are
 * promoted into the natural document flow here instead (both already
 * ALSO render in-scroll on the standalone route — see the ENG-1459
 * preservation checklist items #2 and #9 — so nothing legally-required
 * is lost, only the "pinned to the screen bottom" convenience UX).
 */
export function PaywallContent({ offer }: PaywallContentProps) {
  const colors = useThemeColors();
  const accent = useAccent();

  const styles = useMemo(() => StyleSheet.create({
    heroBleed: { marginHorizontal: -Spacing.xl, marginBottom: Spacing.lg },
    freeBtn: { paddingVertical: Spacing.md, alignItems: "center" },
    freeBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: 15 },
    disclosure: {
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      padding: Spacing.md,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
      borderRadius: Radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.backgroundSecondary,
    },
    timelineWrap: { marginTop: Spacing.xl },
    timelineHeader: { ...Type.headline, color: colors.navPrimary, marginBottom: Spacing.md },
    timelineItem: { flexDirection: "row", gap: Spacing.md },
    timelineIconWrap: { alignItems: "center", width: 30 },
    timelineDot: { width: 28, height: 28, borderRadius: Radius.full, justifyContent: "center", alignItems: "center" },
    timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
    timelineContent: { flex: 1, paddingBottom: Spacing.lg },
    timelineTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    timelineDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 0, lineHeight: 18 },
    promoWrap: {
      marginTop: Spacing.xl,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: Spacing.lg,
    },
    promoTrigger: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.xs, paddingVertical: Spacing.sm },
    promoTriggerText: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    promoExpandedBlock: { marginTop: Spacing.sm, gap: Spacing.sm },
    promoHint: { ...Type.captionSmall, color: colors.textSecondary, lineHeight: 17 },
    promoInputRow: { flexDirection: "row", gap: Spacing.sm },
    promoInput: {
      flex: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.dense,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      color: colors.text,
      fontSize: 14,
    },
    promoApplyBtn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.dense,
      borderRadius: Radius.full,
      backgroundColor: accent.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    promoApplyBtnDisabled: { opacity: 0.4 },
    promoApplyBtnText: { color: colors.primaryForeground, fontWeight: "700", fontSize: 14 },
    secondaryRail: { flexDirection: "row", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: Spacing.md, marginTop: Spacing.xxl },
    secondaryLink: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    secondaryDot: { fontSize: 14, color: colors.border },
    secondaryNote: { fontSize: 11, color: colors.textSecondary, textAlign: "center", marginTop: Spacing.sm },
    nutritionEstimateNote: {
      ...Type.captionSmall,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 17,
      marginTop: Spacing.xs,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.md,
    },
    ctaStack: { gap: Spacing.sm, marginTop: Spacing.md },
  }), [colors, accent]);

  if (offer.alreadyEntitled) return null;

  const primaryPurchaseCta = !offer.offeringsReady ? (
    <PaywallCta label="Loading plans…" color={accent.primary} disabled loading={false} onPress={() => undefined} />
  ) : offer.subscriptionsUnavailable ? (
    <PaywallCta
      label="Open the App Store"
      color={accent.primary}
      disabled={false}
      loading={false}
      onPress={() => { void Linking.openURL("itms-apps://apps.apple.com/account/subscriptions"); }}
    />
  ) : offer.hasPro ? (
    <PaywallCta
      label={
        !offer.currentProPkg
          ? "Loading plans…"
          : offer.trialApplies
            ? "Start free 7-day trial"
            : `Subscribe — ${offer.currentProPkg.product.priceString}${offer.periodSuffix}`
      }
      accessibilityLabel={
        !offer.currentProPkg
          ? "Loading plans…"
          : offer.trialApplies
            ? "Start free 7-day trial"
            : `Subscribe — ${offer.currentProPkg.product.priceString} ${offer.periodWord}`
      }
      color={offer.trialApplies ? Accent.success : accent.primary}
      disabled={!offer.currentProPkg || offer.purchasing !== null}
      loading={offer.purchasing === "pro"}
      arrow={offer.trialApplies && Boolean(offer.currentProPkg)}
      onPress={offer.onSelectTier}
    />
  ) : null;

  return (
    <>
      <View style={styles.heroBleed}>
        <PaywallHero
          kicker={offer.headerKicker}
          title={offer.showPositioningHeadline ? null : offer.headerTitle}
          subtitle={offer.headerSubtitle}
          heroHeight={offer.heroHeight}
          topInset={offer.insets.top}
        />
      </View>

      {offer.personalisedPlan ? <PaywallPersonalisedPlanCard summary={offer.personalisedPlan} /> : null}

      {isFeatureEnabled("paywall_trajectory_chart_v1") ? <PaywallTrajectoryChart /> : null}

      <PaywallValueGrid />
      <PaywallComparison />

      {offer.planSelectorProps ? <PaywallPlanSelector {...offer.planSelectorProps} /> : null}

      <PaywallTrustStrip
        chips={offer.trustChips}
        textSecondaryColor={colors.textSecondary}
        borderColor={colors.border}
        backgroundSecondaryColor={colors.backgroundSecondary}
        primaryColor={accent.primary}
        primarySoftColor={accent.primarySoft}
      />

      {offer.showPricedBlocks ? (
        <Text testID="paywall-nutrition-estimate-note" style={styles.nutritionEstimateNote}>
          Nutrition values are estimates — always review before saving.
        </Text>
      ) : null}

      {offer.showPricedBlocks ? (
        <Text
          testID="paywall-autorenew-disclosure"
          style={styles.disclosure}
          accessibilityLabel={offer.disclosureText}
        >
          {offer.disclosureText}
        </Text>
      ) : null}

      <View style={styles.ctaStack}>
        {offer.trialApplies && offer.currentProPkg && offer.hasPro ? <PaywallNoPaymentChip /> : null}
        {primaryPurchaseCta}
      </View>

      <PressableScale
        haptic="none"
        style={styles.freeBtn}
        onPress={offer.onContinueFree}
        accessibilityLabel="Continue for free"
      >
        <Text style={styles.freeBtnText}>Continue for free</Text>
      </PressableScale>

      {offer.trialApplies && offer.currentProPkg ? (
        <View style={styles.timelineWrap}>
          <Text style={styles.timelineHeader}>What the 7-day trial looks like</Text>
          {TIMELINE.map((item, i) => {
            const TimelineIcon = item.icon;
            return (
              <View key={item.title} style={styles.timelineItem}>
                <View style={styles.timelineIconWrap}>
                  <View style={[styles.timelineDot, { backgroundColor: item.soft }]}>
                    <TimelineIcon size={16} color={item.color} strokeWidth={1.75} />
                  </View>
                  {i < TIMELINE.length - 1 && <View style={styles.timelineLine} />}
                </View>
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  <Text style={styles.timelineDesc}>{item.desc}</Text>
                </View>
              </View>
            );
          })}
          <TrialEndReminderPaywallBlock
            ref={offer.trialReminderRef}
            userId={offer.userId}
            trialApplies={offer.trialApplies}
            hasProPackage={Boolean(offer.currentProPkg)}
          />
        </View>
      ) : null}

      <View style={styles.promoWrap}>
        <PressableScale
          haptic="selection"
          style={styles.promoTrigger}
          onPress={() => offer.setPromoExpanded((v) => !v)}
          accessibilityRole="button"
          accessibilityLabel={offer.promoExpanded ? "Hide promo code field" : "Have a promo code?"}
          accessibilityState={{ expanded: offer.promoExpanded }}
          testID="paywall-promo-trigger"
        >
          <Tag size={14} color={colors.textSecondary} strokeWidth={1.75} />
          <Text style={styles.promoTriggerText}>Have a promo code?</Text>
          {offer.promoExpanded ? (
            <ChevronUp size={14} color={colors.textSecondary} strokeWidth={1.75} />
          ) : (
            <ChevronDown size={14} color={colors.textSecondary} strokeWidth={1.75} />
          )}
        </PressableScale>
        {offer.promoExpanded ? (
          <View style={styles.promoExpandedBlock} testID="paywall-promo-expanded">
            <Text style={styles.promoHint}>
              Enter your code exactly as provided (letters are not case-sensitive).
            </Text>
            <View style={styles.promoInputRow}>
              <TextInput
                testID="paywall-promo-input"
                value={offer.promoCode}
                onChangeText={offer.setPromoCode}
                placeholder="Enter code"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!offer.promoSubmitting}
                style={styles.promoInput}
              />
              <PressableScale
                haptic="confirm"
                testID="paywall-promo-apply"
                onPress={offer.onPromoApply}
                disabled={offer.promoSubmitting || !offer.promoCode.trim()}
                style={[
                  styles.promoApplyBtn,
                  (offer.promoSubmitting || !offer.promoCode.trim()) && styles.promoApplyBtnDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Apply promo code"
              >
                <Text style={styles.promoApplyBtnText}>{offer.promoSubmitting ? "…" : "Apply"}</Text>
              </PressableScale>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.secondaryRail}>
        <PressableScale haptic="confirm" onPress={offer.onRestore} disabled={offer.restoring} accessibilityLabel="Restore previous purchase">
          {offer.restoring ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={styles.secondaryLink}>Restore purchase</Text>
          )}
        </PressableScale>
        <Text style={styles.secondaryDot}>·</Text>
        <PressableScale haptic="selection" onPress={() => void Linking.openURL("https://getsloe.com/terms")}>
          <Text style={styles.secondaryLink}>Terms</Text>
        </PressableScale>
        <Text style={styles.secondaryDot}>·</Text>
        <PressableScale haptic="selection" onPress={() => void Linking.openURL("https://getsloe.com/privacy")}>
          <Text style={styles.secondaryLink}>Privacy</Text>
        </PressableScale>
      </View>
      <Text style={styles.secondaryNote}>Payments handled by the App Store.</Text>
    </>
  );
}
