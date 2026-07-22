/**
 * ENG-1642 — meal share accept screen (`/meal-shared?token=<hex>`).
 *
 * Reached from a durable `meal_shares` link minted by Today's "Share meal"
 * action (`@/lib/mealShare`, `TodayMealsSection.tsx`). `get_meal_share` is
 * anon-callable, so the preview renders even signed out — the primary CTA
 * becomes a sign-in prompt in that case rather than a silent no-op (there is
 * no `nutrition_entries` row to write without a `user_id`).
 *
 * `shareItemToLoggableMeal` deliberately omits `eatenAt` (see
 * `@suppr/shared/share/mealShareLink` module doc) so the insert always
 * anchors on the recipient's CHOSEN day, never the sharer's source day.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ban, CircleAlert, Clock3, Users, type LucideIcon } from "lucide-react-native";

import { useAuth } from "@/context/auth";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useAccent } from "@/context/theme";
import { useSafeBack } from "@/hooks/use-safe-back";
import { useHaptics } from "@/hooks/useHaptics";
import { useToast } from "@/hooks/useToast";
import { Toast } from "@/components/ui/Toast";
import { PushScreenHeader } from "@/components/PushScreenHeader";
import { NutritionDetailEmptyState } from "@/components/nutrition/NutritionDetailEmptyState";
import { SupprButton } from "@/components/ui/SupprButton";
import { PressableScale } from "@/components/ui/PressableScale";
import { Radius, Spacing, Type } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import { track, isFeatureEnabled } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { newMealId, dateKeyFromDate, type JournalMeal } from "@/lib/nutritionJournal";
import { buildNutritionEntryRow } from "@/lib/nutritionEntryRow";
import { refreshAdaptiveTdeeForUser } from "@/lib/refreshAdaptiveTdee";
import { writeMealToHealthKitIfEnabled } from "@/lib/healthKitMealWriter";
import { snapshotDailyTargetIfMissing } from "@suppr/nutrition-core/dailyTargetSnapshot";
import { ENERGY_NUMBERS_V1_FLAG } from "@suppr/nutrition-core/energyNumbers";
import { getMealShare, storePendingMealShare } from "@/lib/mealShare";
import {
  mealShareTotals,
  shareItemToLoggableMeal,
  type MealSharePayload,
  type MealShareStatus,
} from "@suppr/shared/share/mealShareLink";

const SLOTS = ["Breakfast", "Lunch", "Dinner", "Snacks"] as const;
type Slot = (typeof SLOTS)[number];
const DAY_CHIPS: { label: string; offset: number }[] = [
  { label: "Today", offset: 0 },
  { label: "Tomorrow", offset: 1 },
  { label: "+2 days", offset: 2 },
];

function dayKeyForOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return dateKeyFromDate(d);
}

function paramString(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
}

export default function MealSharedScreen() {
  const { token: tokenParam } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = paramString(tokenParam);
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)");
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const accent = useAccent();
  const haptics = useHaptics();
  const toast = useToast();
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MealShareStatus>("invalid");
  const [payload, setPayload] = useState<MealSharePayload | null>(null);
  const [slot, setSlot] = useState<Slot>("Breakfast");
  const [dayOffset, setDayOffset] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) {
        setStatus("invalid");
        setLoading(false);
        return;
      }
      const lookup = await getMealShare(token);
      if (cancelled) return;
      track("meal_share_link_opened", { status: lookup.status, authed: !!userId });
      if (lookup.status === "ok") {
        setPayload(lookup.payload);
        setSlot((SLOTS as readonly string[]).includes(lookup.payload.mealSlot)
          ? (lookup.payload.mealSlot as Slot)
          : "Breakfast");
      }
      setStatus(lookup.status);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per token; userId only affects the analytics prop.
  }, [token]);

  const totals = useMemo(() => (payload ? mealShareTotals(payload.items) : null), [payload]);
  const targetDayKey = useMemo(() => dayKeyForOffset(dayOffset), [dayOffset]);

  const handleConfirm = useCallback(async () => {
    if (!payload || !userId || submitting) return;
    setSubmitting(true);
    const timeLabel = new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    try {
      const rows = payload.items.map((item) => {
        const loggable = shareItemToLoggableMeal(item, slot, timeLabel);
        const meal: JournalMeal = { ...loggable, id: newMealId() };
        return buildNutritionEntryRow(meal, targetDayKey, userId);
      });
      const { error } = await supabase.from("nutrition_entries").upsert(rows, { onConflict: "id" });
      if (error) throw new Error(error.message);
      void refreshAdaptiveTdeeForUser(supabase, userId);
      void snapshotDailyTargetIfMissing(supabase, userId, {
        canonicalEnergyInputs: isFeatureEnabled(ENERGY_NUMBERS_V1_FLAG),
      });
      // Mirrors web's `addLoggedMealForDate` shape (calories/source/fromPlanner)
      // — that hook fires `food_logged` internally per insert, but this screen
      // writes `nutrition_entries` directly (no shared insert primitive to log
      // through), so the event has to be raised here explicitly to keep the
      // funnel in parity with web's shared-meal accept path.
      for (const row of rows) {
        track(AnalyticsEvents.food_logged, {
          calories: row.calories,
          source: "shared_meal",
          fromPlanner: false,
        });
      }
      // Only today's HealthKit "now" is a real sample timestamp — a
      // future/past-day accept must not book a HK sample dated today.
      const isTargetToday = targetDayKey === dateKeyFromDate(new Date());
      if (isTargetToday) {
        for (const row of rows) {
          void writeMealToHealthKitIfEnabled({
            mealId: row.id,
            userId,
            name: row.recipe_title || row.name,
            calories: row.calories,
            protein: row.protein,
            carbs: row.carbs,
            fat: row.fat,
            fiberG: row.fiber_g,
            date: new Date().toISOString(),
            source: row.source,
            origin: "shared_meal_accept",
          });
        }
      }
      haptics.success();
      toast.showToast("Added to your log", { variant: "success" });
      track("shared_meal_logged", {
        surface: "mobile_accept_screen",
        itemCount: rows.length,
        slot,
      });
      setTimeout(() => router.replace("/(tabs)"), 650);
    } catch {
      toast.showToast("Could not add this meal. Try again.", { variant: "error" });
      setSubmitting(false);
    }
  }, [payload, userId, submitting, slot, targetDayKey, haptics, toast, router]);

  const cardStyle = { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.lg, padding: Spacing.md };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={accent.primary} />
      </View>
    );
  }

  if (status !== "ok" || !payload) {
    const copy: Record<Exclude<MealShareStatus, "ok">, { icon: LucideIcon; title: string; subtitle: string }> = {
      invalid: {
        icon: CircleAlert,
        title: "This link isn't valid",
        subtitle: "This share link isn't valid — ask your friend to send a new one.",
      },
      expired: {
        icon: Clock3,
        title: "This link has expired",
        subtitle: "Ask your friend to share the meal again.",
      },
      revoked: {
        icon: Ban,
        title: "This link was removed",
        subtitle: "The person who shared it turned this link off.",
      },
    };
    const { icon, title, subtitle } = copy[status === "ok" ? "invalid" : status];
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <PushScreenHeader title="Shared meal" onBack={goBack} />
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <NutritionDetailEmptyState
            testID="meal-shared-empty"
            icon={icon}
            title={title}
            subtitle={subtitle}
            ctaLabel="Go back"
            onPress={goBack}
          />
        </View>
      </View>
    );
  }

  const authed = !!userId;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        icon={toast.icon}
        position="bottom"
        inset={insets.bottom + Spacing.lg}
        testID="meal-shared-toast"
      />
      <PushScreenHeader title="Shared meal" onBack={goBack} />
      <ScrollView
        testID="screen-meal-shared"
        contentContainerStyle={{ padding: Spacing.lg, paddingBottom: Spacing.xl, gap: Spacing.lg }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
          <View style={{ width: 32, height: 32, borderRadius: Radius.full, backgroundColor: accent.primarySoft, alignItems: "center", justifyContent: "center" }}>
            <Users size={16} color={accent.primarySolid} />
          </View>
          <Text style={[Type.bodyLarge, { color: colors.textSecondary, flex: 1 }]}>
            {payload.sharedBy ? `${payload.sharedBy} shared a meal` : "Someone shared a meal with you"}
          </Text>
        </View>

        <View style={cardStyle}>
          <Text style={[Type.navTitle, { color: colors.text, marginBottom: Spacing.xs }]}>{payload.title}</Text>
          {payload.items.map((item, i) => (
            <View
              key={`${item.recipeTitle}-${i}`}
              style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: Spacing.xs }}
            >
              <Text style={[Type.body, { color: colors.text, flex: 1 }]} numberOfLines={2}>{item.recipeTitle}</Text>
              <Text style={[Type.body, { color: colors.textSecondary, fontVariant: ["tabular-nums"] }]}>
                {Math.round(item.calories)} kcal
              </Text>
            </View>
          ))}
          {totals ? (
            <View style={{ marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={[Type.captionStrong, { color: colors.text }]}>{Math.round(totals.calories)} kcal total</Text>
              <Text style={[Type.captionSmall, { color: colors.textSecondary }]}>
                {Math.round(totals.protein)}p · {Math.round(totals.carbs)}c · {Math.round(totals.fat)}f
              </Text>
            </View>
          ) : null}
        </View>

        <View>
          <Text style={[Type.label, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>Log to</Text>
          <View style={{ flexDirection: "row", gap: Spacing.xs }}>
            {SLOTS.map((s) => {
              const active = s === slot;
              return (
                <PressableScale
                  key={s}
                  haptic="selection"
                  onPress={() => setSlot(s)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Log to ${s}`}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: Spacing.xs,
                    borderRadius: Radius.full,
                    borderWidth: 1,
                    borderColor: active ? accent.primary : colors.border,
                    backgroundColor: active ? accent.primarySoft : "transparent",
                  }}
                >
                  <Text style={[Type.captionStrong, { color: active ? accent.primarySolid : colors.textSecondary }]}>
                    {s}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View>
          <Text style={[Type.label, { color: colors.textTertiary, marginBottom: Spacing.sm }]}>Log for</Text>
          <View style={{ flexDirection: "row", gap: Spacing.xs }}>
            {DAY_CHIPS.map((c) => {
              const active = c.offset === dayOffset;
              return (
                <PressableScale
                  key={c.label}
                  haptic="selection"
                  onPress={() => setDayOffset(c.offset)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={`Log for ${c.label}`}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: Spacing.xs,
                    borderRadius: Radius.full,
                    borderWidth: 1,
                    borderColor: active ? accent.primary : colors.border,
                    backgroundColor: active ? accent.primarySoft : "transparent",
                  }}
                >
                  <Text style={[Type.captionStrong, { color: active ? accent.primarySolid : colors.textSecondary }]}>
                    {c.label}
                  </Text>
                </PressableScale>
              );
            })}
          </View>
        </View>

        <View style={{ gap: Spacing.sm }}>
          <SupprButton
            variant="primary"
            label={authed ? "Add to my log" : "Sign in to add this"}
            loading={authed && submitting}
            disabled={submitting}
            onPress={
              authed
                ? handleConfirm
                : () => {
                    // ENG-1649 — stash the token so post-auth drain
                    // (app/_layout.tsx) re-opens this screen; no re-tap of
                    // the original link needed. Fire-and-forget: the push
                    // shouldn't wait on storage, and the drain only reads
                    // after sign-in completes.
                    void storePendingMealShare(token ?? "");
                    router.push("/login");
                  }
            }
          />
          <SupprButton variant="ghost" label="Not now" onPress={goBack} disabled={submitting} />
        </View>
      </ScrollView>
    </View>
  );
}
