import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X, CheckCircle2, ChefHat, BarChart3, Flag, Check, CloudOff, Tag, ChevronDown, ChevronUp, type LucideIcon } from "lucide-react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import type { PurchasesPackage } from "react-native-purchases";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { Badge } from "@/components/Badge";
import {
  ensurePurchasesUser,
  getCustomerInfo,
  getOfferings,
  isPurchasesApiKeyPresent,
  isProEntitled,
  purchasePackage,
  restorePurchases,
  syncTierToSupabase,
} from "@/lib/purchases";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { usePromoCode } from "@/hooks/usePromoCode";
import { track } from "@/lib/analytics";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../../src/lib/analytics/events";
import { PRICING_TIERS, type PricingTier } from "../../../src/lib/landing/pricingTiers";

/**
 * Mobile paywall — sells both Base and Pro across monthly + annual.
 *
 * Design spec: `ui-product-designer` round-1, 2026-04-19. Key rules:
 *   - RC `pkg.product.priceString` is the only money text (Apple
 *     handles UK/EU VAT-inclusive display per storefront). No GBP
 *     literals in rendered copy except the offline fallback.
 *   - Pro card first (hero via `Accent.primary` border, not a
 *     second dark paint over dark mode). Base second, same width.
 *   - Each card carries its own CTA. Single "Continue for free"
 *     below both. Single composite disclosure below that.
 *   - 7-day trial ONLY on Pro annual (pricing decision v1).
 *   - Timeline block renders only when Pro annual is the selected
 *     billing frame.
 *   - Early redirect if the user is already Pro-entitled; never
 *     fires `paywall_viewed` in that case.
 *
 * Feature lists + tier tags + fallback prices all read from
 * `PRICING_TIERS` (the leaf SSOT), so web and mobile can't drift.
 */

function findTier(name: "Base" | "Pro"): PricingTier {
  const tier = PRICING_TIERS.find((t) => t.name === name);
  if (!tier) throw new Error(`Missing ${name} tier in PRICING_TIERS`);
  return tier;
}

const PRO_TIER = findTier("Pro");
const BASE_TIER = findTier("Base");

const PRO_FEATURE_HEAD = PRO_TIER.featHead ?? "Everything in Base, plus";
const PRO_FEATURES = PRO_TIER.features;
const BASE_FEATURE_HEAD = BASE_TIER.featHead ?? "Everything in Free, plus";
const BASE_FEATURES = BASE_TIER.features;

/** Fallback prices shown only when RC offerings failed to load. In
 *  normal operation the rendered price is always `priceString` from
 *  the resolved package so Apple's storefront localisation applies. */
const FALLBACK_PRICES = {
  proMonthly: PRO_TIER.price,
  proAnnual: PRO_TIER.annualPrice ?? PRO_TIER.price,
  baseMonthly: BASE_TIER.price,
  baseAnnual: BASE_TIER.annualPrice ?? BASE_TIER.price,
} as const;

/** Render timing of the Day-7-trial-ends timeline — only shown when
 *  the user is looking at the Pro annual package, which is the only
 *  SKU that carries the 7-day trial (pricing v1). */
const TIMELINE: Array<{
  icon: LucideIcon;
  color: string;
  title: string;
  desc: string;
}> = [
  {
    icon: CheckCircle2,
    color: Accent.success,
    title: "Your targets are set",
    desc: "Calorie budget and macro targets based on your goals.",
  },
  {
    icon: ChefHat,
    color: Accent.primary,
    title: "Today: Start importing recipes",
    desc: "Grab recipes from Instagram, TikTok, or any website — we'll handle the nutrition.",
  },
  {
    icon: BarChart3,
    color: Accent.info,
    title: "This week: Save and plan",
    desc: "Save recipes, verify nutrition, and start a meal plan.",
  },
  {
    icon: Flag,
    color: Accent.warning,
    title: "Day 7: Trial ends",
    desc: "Your trial ends. Continue with Pro or switch to the free plan.",
  },
];

type BillingPeriod = "monthly" | "annual";

/** Map a raw `?from=` URL-param string into the canonical enum. Unknown
 *  / missing values fall back to `"deep_link"` so the paywall can be
 *  opened from a generic link without fabricating a specific surface.
 *  Shared contract with `app/pricing/page.tsx`. */
