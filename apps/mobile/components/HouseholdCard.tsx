import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, Alert, Switch } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Accent, Radius, MacroColors } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
// Direct-to-Supabase household client. Replaced the old
// `fetch("/api/household")` calls (which never worked from React Native —
// no origin → silent failure, TestFlight feedback AAegi1DJEiscjIFi_pYaep4).
// See `src/lib/household/householdClient.ts` for the shared contract.
import {
  createHousehold as createHouseholdRemote,
  getMyHousehold,
  joinHouseholdByInviteCode,
  leaveHousehold as leaveHouseholdRemote,
  setHouseholdShareLunch,
  type HouseholdData,
} from "@suppr/shared/household/householdClient";
import ReceivedInvitesBanner from "@/components/household/ReceivedInvitesBanner";
// Legal-approved copy + storage key (F-16, 2026-04-25). Imported from
// the shared module so web + mobile can never silently diverge — the
// parity test in `tests/unit/householdJoinDisclosureCopy.test.ts`
// pins verbatim equality.
import {
  HOUSEHOLD_CARD_HEADER_COPY,
  HOUSEHOLD_JOIN_DISCLOSURE_COPY,
  SCOPE_NARROWING_NOTICE_COPY,
  SCOPE_NARROWING_NOTICE_KEY,
  SHARE_LUNCH_TOGGLE_HELPER,
  SHARE_LUNCH_TOGGLE_LABEL,
  TARGETS_PRIVATE_LABEL,
} from "@suppr/shared/household/scopeCopy";

// Map RPC / shared-client error codes to friendly Alert messages. Kept in
// the component file so web (`HouseholdPanel.tsx`) can use the same map
// shape via its own helpers — they intentionally diverge in copy because
// web uses inline error text while mobile uses native Alert.
//
// F-142 (2026-05-10): the createHousehold envelope now carries
// `{ code, message, raw }` instead of a string, with the friendly
// copy authored once in the shared client. The mapper here is a
// thin passthrough kept for symmetry with `mapJoinError`.
function mapCreateError(err: { code: string; message: string }): string {
  return err.message;
}

function mapJoinError(code: string): string {
  switch (code) {
    case "missing_code":
      return "Enter the invite code first.";
    case "invalid_code":
      return "No household found with that invite code.";
    case "already_in_household":
      return "Leave your current household first.";
    case "household_full":
      return "This household has reached the maximum of 8 members.";
    case "not_authenticated":
      return "Please sign in again.";
    // T20 (2026-04-24): distinct codes from the hardened RPC.
    case "household_disbanded":
      return "This household has been disbanded.";
    case "invite_expired":
      return "This invite code has expired. Ask the owner for a new one.";
    default:
      return code || "Couldn't join household.";
  }
}

