import { useEffect, useMemo, useRef, useState } from "react";
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
// ENG-528 (2026-05-16): CloudOff dropped — the "Subscriptions
// unavailable" card it iconified was removed per Grace decision
// ("remove entirely; just show the Pro tier value ladder").
import { X, CheckCircle2, ChefHat, BarChart3, Flag, Check, Tag, ChevronDown, ChevronUp, ShieldCheck, type LucideIcon } from "lucide-react-native";
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
import { classifyPaywallReadiness } from "@/lib/paywallReadiness";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { usePromoCode } from "@/hooks/usePromoCode";
import { track } from "@/lib/analytics";
import { AnalyticsEvents, type PaywallViewedFrom } from "@suppr/shared/analytics/events";
import { PRICING_TIERS, type PricingTier, computeAnnualSavingsBadge } from "@suppr/shared/landing/pricingTiers";
import { getPaywallTrustChips, buildReceiptTrustCopy, type PaywallTrustChip } from "@suppr/shared/landing/paywallTrust";

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

function findTier(name: "Pro"): PricingTier {
  const tier = PRICING_TIERS.find((t) => t.name === name);
  if (!tier) throw new Error(`Missing ${name} tier in PRICING_TIERS`);
  return tier;
}

const PRO_TIER = findTier("Pro");

/**
 * PR-01 (audit 2026-04-28) — pricing collapses to Free + Pro per
 * D-2026-04-27-05. The Base tier was removed from the SSOT in
 * batch 19; this paywall now renders Pro-only. Internal `UserTier`
 * enum keeps `"base"` for safety: any pre-existing RevenueCat
 * entitlement on the Base SKU is treated by `resolvedTier` as a
 * fallback Free state for this user, and the paywall pitches Pro
 * normally.
 */

const PRO_FEATURE_HEAD = PRO_TIER.featHead ?? "Everything in Free, plus";
const PRO_FEATURES = PRO_TIER.features;

/** Fallback prices shown only when RC offerings failed to load. In
 *  normal operation the rendered price is always `priceString` from
 *  the resolved package so Apple's storefront localisation applies. */
const FALLBACK_PRICES = {
  proMonthly: PRO_TIER.price,
  proAnnual: PRO_TIER.annualPrice ?? PRO_TIER.price,
} as const;

/** Render timing of the Day-7-trial-ends timeline — only shown when
 *  the user is looking at the Pro annual package, which is the only
 *  SKU that carries the 7-day trial (pricing v1). */
