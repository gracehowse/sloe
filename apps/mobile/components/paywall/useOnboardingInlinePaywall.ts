import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PurchasesPackage } from "react-native-purchases";

import {
  ensurePurchasesUser,
  getCustomerInfo,
  getOfferings,
  isPurchasesApiKeyPresent,
  isProEntitled,
  pollUntilEntitled,
  purchasePackage,
  restorePurchases,
  syncTierToSupabase,
  classifyPackage,
  type BillingPeriod,
} from "@/lib/purchases";
import { classifyPaywallReadiness } from "@/lib/paywallReadiness";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { usePromoCode } from "@/hooks/usePromoCode";
import { useHaptics } from "@/hooks/useHaptics";
import type { TrialEndReminderPaywallBlockHandle } from "@/components/paywall/TrialEndReminderPaywallBlock";
import { getPaywallTrustChips, buildReceiptTrustCopy } from "@suppr/shared/landing/paywallTrust";
import { PRICING_TIERS, type PricingTier, computeAnnualSavingsBadge } from "@suppr/shared/landing/pricingTiers";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { track } from "@/lib/analytics";
import {
  buildPersonalisedPlanPaywallSummary,
  shouldLeadPaywallWithPersonalisedPlan,
  type PersonalisedPlanPaywallSummary,
} from "@suppr/shared/paywall/personalisedPlanSummary";

/**
 * ENG-1459 — the Free→Pro sell logic for the onboarding terminal step's
 * MERGED inline screen (flag `onboarding_upgrade_inline_paywall_v1`).
 *
 * This is a careful, onboarding-SCOPED re-derivation of the state/handler
 * logic in `apps/mobile/app/paywall.tsx` — same RC calls
 * (`getOfferings`/`purchasePackage`/`restorePurchases`/`pollUntilEntitled`),
 * same entitlement/readiness/disclosure logic, same analytics event names
 * — narrowed to the one `from="onboarding"` case (billing always starts
 * "annual", no `trial_end`/`voice_log`/`photo_log` header branches, no
 * `?forceDegraded=1` dev affordance since there's no route param to carry
 * it). `apps/mobile/app/paywall.tsx` itself is UNCHANGED by this file —
 * see `PaywallContent.tsx`'s doc comment for why a "thin shared hook"
 * refactor of that file is deliberately out of scope here.
 *
 * `onExit()` is the single forward-only destination for every "this user
 * is done, converted or not, move to Today" outcome (already-entitled,
 * purchase success, restore success, promo-redeem success) — mirrors
 * `onboardingForwardExit` in the standalone route, which resolves the
 * exact same way for every one of those outcomes when `from==="onboarding"`.
 * `onContinueFree()` is the distinct "explicit skip" exit.
 */

const PRO_TIER = (() => {
  const t = PRICING_TIERS.find((tier) => tier.name === "Pro");
  if (!t) throw new Error("Missing Pro tier in PRICING_TIERS");
  return t;
})();

const FALLBACK_PRICES = {
  proMonthly: PRO_TIER.price,
  proAnnual: PRO_TIER.annualPrice ?? PRO_TIER.price,
} as const;

function computeAnnualPerMonthLine(annualPriceString: string): string | null {
  const a = annualPriceString.match(/^([^\d\-.,]+)\s*([\d.,]+)/);
  if (!a) return null;
  const sym = a[1].trim();
  const annual = Number(a[2].replace(/,/g, ""));
  if (!Number.isFinite(annual) || annual <= 0) return null;
  return `just ${sym}${(annual / 12).toFixed(2)}/mo`;
}

function computeSavingsBadgeFromStrings(
  annualPriceString: string,
  monthlyPriceString: string,
): string | null {
  const m = /^([^\d\-.,]+)\s*([\d.,]+)/;
  const a = annualPriceString.match(m);
  const r = monthlyPriceString.match(m);
  if (!a || !r) return null;
  const annual = Number(a[2].replace(/,/g, ""));
  const monthly = Number(r[2].replace(/,/g, ""));
  if (!Number.isFinite(annual) || !Number.isFinite(monthly) || monthly <= 0) return null;
  const pct = Math.round((1 - annual / (monthly * 12)) * 100);
  return pct > 0 ? `Save ${pct}%` : null;
}