export function HouseholdCard() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();
  // Secondary accent (Frost flag → damson, else clay) for the card's accent
  // colour token. Macros keep `MacroColors`; status keeps success/warning.
  const accent = useAccent();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [inputValue, setInputValue] = useState("");
  const [showCode, setShowCode] = useState(false);
  const [shareLunchSaving, setShareLunchSaving] = useState(false);
  // One-time scope-narrowing notice (F-16). `null` = haven't checked
  // storage yet; `true` = already dismissed; `false` = show the banner.
  // Gate fails closed on read error so a broken AsyncStorage never
  // blocks the rest of the card from rendering.
  const [scopeNoticeSeen, setScopeNoticeSeen] = useState<boolean | null>(null);

  const t = {
    text: colors.text,
    sub: colors.textSecondary,
    dim: colors.textTertiary,
    bg: colors.background,
    elevated: colors.card,
    border: colors.cardBorder,
    accent: accent.primary,
    green: Accent.success,
    amber: Accent.warning,
    protein: MacroColors.protein,
    carbs: MacroColors.carbs,
    fat: MacroColors.fat,
  };

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data: result, error } = await getMyHousehold(supabase as any, userId);
      if (error) {
        // Real infra error — surface instead of silently hiding the card.
        Alert.alert("Couldn't load household", error);
      } else if (result) {
        setData(result);
      }
    } catch (e) {
      Alert.alert("Couldn't load household", (e as Error).message || "Please try again.");
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  // Read the one-time scope-narrowing notice flag. Fail closed — if
  // the read throws, treat as "already seen" so a corrupt
  // AsyncStorage never shows the banner twice.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const v = await AsyncStorage.getItem(SCOPE_NARROWING_NOTICE_KEY);
        if (!cancelled) setScopeNoticeSeen(v === "1");
      } catch {
        if (!cancelled) setScopeNoticeSeen(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismissScopeNotice = useCallback(() => {
    setScopeNoticeSeen(true);
    // Best-effort write — if storage fails the banner is already gone
    // for this session; next launch will re-surface it, which is
    // acceptable versus blocking dismiss on a flaky storage layer.
    void AsyncStorage.setItem(SCOPE_NARROWING_NOTICE_KEY, "1").catch(() => {});
  }, []);

  const toggleShareLunch = useCallback(async (next: boolean) => {
    if (!data?.household?.id) return;
    if (shareLunchSaving) return;
    setShareLunchSaving(true);
    // Optimistic update — flip local state immediately so the switch
    // feels responsive. Revert on failure.
    const previous = data;
    setData({
      ...data,
      household: { ...data.household, shareLunch: next },
    });
    try {
      const { error } = await setHouseholdShareLunch(supabase as any, data.household.id, next);
      if (error) {
        setData(previous);
        Alert.alert("Couldn't update", "Lunch sharing could not be saved. Please try again.");
      } else {
        // Refresh meals — the filter outcome changes with the toggle.
        void load();
      }
    } catch (e) {
      setData(previous);
      Alert.alert("Couldn't update", (e as Error).message || "Please try again.");
    } finally {
      setShareLunchSaving(false);
    }
  }, [data, shareLunchSaving, load]);

  const createHousehold = async () => {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in again to create a household.");
      return;
    }
    try {
      const { data, error } = await createHouseholdRemote(
        supabase as any,
        userId,
        inputValue.trim() || undefined,
      );
      if (error) {
        // F-142 telemetry: capture the failure shape so the next
        // tester report tells us *why* "nothing happened" rather
        // than the user re-reporting an opaque alert. Raw PG error
        // is logged for Sentry breadcrumb / debug only — never
        // surfaced to the user.
        try {
          const { track: trackEvent } = await import("@/lib/analytics");
          trackEvent("household_create_failed", {
            code: error.code,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            raw_message: (error.raw as any)?.message ?? null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            raw_code: (error.raw as any)?.code ?? null,
          });
        } catch {
          // analytics failure must never block error handling
        }
        Alert.alert("Couldn't create household", mapCreateError(error));
        return;
      }
      setMode("idle");
      setInputValue("");
      await load();
      const code = data?.invite_code;
      Alert.alert(
        "Household created",
        code
          ? `Share invite code ${code} with anyone you want to add (up to 8 members).`
          : "You can now invite others using the invite code below.",
      );
    } catch (e) {
      // Unexpected throw — same telemetry shape so we can correlate.
      try {
        const { track: trackEvent } = await import("@/lib/analytics");
        trackEvent("household_create_failed", {
          code: "unexpected_throw",
          raw_message: (e as Error)?.message ?? null,
        });
      } catch {
        // swallow analytics failure
      }
      Alert.alert("Error", (e as Error).message || "Failed to create household");
    }
  };

  const joinHousehold = async () => {
    try {
      const { error } = await joinHouseholdByInviteCode(
        supabase as any,
        inputValue.trim(),
      );
      if (error) {
        Alert.alert("Error", mapJoinError(error));
        return;
      }
      setMode("idle");
      setInputValue("");
      void load();
    } catch (e) {
      Alert.alert("Error", (e as Error).message || "Invalid invite code");
    }
  };

  const leaveHousehold = () => {
    Alert.alert("Leave Household", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave",
        style: "destructive",
        onPress: async () => {
          if (!userId) return;
          try {
            const { error } = await leaveHouseholdRemote(supabase as any, userId);
            if (error) {
              Alert.alert("Error", error);
              return;
            }
            void load();
          } catch (e) {
            Alert.alert("Error", (e as Error).message || "Failed to leave");
          }
        },
      },
    ]);
  };

  if (!userId || loading) return null;

  const todayKey = new Date().toISOString().slice(0, 10);

  // One-time F-16 banner. Rendered only when the user has explicitly
  // loaded the card, has checked storage, and has not yet dismissed.
  const scopeBanner = scopeNoticeSeen === false ? (
    <View
      accessibilityRole="alert"
      style={{
        backgroundColor: t.accent + "14",
        borderLeftWidth: 3,
        borderLeftColor: t.accent,
        borderRadius: Radius.md,
        padding: 12,
        marginBottom: 12,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
      }}
    >
      <Text style={{ flex: 1, fontSize: 12, color: t.text, lineHeight: 17 }}>
        {SCOPE_NARROWING_NOTICE_COPY}
      </Text>
      <Pressable onPress={dismissScopeNotice} accessibilityLabel="Dismiss notice" hitSlop={8}>
        <Ionicons name="close" size={16} color={t.sub} />
      </Pressable>
    </View>
  ) : null;

  // No household
  if (!data?.household) {
    return (
      <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
        {scopeBanner}
        {/* F-111 (TestFlight `AGthJykAoNdxEYKsRoLWf-c`, 2026-05-06):
            received-invites banner above the create/join CTAs. When
            the user has been invited by an existing household owner,
            this banner appears the moment they open Suppr. Accepting
            joins them to the inviter's household and `onAccepted`
            re-pulls /household state. */}
        <ReceivedInvitesBanner onAccepted={load} />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: t.accent + "18", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="people-outline" size={14} color={t.accent} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Household Meals</Text>
        </View>
        <Text style={{ fontSize: 12, color: t.sub, marginBottom: 12, lineHeight: 17 }}>
          {HOUSEHOLD_CARD_HEADER_COPY}
        </Text>

        {mode === "idle" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => setMode("create")} style={{ flex: 1, backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: colors.primaryForeground, fontSize: 13, fontWeight: "600" }}>Create</Text>
            </Pressable>
            <Pressable onPress={() => setMode("join")} style={{ flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: Radius.md, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: t.text, fontSize: 13, fontWeight: "600" }}>Join</Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 8 }}>
            <TextInput
              style={{ backgroundColor: t.bg, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: t.text, borderWidth: 1, borderColor: t.border }}
              placeholder={mode === "create" ? "Household name" : "Invite code"}
              placeholderTextColor={t.dim}
              value={inputValue}
              onChangeText={setInputValue}
              autoFocus
            />
            {mode === "join" && (
              // F-16 scope narrowing (legal-approved 2026-04-25): the
              // disclosure now reflects the tightened model — dinners
              // only by default, lunches opt-in, targets + remaining
              // stay private. Imported verbatim from scopeCopy.ts so
              // web + mobile cannot drift (parity test pins this).
              <Text style={{ fontSize: 11, color: t.dim, lineHeight: 15 }}>
                {HOUSEHOLD_JOIN_DISCLOSURE_COPY}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => void (mode === "create" ? createHousehold() : joinHousehold())} style={{ flex: 1, backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ color: colors.primaryForeground, fontSize: 13, fontWeight: "600" }}>{mode === "create" ? "Create" : "Join"}</Text>
              </Pressable>
              <Pressable onPress={() => { setMode("idle"); setInputValue(""); }} style={{ flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: Radius.md, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: "600" }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    );
  }

  // Has household
  const todayMeals = data.meals.filter((m) => m.date_key === todayKey);

  return (
    <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
      {scopeBanner}
      {/* Header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: t.accent + "18", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="people-outline" size={14} color={t.accent} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>{data.household.name}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {data.household.isOwner && (
            <Pressable onPress={() => setShowCode(!showCode)}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: t.accent }}>{showCode ? "Hide" : "Invite"}</Text>
            </Pressable>
          )}
          <Pressable onPress={leaveHousehold}>
            <Text style={{ fontSize: 12, color: t.dim }}>Leave</Text>
          </Pressable>
        </View>
      </View>

      {/* Invite code */}
      {showCode && (
        <View style={{ backgroundColor: t.bg, borderRadius: Radius.md, padding: 10, marginBottom: 10, alignItems: "center" }}>
          <Text style={{ fontSize: 10, color: t.dim, marginBottom: 4 }}>Share this code</Text>
          <Text style={{ fontSize: 18, fontWeight: "700", color: t.text, letterSpacing: 4, fontVariant: ["tabular-nums"] }}>{data.household.invite_code}</Text>
        </View>
      )}

      {/* Share-lunch toggle. Owner writes; members see the state
          read-only so they know what's shared but can't flip it. */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: 8,
          marginBottom: 8,
          borderBottomWidth: 1,
          borderBottomColor: t.border,
        }}
      >
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={{ fontSize: 12, fontWeight: "600", color: t.text }}>
            {SHARE_LUNCH_TOGGLE_LABEL}
          </Text>
          <Text style={{ fontSize: 10, color: t.dim, marginTop: 2, lineHeight: 14 }}>
            {SHARE_LUNCH_TOGGLE_HELPER}
          </Text>
        </View>
        <Switch
          value={data.household.shareLunch}
          onValueChange={(v) => void toggleShareLunch(v)}
          disabled={!data.household.isOwner || shareLunchSaving}
          accessibilityLabel={SHARE_LUNCH_TOGGLE_LABEL}
        />
      </View>

      {/* Members list. Per F-16 legal approval, only the caller's own
          row shows remaining-today numbers. Other members show name +
          role only — the server already strips targets/remaining from
          those rows, and this UI matches so a future code path that
          accidentally re-shared them would render nothing.

          G-5 (2026-04-19, TestFlight `AJKHqJeCi83sCHF3_7CZMhY`): the
          four numbers under a member's row were ambiguous ("target?
          consumed? remaining?"). Column labels now read "Cal left /
          Protein left / Carbs left / Fat left" and a one-line
          caption under MEMBERS states what the numbers represent.
          Structural parity with web is pinned by
          `tests/unit/householdMemberNumberLabels.test.ts`. */}
      {/* F-32 (2026-04-21): overline typography promoted to prototype spec
          (11/700/uppercase/tracking 1.1). Prior 10/600/0.5 was the
          pre-prototype system. See design-system-enforcer audit. */}
      <Text style={{ fontSize: 11, fontWeight: "700", color: t.dim, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 4 }}>
        Members
      </Text>
      {/* F-48 (2026-04-22): tester flagged "what are the numbers it's
          showing?" across builds 18/20/21. Reframe so the self row shows
          your remaining-today totals against your targets, and other
          members only show identity — not numeric noise. */}
      <Text style={{ fontSize: 12, color: t.dim, marginBottom: 12, lineHeight: 16 }}>
        Your remaining calories and macros for today. Members&apos; targets are private.
      </Text>
      {data.members.map((m) => {
        const isSelf = m.userId === userId;
        // F-32: coloured circular initials avatar (prototype-aligned).
        // Deterministic hue from userId so the same member keeps the
        // same colour across renders. Initials: first letter of first
        // two whitespace-split chunks; fall back to first char alone.
        const initials = (() => {
          const parts = (m.displayName ?? "").trim().split(/\s+/).filter(Boolean);
          if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
          if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
          return "?";
        })();
        const avatarHue = (() => {
          let h = 0;
          const key = m.userId ?? m.displayName ?? "";
          for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
          return Math.abs(h) % 360;
        })();
        return (
          <View key={m.userId} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                backgroundColor: `hsl(${avatarHue}, 55%, 55%)`,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 6,
                marginRight: 8,
              }}
              accessibilityLabel={`${m.displayName} avatar`}
            >
              <Text style={{ color: colors.primaryForeground, fontSize: 9, fontWeight: "700" }}>{initials}</Text>
            </View>
            <Text
              style={{ fontSize: 12, fontWeight: "500", color: t.text, width: 88, marginTop: 8 }}
              numberOfLines={1}
            >
              {m.displayName}{isSelf ? " (you)" : ""}
            </Text>
            <View style={{ flex: 1, flexDirection: "row", justifyContent: "flex-end" }}>
              {m.remaining ? (
                // H4 (2026-04-21): render macros for the caller's own
                // row AND for any other member who has opted in via
                // share_targets. When `remaining` is null/absent the
                // privacy branch below takes over — never fall through
                // to "0" or NaN.
                ([
                  ["Cal left", m.remaining.calories, m.remaining.calories > 0 ? t.green : t.amber, false],
                  ["Protein left", m.remaining.protein, t.protein, true],
                  ["Carbs left", m.remaining.carbs, t.carbs, true],
                  ["Fat left", m.remaining.fat, t.fat, true],
                ] as const).map(([label, val, color, withGrams]) => (
                  <View key={label} style={{ flex: 1, alignItems: "center" }}>
                    <Text
                      style={{ fontSize: 9, color: t.dim, textAlign: "center", lineHeight: 11 }}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: "600", color, fontVariant: ["tabular-nums"], marginTop: 2 }}>
                      {Math.round(val as number)}{withGrams ? "g" : ""}
                    </Text>
                  </View>
                ))
              ) : (
                // H4 privacy branch: member hasn't opted in to target
                // sharing (or the API stripped targets). Render the
                // lock + label instead of numbers — no "0", no NaN.
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}
                  accessibilityLabel={TARGETS_PRIVATE_LABEL}
                >
                  <Ionicons name="lock-closed-outline" size={10} color={t.dim} />
                  <Text style={{ fontSize: 10, color: t.dim }}>
                    {TARGETS_PRIVATE_LABEL}
                  </Text>
                </View>
              )}
            </View>
          </View>
        );
      })}

      {/* Today's shared meals */}
      {todayMeals.length > 0 && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border }}>
          <Text style={{ fontSize: 11, fontWeight: "700", color: t.dim, textTransform: "uppercase", letterSpacing: 1.1, marginBottom: 6 }}>
            Today&apos;s shared meals
          </Text>
          {todayMeals.map((meal) => (
            <View key={meal.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
              <View>
                <Text style={{ fontSize: 12, fontWeight: "600", color: t.text }}>{meal.recipe_title}</Text>
                <Text style={{ fontSize: 10, color: t.dim }}>{meal.meal_label}</Text>
              </View>
              {meal.calories_per_serving != null && (
                <Text style={{ fontSize: 11, fontWeight: "600", color: t.sub, fontVariant: ["tabular-nums"] }}>
                  {meal.calories_per_serving} kcal
                </Text>
              )}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