const TIMELINE: {
  icon: LucideIcon;
  color: string;
  title: string;
  desc: string;
}[] = [
  {
    icon: CheckCircle2,
    color: Accent.success,
    title: "Your targets are set",
    desc: "Calorie budget and macro targets based on your goals.",
  },
  {
    icon: ChefHat,
    color: Accent.success,
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
/**
 * L1 (2026-04-21): substantiate the "Save 37%" badge with a visible
 * reference price. Returns e.g. "£2.50/mo · save 37% vs £3.99/mo" from
 * an annual priceString ("£29.99") + monthly priceString ("£3.99").
 * Returns `null` if either string can't be parsed — the card falls
 * back to showing just the badge (acceptable; the landing page and
 * app-store already carry the annual/monthly breakdown).
 */
function computeAnnualReferenceLine(
  annualPriceString: string,
  monthlyRefPriceString: string,
): string | null {
  const m = /^([^\d\-.,]+)\s*([\d.,]+)/;
  const a = annualPriceString.match(m);
  const r = monthlyRefPriceString.match(m);
  if (!a || !r) return null;
  const sym = a[1].trim();
  const annual = Number(a[2].replace(/,/g, ""));
  const monthly = Number(r[2].replace(/,/g, ""));
  if (!Number.isFinite(annual) || !Number.isFinite(monthly) || monthly <= 0) return null;
  const effective = annual / 12;
  const savingsPct = Math.round((1 - annual / (monthly * 12)) * 100);
  const fmt = (n: number) => `${sym}${n.toFixed(2)}`;
  return `${fmt(effective)}/mo · save ${savingsPct}% vs ${fmt(monthly)}/mo`;
}

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

  // PR-01 (audit 2026-04-28): `purchasing` was `"base" | "pro" | null`
  // before the Base TierCard was removed. Pro is the only tier left.
  const [purchasing, setPurchasing] = useState<null | "pro">(null);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [offeringsReady, setOfferingsReady] = useState(false);
  const [earlyRedirected, setEarlyRedirected] = useState(false);
  const [billing, setBilling] = useState<BillingPeriod>("annual");
  // PR-01 (audit 2026-04-28): single Pro card, single focused tier.
  // The state retains the type contract for the analytics emits but
  // never mutates — focusedTier is always `"pro"` after the Base
  // TierCard removal. Kept as state (rather than a const) so the
  // analytics deduping logic that compares `tier !== focusedTier`
  // continues to short-circuit cleanly.
  const [focusedTier, setFocusedTier] = useState<"pro">("pro");
  void setFocusedTier;
  // T22 (full-sweep 2026-04-24): dedup `paywall_viewed` by tier within
  // a single mount. The audit flagged that bouncing between tiers
  // re-fires the same `tier: "pro"` event on every return, inflating
  // F2's denominator. Each (mount, tier) fires once.
  const viewedTiersRef = useRef<Set<string>>(new Set());

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
      // ENG-101 (2026-05-13): classify IAP wiring state so PostHog
      // can alarm on builds that don't resolve to `ok`. Fires once
      // per paywall mount alongside `paywall_viewed`.
      const readiness = classifyPaywallReadiness({
        hasApiKey: isPurchasesApiKeyPresent(),
        packages: pkgs,
        errored,
      });
      track(AnalyticsEvents.paywall_readiness, {
        reason: readiness.reason,
        package_count: pkgs.length,
        platform: Platform.OS === "ios" ? "ios" : "android",
        from: paywallFrom,
      });
      if (__DEV__ && readiness.reason !== "ok") {
        console.warn(
          `[paywall] readiness=${readiness.reason} — ${readiness.diagnostic} Next: ${readiness.nextAction}`,
        );
      }
      // Analytics (L6 G9 + 2026-04-19 round-2): every `paywall_viewed`
      // emit carries `{ from, tier, surface, platform }`. `tier: "pro"`
      // reflects the default visual focus on this screen; if/when we
      // add `paywall_tier_viewed` for Base focus shifts, that will be
      // a separate event (flagged for analytics-engineer).
      // T22 (2026-04-24): dedup by tier within a single mount.
      if (!viewedTiersRef.current.has("pro")) {
        viewedTiersRef.current.add("pro");
        track(AnalyticsEvents.paywall_viewed, {
          from: paywallFrom,
          tier: "pro",
          surface: "route",
          platform: Platform.OS === "ios" ? "ios" : "android",
        });
      }
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
  // PR-01 (audit 2026-04-28): Base packages are no longer resolved.
  // Any Base RC offering still on disk is ignored at the render
  // layer; legacy entitled users keep their access via `isProEntitled`
  // / `resolvedTier` in `lib/purchases.ts`.
  const hasPro = Boolean(proAnnual || proMonthly);
  const hasAnyMonthly = Boolean(proMonthly);
  const hasAnyAnnual = Boolean(proAnnual);
  const showToggle = hasAnyMonthly && hasAnyAnnual;
  void hasPro;

  // Lock billing period if only one frequency is provisioned.
  useEffect(() => {
    if (!offeringsReady) return;
    if (!showToggle) {
      if (hasAnyAnnual && billing !== "annual") setBilling("annual");
      else if (!hasAnyAnnual && hasAnyMonthly && billing !== "monthly") setBilling("monthly");
    }
  }, [offeringsReady, showToggle, hasAnyAnnual, hasAnyMonthly, billing]);

  const currentProPkg = billing === "annual" ? proAnnual : proMonthly;

  // Fallback strings used only when a specific package isn't resolved
  // — keeps the card readable during loading or partial provisioning.
  const fallbackProPrice = billing === "annual" ? FALLBACK_PRICES.proAnnual : FALLBACK_PRICES.proMonthly;
  const periodSuffix = billing === "annual" ? "/year" : "/month";

  const trialApplies = billing === "annual"; // 7-day trial only on Pro annual
  const subscriptionsUnavailable = offeringsReady && packages.length === 0;

  // DC4 (premium-bar audit 2026-05-14): platform-correct trust chips
  // resolved once and threaded into the TierCard so the cancellation
  // chip reads "Cancel anytime in App Store" on mobile rather than
  // the generic "in-app" line. Web parity: `PaywallTrustStrip.tsx`
  // calls `getPaywallTrustChips("web")` so the Stripe Portal variant
  // surfaces there.
  const trustChips = useMemo(() => getPaywallTrustChips("mobile"), []);

  // ─── Interaction handlers ───────────────────────────────────────

  async function onSelectTier(tier: "pro") {
    if (purchasing) return;
    void Haptics.selectionAsync();

    // PR-01 (audit 2026-04-28): only Pro is selectable. Focus-shift
    // dedup logic from the prior two-tier era is now a no-op — Pro
    // is the only viewedTier this mount can encounter.
    void focusedTier;
    void viewedTiersRef;

    const pkg = currentProPkg;
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
        if (userId) {
          // F-143 (2026-05-10): capture sync outcome so we can detect
          // when the RC webhook isn't catching up to a successful
          // purchase. RC's entitlement (checked below) is the immediate
          // truth — `profiles.user_tier` is a server-side projection
          // that arrives via webhook. Telemetry here lets Grace verify
          // the webhook is firing without forcing a per-purchase
          // user-facing wait.
          void (async () => {
            try {
              const outcome = await syncTierToSupabase(customerInfo, supabase, userId);
              try {
                const { track: trackEvent } = await import("@/lib/analytics");
                trackEvent("revenuecat_tier_sync_attempted", {
                  status: outcome.status,
                  from: "from" in outcome ? outcome.from : undefined,
                  to: "to" in outcome ? outcome.to : undefined,
                  error_code: outcome.status === "unexpected_error" ? outcome.error.code : undefined,
                });
              } catch {
                // analytics never blocks the purchase happy path
              }
            } catch (e) {
              // syncTierToSupabase no longer throws on lockdown — but
              // an unhandled throw here would be a real bug, so
              // capture it.
              try {
                const { track: trackEvent } = await import("@/lib/analytics");
                trackEvent("revenuecat_tier_sync_attempted", {
                  status: "unexpected_error",
                  error_code: "throw",
                  error_message: (e as Error)?.message ?? null,
                });
              } catch {
                // swallow analytics failure
              }
            }
          })();
        }
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
          // Trust-explicit confirmation Alert (audit 2026-04-30,
          // user-sentiment pain #1). Lead with cancel-anytime, then
          // trial-end + first-charge, then refund window + zero-email
          // promise. Apple's receipt has the wall-clock dates; the
          // alert states the cadence in plain English. The Alert is
          // dismissed before navigation so the user explicitly
          // acknowledges the disclosures, never bypassing them.
          const cancelPath =
            Platform.OS === "ios"
              ? "Settings > Apple ID > Subscriptions"
              : "Google Play > Payments & subscriptions";
          const trialEndsLabel = trialOnThisPurchase
            ? "in 7 days"
            : "with your billing period";
          const message = buildReceiptTrustCopy({
            trialEndsLabel,
            cancelPath,
          });
          Alert.alert("You're in", message, [
            {
              text: "Continue",
              onPress: () => router.replace("/notifications-prompt"),
            },
          ]);
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
      if (userId) {
        // F-143 telemetry parity with the purchase path.
        void (async () => {
          try {
            const outcome = await syncTierToSupabase(info, supabase, userId);
            try {
              const { track: trackEvent } = await import("@/lib/analytics");
              trackEvent("revenuecat_tier_sync_attempted", {
                status: outcome.status,
                from: "from" in outcome ? outcome.from : undefined,
                to: "to" in outcome ? outcome.to : undefined,
                error_code: outcome.status === "unexpected_error" ? outcome.error.code : undefined,
                surface: "restore",
              });
            } catch {
              // analytics never blocks restore
            }
          } catch (e) {
            try {
              const { track: trackEvent } = await import("@/lib/analytics");
              trackEvent("revenuecat_tier_sync_attempted", {
                status: "unexpected_error",
                error_code: "throw",
                error_message: (e as Error)?.message ?? null,
                surface: "restore",
              });
            } catch {
              // swallow analytics failure
            }
          }
        })();
      }
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
    // T22 (full-sweep 2026-04-24): emit `paywall_dismissed` so F2's
    // conversion denominator gets a real dismiss counterpart on mobile.
    // Fired before the navigation kicks off so the route change can't
    // race the analytics flush.
    track(AnalyticsEvents.paywall_dismissed, {
      from: paywallFrom,
      reason: "close_button",
      surface: "route",
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
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
    // 2026-05-12 (premium-bar audit #1 — Calm/Cal AI parity): lead
    // with the trial benefit when a trial is offered. The previous
    // "Pick the plan that fits" headline buried the strongest
    // conversion lever (free trial) below the fold. Trial only
    // applies on the annual SKU per `trialApplies` rule above; if
    // annual is unavailable, fall back to the generic frame.
    if (trialApplies) return "Try Pro free for 7 days";
    return "Pick the plan that fits";
  })();
  // Debug audit 2026-05-04 (visual-qa P1): the proFlavoured subtitle
  // referenced "Base" — a tier removed in PR-01. Now references the
  // current product structure (Free + Pro).
  // 2026-05-12 (premium-bar audit #1.3): when the trial applies,
  // surface the trial → first-charge story directly in the subtitle
  // so the header reads as a complete pitch (Calm/Cal AI parity).
  const headerSubtitle = trialApplies
    ? "Full Pro free for a week. Cancel anytime in iOS Settings."
    : proFlavoured
      ? "Includes all Free features, plus AI photo and voice logging."
      : "Cancel anytime. Price in your currency, taxes included.";

  // ─── Disclosure copy ────────────────────────────────────────────

  // UK CMA auto-renewal disclosure requires: (1) the price, (2) the renewal
  // frequency, (3) that it renews automatically until cancelled, (4) a clear
  // cancellation path, and — when a free trial is offered — (5) the trial
  // length and (6) when the first charge occurs.
  //
  // Wave-2 (2026-04-30 audit-vs-competitors): the previous copy baked a
  // calendar date computed at render time (`today + 7`). If the user
  // delayed purchase by 2 days, the printed date was wrong by 2 days —
  // a trust-grade fault. Apple anchors the real trial-end and first-
  // charge dates from the actual purchase moment in the receipt; the
  // pre-purchase disclosure now states the trial length + first-charge
  // cadence in days, not a stale clock-time. Post-purchase confirmation
  // surfaces (subscription receipt, Apple's own subscription manager)
  // own the concrete dates from there. CMA's required elements are all
  // preserved: price, renewal frequency, auto-renew until cancelled,
  // cancel path, trial length, when the first charge falls.
  const monthlyProPriceString = proMonthly?.product.priceString ?? FALLBACK_PRICES.proMonthly;
  const disclosureText = (() => {
    const proPriceString = currentProPkg?.product.priceString ?? fallbackProPrice;
    const periodNoun = billing === "annual" ? "year" : "month";
    const altLine =
      billing === "annual"
        ? ` (or ${monthlyProPriceString} per month on the monthly plan)`
        : "";
    const cancelPath =
      Platform.OS === "ios"
        ? "Cancel anytime in Settings > Apple ID > Subscriptions."
        : "Cancel anytime in Google Play > Payments & subscriptions.";
    if (trialApplies && currentProPkg) {
      return `Suppr Pro renews automatically at ${proPriceString} per ${periodNoun}${altLine} until cancelled. Starts your 7-day free trial — first charge after 7 days. ${cancelPath} Prices include any applicable VAT. 7-day refund policy: support@suppr-club.com.`;
    }
    return `Suppr Pro renews automatically at ${proPriceString} per ${periodNoun}${altLine} until cancelled. ${cancelPath} Prices include any applicable VAT. 7-day refund policy: support@suppr-club.com.`;
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
      backgroundColor: colors.inputBg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      justifyContent: "center",
      alignItems: "center",
      zIndex: 10,
    },

    header: {
      paddingTop: insets.top + Spacing.xl,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xl,
      backgroundColor: colors.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    headerKicker: {
      fontSize: 11,
      fontWeight: "700",
      color: colors.textTertiary,
      letterSpacing: 2,
      marginBottom: Spacing.sm,
    },
    headerTitle: { fontSize: 24, fontWeight: "800", color: colors.text, lineHeight: 32 },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginTop: Spacing.xs,
    },

    // 2026-05-14 (premium-bar audit Group I #7): extra bottom padding
    // so the persistent restore-purchase footer (pinned absolutely at
    // the bottom) never overlaps the scroll content. ~Spacing.xxxl is
    // the footer height + safe-area; insets.bottom is the home-indicator
    // padding on top of that.
    scrollContent: { paddingHorizontal: Spacing.xl, paddingBottom: insets.bottom + Spacing.xxxl + 40 },

    trustStripWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: Spacing.sm,
      marginTop: Spacing.lg,
      marginBottom: Spacing.xs,
    },
    /** DC4 (premium-bar audit 2026-05-14): in-card trust strip — sits
     *  ~8px under the price/reference-line so the guarantee reads as
     *  the price's caption (Stripe Checkout precedent). Smaller gap
     *  + left-aligned (vs. centred standalone strip) because it
     *  shares horizontal axis with the price digit above. */
    trustChipsInCard: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
      marginTop: 8,
      marginBottom: Spacing.sm,
    },
    trustChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: Radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    },
    trustChipText: {
      fontSize: 11,
      fontWeight: "600",
      color: colors.textSecondary,
    },

    // 2026-05-14 (premium-bar audit Group I #6): toggle is now the
    // first control after the gradient header — pad the top so it
    // breathes off the header edge (was relying on the trust strip's
    // marginTop above it). marginBottom shrunk slightly because the
    // trust strip below adds its own gap.
    toggleWrap: { alignItems: "center", marginTop: Spacing.xl, marginBottom: Spacing.md, gap: 8 },
    toggleEyebrow: {
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 1.2,
      color: colors.textTertiary,
    },
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
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 19,
      padding: Spacing.md,
      marginTop: Spacing.md,
      marginBottom: Spacing.sm,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
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
    nutritionEstimateNote: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 17,
      marginTop: Spacing.xs,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.md,
    },

    skeletonCard: {
      height: 280,
      borderRadius: Radius.lg,
      backgroundColor: colors.inputBg,
      marginBottom: Spacing.lg,
    },

    // ENG-528 / ENG-588: inline footnote when StoreKit offerings are
    // empty — no full-width "unavailable" card (premium-sweep RTP-3).
    offeringsFootnote: {
      fontSize: 12,
      color: colors.textTertiary,
      textAlign: "center",
      lineHeight: 17,
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.md,
    },

    savingsBadgeRight: { marginLeft: "auto" },
  }), [colors, insets]);

  // ─── Render guards ──────────────────────────────────────────────

  if (earlyRedirected) return <View style={styles.container} />;

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <View testID="screen-paywall" style={styles.container}>
      <Pressable
        style={styles.closeBtn}
        onPress={onClose}
        accessibilityLabel="Close paywall"
        accessibilityHint="Returns you to where you were"
        hitSlop={12}
      >
        <X size={20} color={colors.text} strokeWidth={1.75} />
      </Pressable>

      <View style={styles.header}>
        <Text style={styles.headerKicker}>{headerKicker}</Text>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <Text style={styles.headerSubtitle}>{headerSubtitle}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 2026-05-14 (premium-bar audit Group I #6): period toggle
            promoted to the first prominent control after the headline.
            Previous order placed the trust strip first; testers
            scrolled past the toggle (buried below the chips) and
            landed on the Pro card before realising they could switch
            billing periods. Toggle now reads as the headline's "pick
            your cadence" beat; trust strip follows so trust copy still
            sits above the tier card. */}
        {showToggle ? (
          <View style={styles.toggleWrap}>
            {/* 2026-05-13 (premium-bar audit Group I #4): the period
                toggle floated with no label. Testers in TF feedback
                said they didn't realise the row was switching pricing
                until after they'd tapped — they thought the badge was
                advertising "Save 37%" generically. Tiny BILLING eyebrow
                above the row anchors the toggle's purpose. */}
            <Text style={styles.toggleEyebrow}>BILLING</Text>
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
                {(() => {
                  // Audit P04 (2026-05-05) — derive from PRICING_TIERS
                  // instead of a hardcoded "Save 37%" string. The
                  // headline tier is the first one with annual pricing
                  // (Pro). Falls through to no badge if pricing changes
                  // make the savings <= 0%.
                  const headline = PRICING_TIERS.find((t) => Boolean(t.annualPrice));
                  const badge = headline ? computeAnnualSavingsBadge(headline) : null;
                  if (!badge) return null;
                  // Strip the "Save " prefix for the a11y label so it
                  // reads "Save 37 percent on annual" — same shape as
                  // before, generated from the derived value.
                  const pctMatch = badge.match(/(\d+)/);
                  const pctText = pctMatch ? pctMatch[1] : "";
                  return (
                    <Badge variant="added" accessibilityLabel={`Save ${pctText} percent on annual`}>
                      {badge}
                    </Badge>
                  );
                })()}
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Trust strip — DC4 (premium-bar audit 2026-05-14): chips
            moved INTO each TierCard adjacent to the price digit so
            the guarantee reads as the price's caption, not a banner
            sitting two cards above it. The cancellation chip now
            names the platform-correct surface (App Store on mobile,
            Stripe Portal on web — see `getPaywallTrustChips`). The
            previous strip-above-the-card placement put a 16-24px
            gap between the trust copy and the price; per Stripe
            Checkout's precedent, guarantees sit within ~8px of the
            price element so they read as a single unit. The web
            /pricing surface keeps a shared strip above the grid
            (one strip covers both tiers there); mobile renders
            one paid card so the chips slot directly under the
            price. */}

        {!offeringsReady ? (
          <>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </>
        ) : subscriptionsUnavailable ? (
          // ENG-528 (2026-05-16, Grace decision = "remove entirely"):
          // when RevenueCat offerings can't resolve we previously
          // rendered an explanatory "Subscriptions unavailable" card
          // alongside the value ladder. The card competed with trust
          // chips and read as failed-load. Decision today: drop the
          // card; show the Pro tier value ladder only. CTA stays
          // disabled (no broken purchase), but no shouty "unavailable"
          // signage. Trade: user might tap, the disabled state is the
          // only feedback. Grace accepted that trade.
          <>
            <TierCard
              tier="pro"
              title="Pro"
              tag="Log by photo and voice, faster."
              priceString={billing === "annual" ? FALLBACK_PRICES.proAnnual : FALLBACK_PRICES.proMonthly}
              periodSuffix={periodSuffix}
              showSavings={billing === "annual"}
              referenceLine={
                billing === "annual"
                  ? computeAnnualReferenceLine(
                      FALLBACK_PRICES.proAnnual,
                      FALLBACK_PRICES.proMonthly,
                    )
                  : null
              }
              featHead={PRO_FEATURE_HEAD}
              features={PRO_FEATURES}
              // 2026-05-12 (premium-bar audit #1.7): drop "MOST POPULAR"
              // badge — Pro is the only paid tier on the paywall, so
              // "most popular vs what?" reads as marketing fluff.
              isHero
              // ENG-528: neutral accessibility label (not "Subscriptions
              // unavailable"). The rendered button text is governed by
              // ctaDisabled → "Loading plans…" downstream.
              ctaLabel="Pro plan"
              ctaColor={Accent.primary}
              ctaDisabled
              ctaLoading={false}
              onPress={() => undefined}
              trustChips={trustChips}
              colors={colors}
              styles={styles}
            />
            <Text
              testID="paywall-offerings-footnote"
              style={styles.offeringsFootnote}
            >
              Plans are loading from the App Store. You can continue with the free
              tier below — try again later to subscribe.
            </Text>
          </>
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
                referenceLine={
                  billing === "annual"
                    ? computeAnnualReferenceLine(
                        proAnnual?.product.priceString ?? FALLBACK_PRICES.proAnnual,
                        proMonthly?.product.priceString ?? FALLBACK_PRICES.proMonthly,
                      )
                    : null
                }
                featHead={PRO_FEATURE_HEAD}
                features={PRO_FEATURES}
                // 2026-05-12 (premium-bar audit #1.7): see note above.
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
                trustChips={trustChips}
                colors={colors}
                styles={styles}
              />
            ) : null}

            {/* PR-01 (audit 2026-04-28): the Base TierCard block was
                removed when the tier was excised from the SSOT. The
                paywall now renders Pro as the single paid card. */}
          </>
        )}

        {offeringsReady && !subscriptionsUnavailable ? (
          <Text
            testID="paywall-nutrition-estimate-note"
            style={styles.nutritionEstimateNote}
          >
            Nutrition values are estimates — always review before saving.
          </Text>
        ) : null}

        {/* Auto-renew disclosure (UK CMA). Rendered BEFORE the "Continue
         *  for free" bail-out and BEFORE the trial timeline so the user
         *  sees the composite price + renewal + trial/charge date + cancel
         *  path before committing. Prominent border + body-size text, not
         *  a tiny grey line. */}
        {offeringsReady && !subscriptionsUnavailable ? (
          <Text
            testID="paywall-autorenew-disclosure"
            style={styles.disclosure}
            accessibilityLabel={disclosureText}
          >
            {disclosureText}
          </Text>
        ) : null}

        <Pressable
          style={styles.freeBtn}
          onPress={onContinueFree}
          accessibilityLabel="Continue for free"
        >
          <Text style={styles.freeBtnText}>Continue for free</Text>
        </Pressable>

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
                  placeholder="Enter code"
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

      {/* 2026-05-14 (premium-bar audit Group I #7): persistent
          "Restore purchases" link pinned to the bottom of the
          paywall, always visible regardless of scroll position. The
          in-scroll restore link in the secondary rail above stays
          (returning users land there as part of the secondary rail
          + terms / privacy cluster), but testers below the fold
          previously had to scroll back up to find restore when the
          purchase flow stalled. Footer sits above the safe-area
          inset so it doesn't ride into the home-indicator. */}
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingBottom: insets.bottom + Spacing.sm,
          paddingTop: Spacing.sm,
          alignItems: "center",
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        }}
      >
        <Pressable
          testID="paywall-restore-footer"
          onPress={() => void onRestore()}
          disabled={restoring}
          accessibilityRole="button"
          accessibilityLabel="Restore previous purchases"
          hitSlop={8}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={{ fontSize: 12, color: colors.textSecondary, fontWeight: "500" }}>
              Restore purchases
            </Text>
          )}
        </Pressable>
      </View>
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
  /** L1 (2026-04-21): reference-price line shown beneath the annual
   *  price so "Save 37%" is substantiated. Example:
   *  "£2.50/mo · save 37% vs £3.99/mo". `null` suppresses the line. */
  referenceLine?: string | null;
  featHead: string;
  features: readonly string[];
  badgeLabel?: string;
  isHero?: boolean;
  ctaLabel: string;
  ctaColor: string;
  ctaDisabled: boolean;
  ctaLoading: boolean;
  onPress: () => void;
  /** DC4 (premium-bar audit 2026-05-14): trust chips rendered
   *  directly under the price digit so the guarantee reads as the
   *  price's caption (~8px gap). Pass `null` to suppress, e.g. on
   *  surfaces that already carry the strip externally. */
  trustChips?: ReadonlyArray<PaywallTrustChip> | null;
  colors: ReturnType<typeof useThemeColors>;

  styles: any;
};

