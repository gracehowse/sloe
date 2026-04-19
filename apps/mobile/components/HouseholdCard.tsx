import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Accent, Radius, MacroColors } from "@/constants/theme";
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
  type HouseholdData,
} from "../../../src/lib/household/householdClient";

// Map RPC / shared-client error codes to friendly Alert messages. Kept in
// the component file so web (`HouseholdPanel.tsx`) can use the same map
// shape via its own helpers — they intentionally diverge in copy because
// web uses inline error text while mobile uses native Alert.
function mapCreateError(code: string): string {
  if (code === "already_in_household") {
    return "You already belong to a household. Leave it first to create a new one.";
  }
  return code;
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
    default:
      return code || "Couldn't join household.";
  }
}

export function HouseholdCard() {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;
  const colors = useThemeColors();
  const [data, setData] = useState<HouseholdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"idle" | "create" | "join">("idle");
  const [inputValue, setInputValue] = useState("");
  const [showCode, setShowCode] = useState(false);

  const t = {
    text: colors.text,
    sub: colors.textSecondary,
    dim: colors.textTertiary,
    bg: colors.background,
    elevated: colors.card,
    border: colors.cardBorder,
    accent: Accent.primary,
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

  const createHousehold = async () => {
    if (!userId) return;
    try {
      const { error } = await createHouseholdRemote(
        supabase as any,
        userId,
        inputValue.trim() || undefined,
      );
      if (error) {
        Alert.alert("Error", mapCreateError(error));
        return;
      }
      setMode("idle");
      setInputValue("");
      void load();
    } catch (e) {
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

  // No household
  if (!data?.household) {
    return (
      <View style={{ backgroundColor: t.elevated, borderRadius: Radius.lg, borderWidth: 1, borderColor: t.border, padding: 16, marginBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: t.accent + "18", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="people-outline" size={14} color={t.accent} />
          </View>
          <Text style={{ fontSize: 13, fontWeight: "600", color: t.text }}>Household Meals</Text>
        </View>
        <Text style={{ fontSize: 12, color: t.sub, marginBottom: 12, lineHeight: 17 }}>
          Share dinner plans with your household. Members see each other&apos;s daily calorie + macro targets and remaining-today numbers — nothing else from your account is shared.
        </Text>

        {mode === "idle" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={() => setMode("create")} style={{ flex: 1, backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: 10, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>Create</Text>
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
              // Privacy audit M2 (2026-04-18): household members can see
              // each other's daily macro totals + targets server-side.
              // Surface this on the join surface so consent is informed.
              // Copy MUST stay in sync with web HouseholdPanel.tsx.
              <Text style={{ fontSize: 11, color: t.dim, lineHeight: 15 }}>
                Joining shares your daily calorie + macro targets and your remaining-today numbers with every other member of this household. Nothing else from your account is shared.
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => void (mode === "create" ? createHousehold() : joinHousehold())} style={{ flex: 1, backgroundColor: t.accent, borderRadius: Radius.md, paddingVertical: 10, alignItems: "center" }}>
                <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{mode === "create" ? "Create" : "Join"}</Text>
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

      {/* Members remaining macros */}
      <Text style={{ fontSize: 10, fontWeight: "600", color: t.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
        Members — remaining today
      </Text>
      {data.members.map((m) => (
        <View key={m.userId} style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
          <Text style={{ fontSize: 12, fontWeight: "500", color: t.text, width: 70 }} numberOfLines={1}>{m.displayName}</Text>
          <View style={{ flex: 1, flexDirection: "row" }}>
            {([
              ["Cal", m.remaining.calories, m.remaining.calories > 0 ? t.green : t.amber],
              ["P", m.remaining.protein, t.protein],
              ["C", m.remaining.carbs, t.carbs],
              ["F", m.remaining.fat, t.fat],
            ] as const).map(([label, val, color]) => (
              <View key={label} style={{ flex: 1, alignItems: "center" }}>
                <Text style={{ fontSize: 9, color: t.dim }}>{label}</Text>
                <Text style={{ fontSize: 11, fontWeight: "600", color, fontVariant: ["tabular-nums"] }}>
                  {Math.round(val as number)}{label !== "Cal" ? "g" : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ))}

      {/* Today's shared meals */}
      {todayMeals.length > 0 && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: t.border }}>
          <Text style={{ fontSize: 10, fontWeight: "600", color: t.dim, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
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
