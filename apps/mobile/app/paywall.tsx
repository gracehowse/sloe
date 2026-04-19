import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  ensurePurchasesUser,
  getOfferings,
  isPurchasesApiKeyPresent,
  purchasePackage,
  restorePurchases,
  isProEntitled,
  syncTierToSupabase,
} from "@/lib/purchases";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents, type PaywallViewedFrom } from "../../../src/lib/analytics/events";

/** Map a raw `?from=` URL-param string into the canonical enum. Unknown
 *  / missing values fall back to `"deep_link"` so the paywall can be
 *  opened from a generic link without fabricating a specific surface. */
function normalisePaywallFrom(raw: unknown): PaywallViewedFrom {
  const s = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : "";
  switch (s) {
    case "voice_log":
    case "photo_log":
    case "settings":
    case "onboarding":
    case "trial_end":
    case "deep_link":
    // Round-3 additions (2026-04-19) — keep web + mobile helpers
    // exhaustive against the same `PaywallViewedFrom` union. The
    // parity test in `tests/unit/analyticsEvents.test.ts` asserts
    // both switches carry identical `case` sets.
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

const TIMELINE = [
  { icon: "checkmark-circle" as const, color: Accent.success, title: "Your targets are set", desc: "Calorie budget and macro targets based on your goals." },
  { icon: "restaurant" as const, color: Accent.primary, title: "Today: Start importing recipes", desc: "Grab recipes from Instagram, TikTok, or any website — we'll handle the nutrition." },
  { icon: "analytics" as const, color: Accent.info, title: "This week: Save and plan", desc: "Save recipes, verify nutrition, and start a meal plan." },
  { icon: "flag" as const, color: Accent.warning, title: "Day 7: Trial ends", desc: "Your trial ends. Continue with Pro or switch to the free plan." },
];

export default function PaywallScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useThemeColors();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [purchasing, setPurchasing] = useState(false);
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [restoring, setRestoring] = useState(false);
  const [offeringsReady, setOfferingsReady] = useState(false);

  // L6 G9 (2026-04-18) — every `paywall_viewed` MUST carry a canonical
  // `from` so funnel F2 can attribute conversion to the originating
  // surface (voice_log / photo_log / settings / onboarding / trial_end
  // / deep_link). Raw route params are normalised through the enum so
  // a malformed deep-link never bypasses the dashboard slice.
  const params = useLocalSearchParams<{ from?: string | string[] }>();
  const paywallFrom = useMemo(
    () => normalisePaywallFrom(params.from),
    [params.from],
  );

  useEffect(() => {
    // Canonical `paywall_viewed` contract (L6 G9 + 2026-04-19 round-2):
    // every emit carries `{ from, tier, surface, platform }`. The
    // `/paywall` route is the full-route commercial surface (vs the
    // in-flow `AiPaywallSheet`), so `surface: "route"`. Tier is always
    // Pro — this screen only sells Pro.
    track(AnalyticsEvents.paywall_viewed, {
      from: paywallFrom,
      tier: "pro",
      surface: "route",
      platform: Platform.OS === "ios" ? "ios" : "android",
    });
    void (async () => {
      await ensurePurchasesUser(userId);
      const pkgs = await getOfferings();
      setPackages(pkgs);
      setOfferingsReady(true);
    })();
  }, [userId, paywallFrom]);

  // Prefer the annual Pro package so the 7-day trial sell matches the
  // TIMELINE framing ("Day 7: Trial ends") — annual + trial is the
  // canonical Pro purchase path on iOS. Fall back to monthly if the
  // RC offering isn't provisioned with an annual package yet, so
  // users can still upgrade from the trial surface without hitting
  // "Subscriptions not available". The disclosure `priceString`
  // below picks up the right package automatically.
  const annualPkg = packages.find(
    (p) => p.packageType === "ANNUAL" || p.identifier === "$rc_annual",
  );
  const monthlyPkg = packages.find(
    (p) => p.packageType === "MONTHLY" || p.identifier === "$rc_monthly",
  );
  const primaryPkg = annualPkg ?? monthlyPkg ?? packages[0];
  const primaryIsAnnual = Boolean(annualPkg) && primaryPkg === annualPkg;

  // TestFlight `AFE6h9Tlq0bUCugLAJfVGx8` follow-up (2026-04-19): when
  // IAP isn't provisioned in this build the paywall still renders a
  // prominent green "Start Free Trial" CTA even though tapping it
  // surfaces "Subscriptions not available". Flip the hierarchy so the
  // working action ("Continue for free") is primary until IAP ships.
  const trialUnavailable = offeringsReady && packages.length === 0;

  async function onStartTrial() {
    const pkg = primaryPkg;
    if (!pkg) {
      // TestFlight `AFE6h9Tlq0bUCugLAJfVGx8` (2026-04-18) — previously
      // this silently advanced to the next screen, making the trial look
      // free + automatic. That's misleading. Now we surface the actual
      // state so the user (or the tester) knows in-app purchases aren't
      // available yet — and they can still continue on the free tier.
      Alert.alert(
        "Subscriptions not available",
        isPurchasesApiKeyPresent()
          ? "We couldn't load any plans from the App Store right now. Try again in a moment, or continue on the free plan."
          : "Subscriptions aren't enabled in this build. Continue on the free plan.",
        [
          { text: "Continue free", onPress: () => router.replace("/notifications-prompt") },
          { text: "OK", style: "cancel" },
        ],
      );
      return;
    }
    setPurchasing(true);
    try {
      const { success, customerInfo } = await purchasePackage(pkg);
      if (success && customerInfo) {
        if (userId) void syncTierToSupabase(customerInfo, supabase, userId);
        // Only advance when entitlement is actually granted — sync above
        // can race; check the local CustomerInfo before celebrating.
        if (isProEntitled(customerInfo)) {
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
      setPurchasing(false);
    }
  }

  async function onRestore() {
    setRestoring(true);
    try {
      const info = await restorePurchases();
      if (userId) void syncTierToSupabase(info, supabase, userId);
      if (isProEntitled(info)) {
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
    router.replace("/notifications-prompt");
  }

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    closeBtn: {
      position: "absolute", top: insets.top + Spacing.sm, right: Spacing.lg,
      width: 36, height: 36, borderRadius: 18,
      backgroundColor: colors.card, justifyContent: "center", alignItems: "center",
      zIndex: 10,
    },
    header: {
      paddingTop: insets.top + Spacing.xl,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xl,
      backgroundColor: "#1a1a2e",
    },
    headerKicker: { fontSize: 11, fontWeight: "700", color: Accent.success, letterSpacing: 2, marginBottom: Spacing.sm },
    headerTitle: { fontSize: 26, fontWeight: "800", color: "#fff", lineHeight: 34 },
    scroll: { padding: Spacing.xl, gap: Spacing.lg, paddingBottom: 40 },

    timelineItem: { flexDirection: "row", gap: Spacing.md },
    timelineIconWrap: { alignItems: "center", width: 30 },
    timelineDot: { width: 28, height: 28, borderRadius: 14, justifyContent: "center", alignItems: "center" },
    timelineLine: { width: 2, flex: 1, backgroundColor: colors.border, marginTop: 4 },
    timelineContent: { flex: 1, paddingBottom: Spacing.lg },
    timelineTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
    timelineDesc: { fontSize: 13, color: colors.textSecondary, marginTop: 2, lineHeight: 18 },

    freeRow: {
      flexDirection: "row", alignItems: "center", gap: Spacing.sm,
      paddingVertical: Spacing.md, justifyContent: "center",
    },
    freeText: { fontSize: 14, fontWeight: "600", color: colors.text },

    priceText: { fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
    pricingNote: {
      fontSize: 13,
      color: colors.textSecondary,
      textAlign: "center",
      lineHeight: 18,
      marginTop: -Spacing.sm,
    },

    trialBtn: {
      backgroundColor: Accent.success, borderRadius: Radius.md,
      paddingVertical: 18, alignItems: "center",
    },
    trialBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },

    trialBtnPrimary: {
      backgroundColor: Accent.success, borderRadius: Radius.md,
      paddingVertical: 18, alignItems: "center", marginBottom: Spacing.sm,
    },
    trialBtnMuted: {
      backgroundColor: colors.inputBg, borderRadius: Radius.md,
      paddingVertical: 14, alignItems: "center",
    },
    trialBtnMutedText: {
      color: colors.textTertiary, fontWeight: "600", fontSize: 14,
    },

    freeBtn: {
      paddingVertical: 14, alignItems: "center",
    },
    freeBtnText: { color: colors.textTertiary, fontWeight: "600", fontSize: 15 },

    securedRow: {
      flexDirection: "row", alignItems: "center", justifyContent: "center",
      gap: Spacing.sm, marginTop: Spacing.sm,
    },
    securedText: { fontSize: 12, color: colors.textTertiary },
  }), [colors, insets]);

  return (
    <View style={styles.container}>
      <Pressable style={styles.closeBtn} onPress={onContinueFree}>
        <Ionicons name="close" size={20} color={colors.text} />
      </Pressable>

      {/* Dark header */}
      <View style={styles.header}>
        <Text style={styles.headerKicker}>SUPPR PRO</Text>
        <Text style={styles.headerTitle}>Try Pro free{"\n"}for 7 days</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Timeline */}
        {TIMELINE.map((item, i) => (
          <View key={i} style={styles.timelineItem}>
            <View style={styles.timelineIconWrap}>
              <View style={[styles.timelineDot, { backgroundColor: item.color + "20" }]}>
                <Ionicons name={item.icon} size={16} color={item.color} />
              </View>
              {i < TIMELINE.length - 1 && <View style={styles.timelineLine} />}
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineTitle}>{item.title}</Text>
              <Text style={styles.timelineDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}

        {/* Free confirmation */}
        <View style={styles.freeRow}>
          <Ionicons name="checkmark-circle" size={18} color={Accent.success} />
          <Text style={styles.freeText}>No charge today</Text>
        </View>

        <Text style={styles.priceText}>
          {primaryPkg
            ? `7 days free, then ${primaryPkg.product.priceString} per ${primaryIsAnnual ? "year" : "month"}, automatically renewing until cancelled via App Store settings. 7-day refund policy: support@suppr-club.com`
            : "7 days free trial, automatically renewing until cancelled via App Store settings. 7-day refund policy: support@suppr-club.com"}
        </Text>

        {offeringsReady && packages.length === 0 && (
          <Text style={styles.pricingNote}>
            {isPurchasesApiKeyPresent()
              ? "We couldn't load subscription offers. You can still use the app on the free plan, or try again later from Settings."
              : "In-app purchases are not configured in this build. Continue on the free plan, or use a build with the store keys set."}
          </Text>
        )}

        {trialUnavailable ? (
          <>
            <Pressable style={styles.trialBtnPrimary} onPress={onContinueFree}>
              <Text style={styles.trialBtnText}>Continue for free</Text>
            </Pressable>
            <Pressable
              style={styles.trialBtnMuted}
              onPress={() => void onStartTrial()}
              disabled={purchasing}
              accessibilityHint="Subscriptions aren't available in this build yet"
            >
              <Text style={styles.trialBtnMutedText}>Trial unavailable in this build</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.trialBtn, purchasing && { opacity: 0.6 }]}
              onPress={() => void onStartTrial()}
              disabled={purchasing}
            >
              {purchasing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.trialBtnText}>Start Free Trial</Text>
              )}
            </Pressable>
            <Pressable style={styles.freeBtn} onPress={onContinueFree}>
              <Text style={styles.freeBtnText}>Continue for free</Text>
            </Pressable>
          </>
        )}

        <Pressable
          style={styles.freeBtn}
          onPress={() => void onRestore()}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={colors.textTertiary} />
          ) : (
            <Text style={styles.freeBtnText}>Restore purchase</Text>
          )}
        </Pressable>

        <View style={styles.securedRow}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textTertiary} />
          <Text style={styles.securedText}>Secured by Apple</Text>
        </View>
      </ScrollView>
    </View>
  );
}
