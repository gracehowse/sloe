import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";

import { Accent, Spacing, Radius } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
  isProEntitled,
  syncTierToSupabase,
} from "@/lib/purchases";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";

const TIMELINE = [
  { icon: "checkmark-circle" as const, color: Accent.success, title: "Your targets are set", desc: "Calorie budget and macro targets based on your goals." },
  { icon: "restaurant" as const, color: Accent.primary, title: "Today: Start importing recipes", desc: "Grab recipes from Instagram, TikTok, or any website — we'll handle the nutrition." },
  { icon: "analytics" as const, color: Accent.info, title: "This week: Build your library", desc: "Save, verify, and plan meals that hit your macros." },
  { icon: "flag" as const, color: Accent.warning, title: "Day 7: Trial ends", desc: "Keep going with Pro, or continue with the free plan. We'll remind you before." },
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

  useEffect(() => {
    void getOfferings().then(setPackages);
  }, []);

  const annualPkg = packages.find(
    (p) => p.packageType === "ANNUAL" || p.identifier === "$rc_annual",
  );

  async function onStartTrial() {
    const pkg = annualPkg ?? packages[0];
    if (!pkg) {
      Alert.alert(
        "Subscriptions unavailable",
        "We couldn't load pricing. You can try again later from Settings.",
        [{ text: "Continue", onPress: () => router.replace("/notifications-prompt") }],
      );
      return;
    }
    setPurchasing(true);
    try {
      const { success, customerInfo } = await purchasePackage(pkg);
      if (success && customerInfo) {
        if (userId) void syncTierToSupabase(customerInfo, supabase, userId);
        router.replace("/notifications-prompt");
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

    trialBtn: {
      backgroundColor: Accent.success, borderRadius: Radius.md,
      paddingVertical: 18, alignItems: "center",
    },
    trialBtnText: { color: "#fff", fontWeight: "700", fontSize: 17 },

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
        <Text style={styles.headerKicker}>PLATEMATE PRO</Text>
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
          <Text style={styles.freeText}>No Payment Due Now</Text>
        </View>

        <Text style={styles.priceText}>
          {annualPkg
            ? `7 days free, then ${annualPkg.product.priceString} per year. Cancel anytime. No charge today.`
            : "7 days free trial. Cancel anytime. No charge today."}
        </Text>

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