export interface UseOnboardingInlinePaywallArgs {
  /** Forward-only exit for every "converted or already-Pro" outcome. */
  onExit: () => void;
  /** Explicit "Continue for free" skip — distinct from `onExit`. */
  onContinueFree: () => void;
  /** Fires the instant the primary (purchase) CTA is tapped, before the
   *  RC sheet opens — lets the caller record onboarding-specific intent
   *  tracking (`onboarding_trial_choice`) at the same point the legacy
   *  "Start free trial" button used to. */
  onPrimaryCtaIntent?: () => void;
}

export function useOnboardingInlinePaywall({ onExit, onContinueFree, onPrimaryCtaIntent }: UseOnboardingInlinePaywallArgs) {
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const haptics = useHaptics();

  const heroHeight = useMemo(() => {
    const h = Dimensions.get("window").height;
    return Math.max(260, Math.min(Math.round(h * 0.38), 340)) + insets.top;
  }, [insets.top]);

  const [purchasing, setPurchasing] = useState<null | "pro">(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [offeringsReady, setOfferingsReady] = useState(false);
  const [alreadyEntitled, setAlreadyEntitled] = useState(false);
  // ENG-1241 — onboarding always starts on the trial-eligible annual SKU.
  const [billing, setBilling] = useState<BillingPeriod>("annual");
  const viewedRef = useRef(false);
  const trialReminderRef = useRef<TrialEndReminderPaywallBlockHandle>(null);

  const [promoExpanded, setPromoExpanded] = useState(false);
  const [personalisedPlan, setPersonalisedPlan] =
    useState<PersonalisedPlanPaywallSummary | null>(null);
  const {
    code: promoCode,
    setCode: setPromoCode,
    submitting: promoSubmitting,
    redeem: redeemPromo,
  } = usePromoCode({ userId });

  // Lead with the user's plan if onboarding just wrote targets.
  useEffect(() => {
    if (!userId) {
      setPersonalisedPlan(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("target_calories, target_protein, goal, target_calories_source")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled || error || !data) {
        if (!cancelled) setPersonalisedPlan(null);
        return;
      }
      const row = data as {
        target_calories?: number | null;
        target_protein?: number | null;
        goal?: string | null;
        target_calories_source?: string | null;
      };
      if (
        !shouldLeadPaywallWithPersonalisedPlan({
          targetCalories: row.target_calories,
          targetCaloriesSource: row.target_calories_source,
          paywallFrom: "onboarding",
        })
      ) {
        setPersonalisedPlan(null);
        return;
      }
      setPersonalisedPlan(
        buildPersonalisedPlanPaywallSummary({
          targetCalories: row.target_calories as number,
          targetProtein: row.target_protein,
          goal: row.goal,
        }),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Load offerings; already-Pro users exit immediately, before any sell
  // content or analytics fires (mirrors the standalone route's early
  // redirect — keeps `paywall_viewed` honest).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await ensurePurchasesUser(userId);
      if (cancelled) return;
      try {
        const info = await getCustomerInfo();
        if (!cancelled && isProEntitled(info)) {
          setAlreadyEntitled(true);
          onExit();
          return;
        }
      } catch {
        /* proceed to render rather than silently bounce on a transient RC failure */
      }
      if (cancelled) return;
      let pkgs: PurchasesPackage[] = [];
      let errored = false;
      try {
        pkgs = await getOfferings();
      } catch {
        errored = true;
      }
      if (cancelled) return;
      setPackages(pkgs);
      setOfferingsReady(true);
      const readiness = classifyPaywallReadiness({
        hasApiKey: isPurchasesApiKeyPresent(),
        packages: pkgs,
        errored,
      });
      track(AnalyticsEvents.paywall_readiness, {
        reason: readiness.reason,
        package_count: pkgs.length,
        platform: Platform.OS === "ios" ? "ios" : "android",
        from: "onboarding",
      });
      if (!viewedRef.current) {
        viewedRef.current = true;
        track(AnalyticsEvents.paywall_viewed, {
          from: "onboarding",
          tier: "pro",
          surface: "onboarding_inline",
          platform: Platform.OS === "ios" ? "ios" : "android",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

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
  const hasAnyMonthly = Boolean(proMonthly);
  const hasAnyAnnual = Boolean(proAnnual);
  const showToggle = hasAnyMonthly && hasAnyAnnual;

  useEffect(() => {
    if (!offeringsReady) return;
    if (!showToggle) {
      if (hasAnyAnnual && billing !== "annual") setBilling("annual");
      else if (!hasAnyAnnual && hasAnyMonthly && billing !== "monthly") setBilling("monthly");
    }
  }, [offeringsReady, showToggle, hasAnyAnnual, hasAnyMonthly, billing]);

  const currentProPkg = billing === "annual" ? proAnnual : proMonthly;
  const fallbackProPrice = billing === "annual" ? FALLBACK_PRICES.proAnnual : FALLBACK_PRICES.proMonthly;
  const periodSuffix = billing === "annual" ? "/year" : "/month";
  const periodWord = billing === "annual" ? "per year" : "per month";
  const trialApplies = billing === "annual";
  const subscriptionsUnavailable = offeringsReady && packages.length === 0;
  const showPricedBlocks = offeringsReady && !subscriptionsUnavailable;
  const hasPro = Boolean(proAnnual || proMonthly);

  const trustChips = useMemo(() => getPaywallTrustChips("mobile"), []);

  const celebratePurchase = useCallback(
    (trialOnPurchase: boolean) => {
      track(AnalyticsEvents.checkout_completed, {
        tier: "pro",
        period: billing,
        surface: "onboarding_inline",
        platform: Platform.OS === "ios" ? "ios" : "android",
        from: "onboarding",
        trialApplied: trialOnPurchase,
      });
      if (trialOnPurchase) void trialReminderRef.current?.commitOnTrialStart();
      const cancelPath =
        Platform.OS === "ios"
          ? "Settings > Apple ID > Subscriptions"
          : "Google Play > Payments & subscriptions";
      const trialEndsLabel = trialOnPurchase ? "in 7 days" : "with your billing period";
      Alert.alert(
        "You're in",
        buildReceiptTrustCopy({ trialEndsLabel, cancelPath }),
        [{ text: "Continue", onPress: onExit }],
      );
    },
    [billing, onExit],
  );

  const onSelectTier = useCallback(async () => {
    if (purchasing) return;
    onPrimaryCtaIntent?.();
    haptics.select();
    const pkg = currentProPkg;
    if (!pkg) {
      Alert.alert(
        "Not available",
        "This plan isn't available right now. Try again in a moment, or continue on the free plan.",
      );
      return;
    }
    const platform: "ios" | "android" = Platform.OS === "ios" ? "ios" : "android";
    const trialOnThisPurchase = billing === "annual";
    track(AnalyticsEvents.checkout_started, {
      tier: "pro",
      period: billing,
      surface: "onboarding_inline",
      platform,
      from: "onboarding",
    });
    setPurchasing("pro");
    try {
      const { success, customerInfo } = await purchasePackage(pkg);
      if (success && customerInfo) {
        if (userId) {
          void syncTierToSupabase(customerInfo, supabase, userId).catch(() => {
            /* telemetry-only path; purchase already succeeded */
          });
        }
        haptics.success();
        const entitled = isProEntitled(customerInfo);
        if (entitled) {
          celebratePurchase(trialOnThisPurchase);
        } else {
          const polledInfo = await pollUntilEntitled("pro");
          if (polledInfo) {
            haptics.success();
            celebratePurchase(trialOnThisPurchase);
          } else {
            Alert.alert(
              "Almost there",
              "Your purchase went through but activation is taking a moment. Tap Restore — it usually resolves in under a minute.",
              [
                { text: "Restore", onPress: () => { void onRestore(); } },
                { text: "Later", style: "cancel" },
              ],
            );
          }
        }
      }
    } catch {
      Alert.alert("Purchase failed", "Please try again later.");
    } finally {
      setPurchasing(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchasing, haptics, currentProPkg, billing, userId, celebratePurchase, onPrimaryCtaIntent]);

  const onRestore = useCallback(async () => {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (userId) {
        void syncTierToSupabase(info, supabase, userId).catch(() => {
          /* telemetry-only path */
        });
      }
      if (isProEntitled(info) || Object.keys(info.entitlements.active).length > 0) {
        onExit();
      } else {
        Alert.alert("No active subscription found");
      }
    } catch {
      Alert.alert("Restore failed", "Please try again later.");
    } finally {
      setRestoring(false);
    }
  }, [userId, onExit]);

  const onToggleBilling = useCallback(
    (next: BillingPeriod) => {
      if (next === billing) return;
      haptics.select();
      track(AnalyticsEvents.paywall_period_changed, {
        from: "onboarding",
        fromPeriod: billing,
        toPeriod: next,
        surface: "onboarding_inline",
        platform: Platform.OS === "ios" ? "ios" : "android",
      });
      setBilling(next);
    },
    [billing, haptics],
  );

  // ─── Header copy (mirrors apps/mobile/app/paywall.tsx, onboarding-only) ───
  const headerTitle = personalisedPlan
    ? personalisedPlan.heroTitle
    : trialApplies
      ? "Try Pro free for 7 days"
      : "Pick the plan that fits";
  const showPositioningHeadline = headerTitle === "Pick the plan that fits" && !personalisedPlan;
  const headerKicker = showPositioningHeadline || personalisedPlan ? "SLOE PRO" : "CHOOSE YOUR PLAN";
  const headerSubtitle = personalisedPlan
    ? personalisedPlan.heroSubtitle
    : trialApplies
      ? "Full Pro free for a week. Cancel anytime in iOS Settings."
      : "Cancel anytime. Price in your currency, taxes included.";

  // ─── Disclosure (CMA six-element set — verbatim mirror) ───
  const monthlyProPriceString = proMonthly?.product.priceString ?? FALLBACK_PRICES.proMonthly;
  const disclosureText = (() => {
    const periodNoun = billing === "annual" ? "year" : "month";
    const cancelPath =
      Platform.OS === "ios"
        ? "Cancel anytime in Settings > Apple ID > Subscriptions."
        : "Cancel anytime in Google Play > Payments & subscriptions.";
    const proPriceString = currentProPkg?.product.priceString ?? fallbackProPrice;
    const altLine =
      billing === "annual" ? ` (or ${monthlyProPriceString} per month on the monthly plan)` : "";
    if (trialApplies && currentProPkg) {
      return `Pro renews automatically at ${proPriceString} per ${periodNoun}${altLine} until cancelled. Starts your 7-day free trial — first charge after 7 days. ${cancelPath} Prices include any applicable VAT. 7-day refund policy: support@getsloe.com. UK/EU customers: under the Consumer Contracts Regulations 2013 and Directive 2011/83/EU you have a 14-day right to cancel for a full refund.`;
    }
    return `Pro renews automatically at ${proPriceString} per ${periodNoun}${altLine} until cancelled. ${cancelPath} Prices include any applicable VAT. 7-day refund policy: support@getsloe.com. UK/EU customers: under the Consumer Contracts Regulations 2013 and Directive 2011/83/EU you have a 14-day right to cancel for a full refund.`;
  })();

  // ─── Plan-selector derived pricing ───
  const planSelectorProps = useMemo(() => {
    if (!showPricedBlocks || !(hasAnyAnnual || hasAnyMonthly)) return null;
    const annualStr = proAnnual?.product.priceString ?? FALLBACK_PRICES.proAnnual;
    const monthlyStr = proMonthly?.product.priceString ?? FALLBACK_PRICES.proMonthly;
    const headlineTier: PricingTier | undefined = PRICING_TIERS.find((t) => Boolean(t.annualPrice));
    const fallbackBadge = headlineTier ? computeAnnualSavingsBadge(headlineTier) : null;
    const savingsBadge = computeSavingsBadgeFromStrings(annualStr, monthlyStr) ?? fallbackBadge;
    const annualPerMonthLine = computeAnnualPerMonthLine(annualStr);
    return {
      billing,
      onSelect: onToggleBilling,
      annualPriceString: annualStr,
      monthlyPriceString: monthlyStr,
      savingsBadge,
      annualPerMonthLine,
      showAnnual: hasAnyAnnual,
      showMonthly: hasAnyMonthly,
    };
  }, [showPricedBlocks, hasAnyAnnual, hasAnyMonthly, proAnnual, proMonthly, billing, onToggleBilling]);

  const handleContinueFree = useCallback(() => {
    if (purchasing) return;
    onContinueFree();
  }, [purchasing, onContinueFree]);

  const handlePromoApply = useCallback(async () => {
    const result = await redeemPromo();
    if (result.ok) onExit();
  }, [redeemPromo, onExit]);

  return {
    insets,
    userId,
    heroHeight,
    alreadyEntitled,
    offeringsReady,
    subscriptionsUnavailable,
    showPricedBlocks,
    hasPro,
    currentProPkg,
    billing,
    trialApplies,
    periodSuffix,
    periodWord,
    headerTitle,
    headerKicker,
    headerSubtitle,
    showPositioningHeadline,
    personalisedPlan,
    disclosureText,
    trustChips,
    planSelectorProps,
    purchasing,
    restoring,
    promoExpanded,
    setPromoExpanded,
    promoCode,
    setPromoCode,
    promoSubmitting,
    trialReminderRef,
    onSelectTier: () => void onSelectTier(),
    onRestore: () => void onRestore(),
    onContinueFree: handleContinueFree,
    onPromoApply: () => void handlePromoApply(),
  };
}