function TierCard({
  tier,
  title,
  tag,
  priceString,
  periodSuffix,
  showSavings,
  referenceLine,
  featHead,
  features,
  badgeLabel,
  isHero = false,
  ctaLabel,
  ctaColor,
  ctaDisabled,
  ctaLoading,
  onPress,
  trustChips,
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

      {showSavings && referenceLine ? (
        <Text
          testID={`paywall-annual-reference-${tier}`}
          style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}
        >
          {referenceLine}
        </Text>
      ) : null}

      {/* DC4 (premium-bar audit 2026-05-14): trust chips adjacent to
          price (~8px below). Reads as the price's caption. The
          cancellation chip is platform-correct via
          `getPaywallTrustChips("mobile")` ("Cancel anytime in App
          Store" rather than the generic "in-app"). */}
      {trustChips && trustChips.length > 0 ? (
        <View
          testID="paywall-trust-strip"
          style={styles.trustChipsInCard}
          accessibilityRole="summary"
          accessibilityLabel={`Trust commitments: ${trustChips.map((c) => c.a11yLabel).join(". ")}`}
        >
          {trustChips.map((chip) => (
            <View
              key={chip.label}
              style={styles.trustChip}
              accessibilityLabel={chip.a11yLabel}
            >
              <ShieldCheck size={12} color={Accent.success} strokeWidth={2.25} />
              <Text style={styles.trustChipText}>{chip.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

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
            {/* Audit 2026-04-30: was `${ctaLabel} (unavailable)` which
                concatenated "(unavailable)" onto the price string and read
                like part of the SKU. Now we render a clean fallback when
                the package is missing — never compound with the price. */}
            {ctaDisabled ? "Loading plans…" : ctaLabel}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
