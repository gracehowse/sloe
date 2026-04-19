import { useMemo, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/auth";
import { supabase } from "@/lib/supabase";
import { Accent, Spacing, Radius } from "@/constants/theme";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import { resolveTargets } from "@/lib/calcTargets";
import { useThemeColors } from "@/hooks/use-theme-colors";
import { useSafeBack } from "@/hooks/use-safe-back";
import {
  DIETARY_PREFERENCE_ENTRIES,
  normaliseDietaryFromProfile,
  type DietaryPreferenceId,
} from "../../../src/constants/dietaryPreferences";

export default function ProfileScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack("/(tabs)/more");
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [calories, setCalories] = useState(String(NUTRITION_DEFAULTS.calories));
  const [protein, setProtein] = useState(String(NUTRITION_DEFAULTS.protein));
  const [carbs, setCarbs] = useState(String(NUTRITION_DEFAULTS.carbs));
  const [fat, setFat] = useState(String(NUTRITION_DEFAULTS.fat));
  const [fiber, setFiber] = useState(String(NUTRITION_DEFAULTS.fiber));
  const [water, setWater] = useState(String(NUTRITION_DEFAULTS.water));
  const [dietary, setDietary] = useState<DietaryPreferenceId[]>([]);

  const toggleDietary = useCallback((id: DietaryPreferenceId) => {
    setDietary((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { paddingHorizontal: Spacing.xl, paddingBottom: 100, gap: Spacing.lg },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },

    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: Spacing.md,
    },
    backBtn: { color: colors.text, fontSize: 28, fontWeight: "600" },
    headerTitle: { fontSize: 22, fontWeight: "800", color: Accent.primary, letterSpacing: 3 },

    card: {
      backgroundColor: colors.card,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    cardTitle: { fontSize: 16, fontWeight: "700", color: colors.text },

    targetsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
    },
    targetTile: {
      width: "47%",
      borderRadius: Radius.md,
      borderWidth: 1,
      backgroundColor: colors.inputBg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      alignItems: "center",
      gap: 4,
    },
    targetValue: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
    targetLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },

    inputLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", marginTop: Spacing.xs },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: Radius.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
      color: colors.text,
      fontSize: 15,
    },
    inputGrid: { flexDirection: "row", gap: Spacing.md },
    inputHalf: { flex: 1, gap: Spacing.xs },

    saveBtn: {
      backgroundColor: Accent.primary,
      borderRadius: Radius.md,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: Spacing.sm,
    },
    saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

    dietaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
    dietaryChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.inputBg,
    },
    dietaryChipActive: {
      borderColor: Accent.success + "80",
      backgroundColor: Accent.success + "15",
    },
    dietaryLabel: { fontSize: 13, fontWeight: "600", color: colors.textSecondary },
  }), [colors]);

  function TargetStat({ value, label, color }: { value: number; label: string; color: string }) {
    return (
      <View style={[styles.targetTile, { borderColor: color + "55" }]}>
        <Text style={[styles.targetValue, { color }]}>{value}</Text>
        <Text style={styles.targetLabel}>{label}</Text>
      </View>
    );
  }

  const loadProfile = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("profiles")
      .select(
        "display_name, target_calories, target_protein, target_carbs, target_fat, target_fiber_g, target_water_ml, dietary, weight_kg, height_cm, sex, activity_level, goal, dob, age, plan_pace",
      )
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      setDisplayName(data.display_name ?? "");
      const d = data as Record<string, unknown>;
      const resolved = resolveTargets(
        {
          target_calories: d.target_calories != null ? Number(d.target_calories) : null,
          target_protein: d.target_protein != null ? Number(d.target_protein) : null,
          target_carbs: d.target_carbs != null ? Number(d.target_carbs) : null,
          target_fat: d.target_fat != null ? Number(d.target_fat) : null,
          target_fiber_g: d.target_fiber_g != null ? Number(d.target_fiber_g) : null,
        },
        {
          weight_kg: d.weight_kg != null ? Number(d.weight_kg) : null,
          height_cm: d.height_cm != null ? Number(d.height_cm) : null,
          sex: typeof d.sex === "string" ? d.sex : null,
          activity_level: typeof d.activity_level === "string" ? d.activity_level : null,
          goal: typeof d.goal === "string" ? d.goal : null,
          dob: typeof d.dob === "string" ? d.dob : null,
          age: d.age != null ? Number(d.age) : null,
          plan_pace: typeof d.plan_pace === "string" ? d.plan_pace : null,
        },
      );
      setCalories(String(resolved.calories));
      setProtein(String(resolved.protein));
      setCarbs(String(resolved.carbs));
      setFat(String(resolved.fat));
      setFiber(String(resolved.fiber));
      const tw = data.target_water_ml != null ? Number(data.target_water_ml) : NUTRITION_DEFAULTS.water;
      setWater(String(Number.isFinite(tw) && tw > 0 ? Math.round(tw) : NUTRITION_DEFAULTS.water));
      if (data.dietary) setDietary(normaliseDietaryFromProfile(data.dietary));
    }
    setLoading(false);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void loadProfile();
    }, [loadProfile]),
  );

  const save = async () => {
    if (!userId) return;
    setSaving(true);
    const nextCalories = Number(calories) || null;
    const profileData: Record<string, unknown> = {
      id: userId,
      display_name: displayName.trim() || null,
      target_calories: nextCalories,
      target_protein: Number(protein) || null,
      target_carbs: Number(carbs) || null,
      target_fat: Number(fat) || null,
      target_fiber_g: Number(fiber) || null,
      target_water_ml: Number(water) || null,
      dietary: dietary.length > 0 ? dietary : null,
    };
    // A2 provenance — only stamp when a real calorie value is written, else
    // we'd be lying that the user "set" a null. (migration 20260427110000)
    if (nextCalories != null) {
      profileData.target_calories_set_at = new Date().toISOString();
      profileData.target_calories_source = "user";
    }
    // Use upsert so it works for both new and existing profiles
    const { error } = await supabase.from("profiles").upsert(profileData, { onConflict: "id" });
    setSaving(false);
    if (error) {
      console.error("[Profile] save error:", JSON.stringify(error));
      Alert.alert("Error", "Couldn't save. Changes are kept locally.");
    } else {
      Alert.alert("Saved", "Your targets have been updated.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Accent.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={goBack} hitSlop={12}>
            <Text style={styles.backBtn}>‹</Text>
          </Pressable>
          <Text style={styles.headerTitle}>PROFILE</Text>
          <View style={{ width: 28 }} />
        </View>

        {/* Current targets summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Daily Targets</Text>
          <View style={styles.targetsRow}>
            <TargetStat value={Number(calories) || 0} label="kcal" color={Accent.primary} />
            <TargetStat value={Number(protein) || 0} label="Protein" color={Accent.destructive} />
            <TargetStat value={Number(carbs) || 0} label="Carbs" color={Accent.info} />
            <TargetStat value={Number(fat) || 0} label="Fat" color={Accent.warning} />
          </View>
        </View>

        {/* Edit form */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Edit Targets</Text>

          <Text style={styles.inputLabel}>Display Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your name"
            placeholderTextColor={colors.tabIconDefault}
            style={styles.input}
          />

          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Calories</Text>
              <TextInput value={calories} onChangeText={setCalories} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Protein (g)</Text>
              <TextInput value={protein} onChangeText={setProtein} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
          </View>

          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Carbs (g)</Text>
              <TextInput value={carbs} onChangeText={setCarbs} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Fat (g)</Text>
              <TextInput value={fat} onChangeText={setFat} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
          </View>

          <View style={styles.inputGrid}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Fiber (g)</Text>
              <TextInput value={fiber} onChangeText={setFiber} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Water (ml)</Text>
              <TextInput value={water} onChangeText={setWater} keyboardType="number-pad" style={styles.input} placeholderTextColor={colors.tabIconDefault} />
            </View>
          </View>

          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            <Text style={styles.saveBtnText}>{saving ? "Saving..." : "Save Targets"}</Text>
          </Pressable>
        </View>

        {/* Dietary Preferences */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Dietary Preferences</Text>
          <View style={styles.dietaryGrid}>
            {DIETARY_PREFERENCE_ENTRIES.map((pref) => {
              const active = dietary.includes(pref.id);
              return (
                <Pressable
                  key={pref.id}
                  style={[styles.dietaryChip, active && styles.dietaryChipActive]}
                  onPress={() => toggleDietary(pref.id)}
                >
                  <Ionicons
                    name={active ? "checkmark-circle" : "ellipse-outline"}
                    size={18}
                    color={active ? Accent.success : colors.textTertiary}
                  />
                  <Text style={[styles.dietaryLabel, active && { color: colors.text }]}>
                    {pref.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