function normalisePaywallFrom(raw: unknown): PaywallViewedFrom {
  const s = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  switch (s) {
    case "voice_log":
    case "photo_log":
    case "settings":
    case "onboarding":
    case "trial_end":
    case "deep_link":
    case "recipes_library":
    case "shopping_list":
    case "profile":
    case "recipe_create":
    case "recipe_import":
    case "meal_planner":
      return s;
    default:
      return "deep_link";
  }
}

/** Pro-gated entry surfaces get a Pro-flavoured header; everything
 *  else gets the neutral "pick a plan" framing. The *offer* is the
 *  same either way (both cards visible) — only the *voice* adapts. */
function isProFlavouredContext(from: PaywallViewedFrom): boolean {
  return from === "voice_log" || from === "photo_log" || from === "trial_end";
}

/** Classify a RevenueCat package by tier + frequency. RC offerings
 *  expose both `packageType` (ANNUAL/MONTHLY) and an identifier; we
 *  combine the product identifier (for tier) with packageType (for
 *  frequency) and fall back to identifier substring matching so the
 *  paywall works even if the offering is provisioned with custom
 *  identifiers like `suppr_pro_annual_v1`. */
function classifyPackage(pkg: PurchasesPackage): {
  tier: "base" | "pro" | null;
  period: BillingPeriod | null;
} {
  const pkgId = pkg.identifier.toLowerCase();
  const productId = (pkg.product.identifier ?? "").toLowerCase();
  const haystack = `${pkgId} ${productId}`;
  const tier = haystack.includes("pro")
    ? "pro"
    : haystack.includes("base")
      ? "base"
      : null;
  const period: BillingPeriod | null =
    pkg.packageType === "ANNUAL" || haystack.includes("annual")
      ? "annual"
      : pkg.packageType === "MONTHLY" || haystack.includes("monthly")
        ? "monthly"
        : null;
  return { tier, period };
}

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [purchasing, setPurchasing] = useState<null | "base" | "pro">(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [offeringsReady, setOfferingsReady] = useState(false);
  const [earlyRedirected, setEarlyRedirected] = useState(false);
  const [billing, setBilling] = useState<BillingPeriod>("annual");
  // Track which tier the user is actively looking at so we can re-fire
  // `paywall_viewed` with the updated `tier` on focus change. Starts as
  // "pro" (Pro is the hero card). analytics-engineer 2026-04-19 picked
  // re-fire over a separate `paywall_tier_viewed` event to keep funnel
  // F2 on a single event and use `tier` as a funnel-step property.
  const [focusedTier, setFocusedTier] = useState<"pro" | "base">("pro");

  // Promo-code expander (D9 M1, 2026-04-21). Collapsed by default;
  // tap "Have a promo code?" to reveal TextInput + Apply. On success,
  // Alert → onClose (user now has access, paywall is irrelevant).
  const [promoExpanded, setPromoExpanded] = useState(false);
  const {
    code: promoCode,
    setCode: setPromoCode,
    submitting: promoSubmitting,
    redeem: redeemPromo,
  } = usePromoCode({ userId });

  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const paywallFrom = useMemo(
    () => normalisePaywallFrom(params.from),
    [params.from],
  );

  // Load offerings. If the user is already Pro-entitled, redirect off
  // this screen before firing any analytics or showing a sell. This is
  // a spec requirement (ui-product-designer §8 edge states) and keeps
  // `paywall_viewed` honest — users who can't actually convert don't
  // bloat the funnel numerator.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensurePurchasesUser(userId);
      if (cancelled) return;
      try {
        const info = await getCustomerInfo();
        if (!cancelled && isProEntitled(info)) {
          setEarlyRedirected(true);
          router.replace(paywallFrom === "onboarding" ? "/notifications-prompt" : "/");
          return;
        }
      } catch {
        /* Proceed to the paywall; we'd rather render than silently
         *  send someone back to the app on a transient RC failure. */
      }
      if (cancelled) return;
      const pkgs = await getOfferings();
      if (cancelled) return;
      setPackages(pkgs);
      setOfferingsReady(true);
      // Analytics (L6 G9 + 2026-04-19 round-2): every `paywall_viewed`
      // emit carries `{ from, tier, surface, platform }`. `tier: "pro"`
      // reflects the default visual focus on this screen; if/when we
      // add `paywall_tier_viewed` for Base focus shifts, that will be
      // a separate event (flagged for analytics-engineer).
      track(AnalyticsEvents.paywall_viewed, {
        from: paywallFrom,
        tier: "pro",
        surface: "route",
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, paywallFrom, router]);

  // Resolve packages per tier × period. Uses classifyPackage so the
  // logic is resilient to custom RC identifiers.
  const proAnnual = useMemo(
    () => packages.find((p) => {
      const c = classifyPackage(p);
      return c.tier === "pro" && c.period === "annual";
    }),
    [packages],
  );
  const proMonthly = useMemo(
    () => packages.find((p) => {
      const c = classifyPackage(p);
      return c.tier === "pro" && c.period === "monthly";
    }),
    [packages],
  );
  const baseAnnual = useMemo(
    () => packages.find((p) => {
      const c = classifyPackage(p);
      return c.tier === "base" && c.period === "annual";
    }),
    [packages],
  );
  const baseMonthly = useMemo(
    () => packages.find((p) => {
      const c = classifyPackage(p);
      return c.tier === "base" && c.period === "monthly";
    }),
    [packages],
  );

  const hasPro = Boolean(proAnnual || proMonthly);
  const hasBase = Boolean(baseAnnual || baseMonthly);
  const hasAnyMonthly = Boolean(proMonthly || baseMonthly);
  const hasAnyAnnual = Boolean(proAnnual || baseAnnual);
  const showToggle = hasAnyMonthly && hasAnyAnnual;

  // Lock billing period if only one frequency is provisioned.
  useEffect(() => {
    if (!offeringsReady) return;
    if (!showToggle) {
      if (hasAnyAnnual && billing !== "annual") setBilling("annual");
      else if (!hasAnyAnnual && hasAnyMonthly && billing !== "monthly") setBilling("monthly");
    }
  }, [offeringsReady, showToggle, hasAnyAnnual, hasAnyMonthly, billing]);

  const currentProPkg = billing === "annual" ? proAnnual : proMonthly;
  const currentBasePkg = billing === "annual" ? baseAnnual : baseMonthly;

  // Fallback strings used only when a specific package isn't resolved
  // — keeps the card readable during loading or partial provisioning.
  const fallbackProPrice = billing === "annual" ? FALLBACK_PRICES.proAnnual : FALLBACK_PRICES.proMonthly;
  const fallbackBasePrice = billing === "annual" ? FALLBACK_PRICES.baseAnnual : FALLBACK_PRICES.baseMonthly;
  const periodSuffix = billing === "annual" ? "/year" : "/month";

  const trialApplies = billing === "annual"; // 7-day trial only on Pro annual
  const subscriptionsUnavailable = offeringsReady && packages.length === 0;

  // ─── Interaction handlers ───────────────────────────────────────

  async function onSelectTier(tier: "base" | "pro") {
    if (purchasing) return;
    void Haptics.selectionAsync();

    // Focus shift — re-fire `paywall_viewed` with updated `tier` so
    // F2 can slice conversion by tier. Dedup: only re-fire when focus
    // genuinely changed, not on every CTA tap. analytics-engineer
    // 2026-04-19 preferred this over a separate `paywall_tier_viewed`.
    // Note: expand shorthand `tier` → `tier: tier` so the parity
    // regex in `tests/unit/analyticsEvents.test.ts` sees the key.
    if (tier !== focusedTier) {
      setFocusedTier(tier);
      track(AnalyticsEvents.paywall_viewed, {
        from: paywallFrom,
        tier: tier,
        surface: "route",
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
    }

    const pkg = tier === "pro" ? currentProPkg : currentBasePkg;
    if (!pkg) {
      Alert.alert(
        "Not available",
        "This plan isn't available right now. Try again in a moment, or continue on the free plan.",
      );
      return;
    }

    const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
    const trialOnThisPurchase = tier === "pro" && billing === "annual";

    // Fire `checkout_started` immediately — analytics-engineer wants
    // this emit regardless of whether the purchase lands, so F2 can
    // measure CTA-tap conversion vs drop-off inside Apple's sheet.
    track(AnalyticsEvents.checkout_started, {
      tier,
      period: billing,
      surface: "mobile_paywall",
      platform,
      from: paywallFrom,
    });

    setPurchasing(tier);
    try {
      const { success, customerInfo } = await purchasePackage(pkg);
      if (success && customerInfo) {
        if (userId) void syncTierToSupabase(customerInfo, supabase, userId);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        // Entitlement check before celebrating — syncTierToSupabase can
        // race with the customerInfo refresh. For Pro we gate on
        // `isProEntitled`; for Base we accept any active entitlement
        // (Pro implies Base access).
        const entitled = tier === "pro"
          ? isProEntitled(customerInfo)
          : Object.keys(customerInfo.entitlements.active).length > 0;
        if (entitled) {
          // `checkout_completed` fires only after entitlement is truly
          // granted. Mobile starts clean on this name — the `_return`
          // legacy dual-emit is web-only and retires 2026-05-18.
          track(AnalyticsEvents.checkout_completed, {
            tier,
            period: billing,
            surface: "mobile_paywall",
            platform,
            from: paywallFrom,
            trialApplied: trialOnThisPurchase,
          });
          router.replace("/notifications-prompt");
        } else {
          Alert.alert(
            "Almost there",
            "Your purchase went through but the subscription hasn't activated yet. Please wait a moment and try Restore.",
          );
        }
      }
    } catch {
      Alert.alert("Purchase failed", "Please try again later.");
    } finally {
      setPurchasing(null);
    }
  }

  async function onRestore() {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (userId) void syncTierToSupabase(info, supabase, userId);
      if (isProEntitled(info) || Object.keys(info.entitlements.active).length > 0) {
        router.replace("/notifications-prompt");
      } else {
        Alert.alert("No active subscription found");
      }
    } catch {
      Alert.alert("Restore failed", "Please try again later.");
    } finally {
      setRestoring(false);
    }
  }

  function onContinueFree() {
    if (purchasing) return;
    router.replace("/notifications-prompt");
  }

  function onClose() {
    if (purchasing) return;
    // Onboarding + trial-end are forward-only flows; every other entry
    // surface came from a user-initiated navigation, so `back()` is the
    // correct cancel. Falls back to the onboarding route if there's no
    // history (first-launch deep link).
    if (paywallFrom === "onboarding" || paywallFrom === "trial_end") {
      router.replace("/notifications-prompt");
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/");
    }
  }

  function onToggleBilling(next: BillingPeriod) {
    if (next === billing) return;
    void Haptics.selectionAsync();
    // Fire `paywall_period_changed` on every committed toggle flip so
    // annual-adoption rate is measurable without polluting F2. The
    // no-op early-return above guarantees "committed change only".
    track(AnalyticsEvents.paywall_period_changed, {
      from: paywallFrom,
      fromPeriod: billing,
      toPeriod: next,
      surface: "route",
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
    setBilling(next);
  }

  // Android hardware back — swallow during an in-flight purchase.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (purchasing) return true;
      onClose();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchasing]);

  // ─── Header copy ────────────────────────────────────────────────

  const proFlavoured = isProFlavouredContext(paywallFrom);
  const headerKicker = proFlavoured ? "SUPPR PRO" : "CHOOSE YOUR PLAN";
  const headerTitle = (() => {
    if (paywallFrom === "trial_end") return "Your trial ended — pick a plan";
    if (paywallFrom === "voice_log" || paywallFrom === "photo_log") return "Unlock AI logging";
    return "Pick the plan that fits";
  })();
  const headerSubtitle = proFlavoured
    ? "Includes everything in Base, plus AI photo and voice logging."
    : "Cancel anytime. Price in your currency, taxes included.";

  // ─── Disclosure copy ────────────────────────────────────────────

  const disclosureText = (() => {
    const proPriceString = currentProPkg?.product.priceString ?? fallbackProPrice;
    const periodNoun = billing === "annual" ? "year" : "month";
    if (trialApplies && currentProPkg) {
      return `7 days free, then ${proPriceString} per ${periodNoun}, automatically renewing until cancelled in App Store settings. Price includes any applicable VAT. 7-day refund policy: support@suppr-club.com`;
    }
    return `${proPriceString} per ${periodNoun}, automatically renewing until cancelled in App Store settings. Price includes any applicable VAT. 7-day refund policy: support@suppr-club.com`;
  })();

  // ─── Styles ─────────────────────────────────────────────────────

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    closeBtn: {
      position: "absolute",
      top: insets.top + Spacing.sm,
      right: Spacing.lg,
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "rgba(255,255,255,0.2)",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },

    header: {
      paddingTop: insets.top + Spacing.xl,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xl,
      overflow: "hidden",
    },
    headerKicker: {
      fontSize: 11,
      fontWeight: "700",
      color: "#ffffff",
      letterSpacing: 2,
      marginBottom: Spacing.sm,
      opacity: 0.9,
    },
    headerTitle: { fontSize: 24, fontWeight: "800", color: "#ffffff", lineHeight: 32 },
    headerSubtitle: {
      fontSize: 14,
      color: "#ffffff",
      lineHeight: 20,
      marginTop: Spacing.xs,
      opacity: 0.85,
    },

    scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: insets.bottom + Spacing.xxxl },

    toggleWrap: { alignItems: "center", marginTop: Spacing.lg, marginBottom: Spacing.xl },
    toggleRow: {
      flexDirection: "row",
      padding: 4,
      backgroundColor: colors.inputBg,
      borderRadius: Radius.full,
      maxWidth: 360,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radius.full - 2,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: Spacing.xs,
    },
    toggleBtnActive: {
      backgroundColor: colors.card,
      ...Platform.select({
        ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
        android: { elevation: 1 },
      }),
    },
    toggleLabel: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
    toggleLabelActive: { color: colors.text },

    card: {
      borderRadius: Radius.lg,
      padding: Spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: Spacing.lg,
    },
    cardPro: {
      borderWidth: 1.5,
      borderColor: Accent.primary,
    },

    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    cardTitle: { fontSize: 20, fontWeight: "700", color: colors.text },

    cardPriceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginTop: Spacing.xs,
    },
    cardPrice: { fontSize: 32, fontWeight: "800", color: colors.text },
    cardPricePeriod: { fontSize: 14, color: colors.textSecondary, marginLeft: Spacing.xs },

    cardTag: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginTop: Spacing.sm,
    },

    divider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.md },

    featHead: { fontSize: 13, fontWeight: "600", color: colors.text },
    featureRow: { flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm, marginTop: Spacing.sm },
    featureText: { fontSize: 14, color: colors.text, flex: 1, lineHeight: 20 },

    cardCta: {
      marginTop: Spacing.lg,
      borderRadius: Radius.md,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
    },
    cardCtaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
    cardCtaDisabled: { backgroundColor: colors.inputBg },
    cardCtaDisabledText: { color: colors.textTertiary },

    freeBtn: { paddingVertical: Spacing.md, alignItems: "center" },
    freeBtnText: { color: colors.textTertiary, fontWeight: "600", fontSize: 15 },

    disclosure: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 18,
      paddingHorizontal: Spacing.sm,
      marginTop: Spacing.sm,
    },

    timelineWrap: { marginTop: Spacing.xl },
    timelineHeader: {
      fontSize: 15,
      fontWeight: "700",
      color: colors.text,
      marginBottom: Spacing.md,
    },
    timelineItem: { flexDirection: "row", gap: Spacing.md },
    timelineIconWrap: { alignItems: "center", width: 30 },
    timelineDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: "center",
      alignItems: "center",
    },
    timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
    timelineContent: { flex: 1, paddingBottom: Spacing.lg },
    timelineTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    timelineDesc: {
      fontSize: 13,
      color: colors.textSecondary,
      marginTop: 2,
      lineHeight: 18,
    },

    promoWrap: {
      marginTop: Spacing.xl,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: Spacing.lg,
    },
    promoTrigger: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
    },
    promoTriggerText: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    promoExpandedBlock: {
      marginTop: Spacing.sm,
      gap: Spacing.sm,
    },
    promoHint: {
      fontSize: 12,
      color: colors.textTertiary,
      lineHeight: 17,
    },
    promoInputRow: {
      flexDirection: "row",
      gap: Spacing.sm,
    },
    promoInput: {
      flex: 1,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
      color: colors.text,
      fontSize: 14,
    },
    promoApplyBtn: {
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: Radius.md,
      backgroundColor: Accent.primary,
      justifyContent: "center",
      alignItems: "center",
    },
    promoApplyBtnDisabled: { opacity: 0.4 },
    promoApplyBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

    secondaryRail: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: Spacing.md,
      marginTop: Spacing.xxl,
    },
    secondaryLink: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
    },
    secondaryDot: { fontSize: 14, color: colors.border },
    secondaryNote: {
      fontSize: 11,
      color: colors.textTertiary,
      textAlign: "center",
      marginTop: Spacing.sm,
    },

    skeletonCard: {
      height: 280,
      borderRadius: Radius.lg,
      backgroundColor: colors.inputBg,
      marginBottom: Spacing.lg,
    },

    unavailableCard: {
      borderRadius: Radius.lg,
      padding: Spacing.xl,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      gap: Spacing.sm,
    },
    unavailableTitle: { fontSize: 16, fontWeight: "700", color: colors.text, marginTop: Spacing.xs },
    unavailableBody: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 20,
    },

    savingsBadgeRight: { marginLeft: "auto" },
  }), [colors, insets]);

  // ─── Render guards ──────────────────────────────────────────────

  if (earlyRedirected) return <View style={styles.container} />;

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.closeBtn}
        onPress={onClose}
        accessibilityLabel="Close paywall"
        accessibilityHint="Returns you to where you were"
        hitSlop={12}
      >
        <X size={20} color="#ffffff" strokeWidth={1.75} />
      </Pressable>

      <View style={styles.header}>
        {/*
         * Brand-gradient hero banner — mirrors prototype `flows.jsx:555`
         * (`linear-gradient(135deg, #4c6ce0, #e04888)`). Brand gradient is
         * sanctioned on paywall surfaces per the design-system doc.
         */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Svg width="100%" height="100%">
            <Defs>
              <SvgLinearGradient id="paywall-hero-grad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={Accent.primary} stopOpacity={1} />
                <Stop offset="100%" stopColor={Accent.magenta} stopOpacity={1} />
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#paywall-hero-grad)" />
          </Svg>
        </View>
        <Text style={styles.headerKicker}>{headerKicker}</Text>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {showToggle ? (
          <View style={styles.toggleWrap}>
            <View
              style={styles.toggleRow}
              accessibilityRole="tablist"
              accessibilityLabel="Billing period"
            >
              <Pressable
                style={[styles.toggleBtn, billing === "monthly" && styles.toggleBtnActive]}
                onPress={() => onToggleBilling("monthly")}
                accessibilityRole="tab"
                accessibilityState={{ selected: billing === "monthly" }}
                accessibilityLabel="Monthly billing"
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    billing === "monthly" && styles.toggleLabelActive,
                  ]}
                >
                  Monthly
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, billing === "annual" && styles.toggleBtnActive]}
                onPress={() => onToggleBilling("annual")}
                accessibilityRole="tab"
                accessibilityState={{ selected: billing === "annual" }}
                accessibilityLabel="Annual billing, save 37 percent"
              >
                <Text
                  style={[
                    styles.toggleLabel,
                    billing === "annual" && styles.toggleLabelActive,
                  ]}
                >
                  Annual
                </Text>
                <Badge variant="added" accessibilityLabel="Save 37 percent on annual">
                  Save 37%
                </Badge>
              </Pressable>
            </View>
          </View>
        ) : null}

        {!offeringsReady ? (
          <>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </>
        ) : subscriptionsUnavailable ? (
          <View style={styles.unavailableCard}>
            <CloudOff size={28} color={colors.textTertiary} strokeWidth={1.75} />
            <Text style={styles.unavailableTitle}>Subscriptions unavailable</Text>
            <Text style={styles.unavailableBody}>
              {isPurchasesApiKeyPresent()
                ? "We couldn't load plans right now. Continue on the free plan, or try again from Settings."
                : "In-app purchases aren't configured in this build. Continue on the free plan."}
            </Text>
          </View>
        ) : (
          <>
            {hasPro ? (
              <TierCard
                tier="pro"
                title="Pro"
                tag="Log by photo and voice, faster."
                priceString={currentProPkg?.product.priceString ?? fallbackProPrice}
                periodSuffix={periodSuffix}
                showSavings={billing === "annual"}
                featHead={PRO_FEATURE_HEAD}
                features={PRO_FEATURES}
                badgeLabel="MOST POPULAR"
                isHero
                ctaLabel={
                  trialApplies
                    ? "Start 7-Day Free Trial"
                    : `Subscribe — ${currentProPkg?.product.priceString ?? fallbackProPrice}${periodSuffix}`
                }
                ctaColor={trialApplies ? Accent.success : Accent.primary}
                ctaDisabled={!currentProPkg || purchasing !== null}
                ctaLoading={purchasing === "pro"}
                onPress={() => void onSelectTier("pro")}
                colors={colors}
                styles={styles}
              />
            ) : null}

            {hasBase ? (
              <TierCard
                tier="base"
                title="Base"
                tag="The full meal-planning loop."
                priceString={currentBasePkg?.product.priceString ?? fallbackBasePrice}
                periodSuffix={periodSuffix}
                showSavings={billing === "annual"}
                featHead={BASE_FEATURE_HEAD}
                features={BASE_FEATURES}
                ctaLabel={`Subscribe — ${currentBasePkg?.product.priceString ?? fallbackBasePrice}${periodSuffix}`}
                ctaColor={Accent.primary}
                ctaDisabled={!currentBasePkg || purchasing !== null}
                ctaLoading={purchasing === "base"}
                onPress={() => void onSelectTier("base")}
                colors={colors}
                styles={styles}
              />
            ) : null}
          </>
        )}

        <Pressable
          style={styles.freeBtn}
          onPress={onContinueFree}
          accessibilityLabel="Continue for free"
        >
          <Text style={styles.freeBtnText}>Continue for free</Text>
        </Pressable>

        {offeringsReady && !subscriptionsUnavailable ? (
          <Text style={styles.disclosure}>{disclosureText}</Text>
        ) : null}

        {trialApplies && currentProPkg ? (
          <View style={styles.timelineWrap}>
            <Text style={styles.timelineHeader}>What the 7-day trial looks like</Text>
            {TIMELINE.map((item, i) => {
              const TimelineIcon = item.icon;
              return (
              <View key={item.title} style={styles.timelineItem}>
                <View style={styles.timelineIconWrap}>
                  <View style={[styles.timelineDot, { backgroundColor: item.color + "20" }]}>
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
          </View>
        ) : null}

        {/* Promo-code expander (D9 M1). Collapsed by default. */}
        <View style={styles.promoWrap}>
          <Pressable
            style={styles.promoTrigger}
            onPress={() => setPromoExpanded((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={promoExpanded ? "Hide promo code field" : "Have a promo code?"}
            accessibilityState={{ expanded: promoExpanded }}
            testID="paywall-promo-trigger"
          >
            <Tag size={14} color={colors.textSecondary} strokeWidth={1.75} />
            <Text style={styles.promoTriggerText}>Have a promo code?</Text>
            {promoExpanded ? (
              <ChevronUp size={14} color={colors.textSecondary} strokeWidth={1.75} />
            ) : (
              <ChevronDown size={14} color={colors.textSecondary} strokeWidth={1.75} />
            )}
          </Pressable>
          {promoExpanded ? (
            <View style={styles.promoExpandedBlock} testID="paywall-promo-expanded">
              <Text style={styles.promoHint}>
                Enter your code exactly as provided (letters are not case-sensitive).
              </Text>
              <View style={styles.promoInputRow}>
                <TextInput
                  testID="paywall-promo-input"
                  value={promoCode}
                  onChangeText={setPromoCode}
                  placeholder="e.g. SUPPR_TEST_PREMIUM"
                  placeholderTextColor={colors.textTertiary}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!promoSubmitting}
                  style={styles.promoInput}
                />
                <Pressable
                  testID="paywall-promo-apply"
                  onPress={() => {
                    void (async () => {
                      const result = await redeemPromo();
                      if (result.ok) {
                        // User now has access — paywall is no longer
                        // the right surface. Close per D9 OD2.
                        onClose();
                      }
                    })();
                  }}
                  disabled={promoSubmitting || !promoCode.trim()}
                  style={[
                    styles.promoApplyBtn,
                    (promoSubmitting || !promoCode.trim()) && styles.promoApplyBtnDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Apply promo code"
                >
                  <Text style={styles.promoApplyBtnText}>
                    {promoSubmitting ? "…" : "Apply"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.secondaryRail}>
          <Pressable
            onPress={() => void onRestore()}
            disabled={restoring}
            accessibilityLabel="Restore previous purchase"
          >
            {restoring ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <Text style={styles.secondaryLink}>Restore purchase</Text>
            )}
          </Pressable>
          <Text style={styles.secondaryDot}>·</Text>
          <Pressable onPress={() => void Linking.openURL("https://suppr-club.com/terms")}>
            <Text style={styles.secondaryLink}>Terms</Text>
          </Pressable>
          <Text style={styles.secondaryDot}>·</Text>
          <Pressable onPress={() => void Linking.openURL("https://suppr-club.com/privacy")}>
            <Text style={styles.secondaryLink}>Privacy</Text>
          </Pressable>
        </View>
        <Text style={styles.secondaryNote}>Payments handled by the App Store.</Text>
      </ScrollView>
    </View>
  );
}

// ─── TierCard subcomponent ────────────────────────────────────────

type TierCardProps = {
  tier: "base" | "pro";
  title: string;
  tag: string;
  priceString: string;
  periodSuffix: string;
  showSavings: boolean;
  featHead: string;
  features: readonly string[];
  badgeLabel?: string;
  isHero?: boolean;
  ctaLabel: string;
  ctaColor: string;
  ctaDisabled: boolean;
  ctaLoading: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  styles: any;
};

function TierCard({
  tier,
  title,
  tag,
  priceString,
  periodSuffix,
  showSavings,
  featHead,
  features,
  badgeLabel,
  isHero = false,
  ctaLabel,
  ctaColor,
  ctaDisabled,
  ctaLoading,
  onPress,
  colors,
  styles,
}: TierCardProps) {
  const a11yLabel = `${title} plan. ${priceString} per ${periodSuffix.replace("/", "")}.${
    isHero ? " Most popular." : ""
  } ${featHead} ${features.slice(0, 3).join(", ")}.`;

  return (
    <View
      style={[styles.card, isHero && styles.cardPro]}
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>{title}</Text>
        {badgeLabel ? <Badge variant="pro">{badgeLabel}</Badge> : null}
      </View>

      <View style={styles.cardPriceRow}>
        <Text style={styles.cardPrice}>{priceString}</Text>
        <Text style={styles.cardPricePeriod}>{periodSuffix}</Text>
        {showSavings ? (
          <View style={styles.savingsBadgeRight}>
            <Badge variant="added">Save 37%</Badge>
          </View>
        ) : null}
      </View>

      <Text style={styles.cardTag}>{tag}</Text>

      <View style={styles.divider} />

      <Text style={styles.featHead}>{featHead}</Text>
      {features.map((f) => (
        <View key={f} style={styles.featureRow}>
          <Check
            size={16}
            color={isHero ? Accent.primary : colors.textSecondary}
            strokeWidth={1.75}
          />
          <Text style={styles.featureText}>{f}</Text>
        </View>
      ))}

      <Pressable
        style={[
          styles.cardCta,
          ctaDisabled ? styles.cardCtaDisabled : { backgroundColor: ctaColor },
          ctaLoading && { opacity: 0.7 },
        ]}
        onPress={onPress}
        disabled={ctaDisabled || ctaLoading}
        accessibilityRole="button"
        accessibilityLabel={ctaLabel}
        accessibilityState={{ disabled: ctaDisabled }}
      >
        {ctaLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={[styles.cardCtaText, ctaDisabled && styles.cardCtaDisabledText]}>
            {ctaDisabled && !ctaLoading ? `${ctaLabel} (unavailable)` : ctaLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
