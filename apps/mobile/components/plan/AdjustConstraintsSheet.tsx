import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Minus, Plus } from "lucide-react-native";

import { SupprButton } from "@/components/ui/SupprButton";
import { PlanSourceSelector } from "@/components/plan/PlanSourceSelector";
import { Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import {
  CALORIE_FLOOR_MAX,
  CALORIE_FLOOR_MIN,
  CALORIE_FLOOR_STEP,
  clampCalorieFloor,
  type MealsPerDay,
  type PlanAdjustConstraints,
} from "@suppr/shared/planning/planAdjustConstraints";

export interface AdjustConstraintsSheetProps {
  visible: boolean;
  onClose: () => void;
  initial: PlanAdjustConstraints;
  libraryCount: number;
  discoverCount: number;
  saving?: boolean;
  onSave: (next: PlanAdjustConstraints) => void;
}

/**
 * AdjustConstraintsSheet — v3 Plan header sliders sheet (ENG-1247 / B1).
 * Prototype: Sloe-App.html `AdjustConstraints` (~L7256).
 */
export function AdjustConstraintsSheet({
  visible,
  onClose,
  initial,
  libraryCount,
  discoverCount,
  saving = false,
  onSave,
}: AdjustConstraintsSheetProps) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const accent = useAccent();
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    if (visible) setDraft(initial);
  }, [visible, initial]);

  const setMealsPerDay = (mealsPerDay: MealsPerDay) =>
    setDraft((d) => ({ ...d, mealsPerDay }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.scrim}
        onPress={onClose}
        accessibilityLabel="Close adjust constraints"
      >
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={[
            styles.sheet,
            {
              backgroundColor: colors.card,
              paddingBottom: insets.bottom + Spacing.lg,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>Adjust constraints</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            Shape how Sloe builds your week
          </Text>

          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <PlanSourceSelector
              mode={draft.source}
              onChange={(source) => setDraft((d) => ({ ...d, source }))}
              libraryCount={libraryCount}
              discoverCount={discoverCount}
            />
          </View>

          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.spread}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>Daily calorie floor</Text>
              <Text style={[styles.rowValue, { color: colors.text }]}>
                {draft.calorieFloor.toLocaleString()}
              </Text>
            </View>
            <View style={styles.stepper}>
              <Pressable
                accessibilityLabel="Decrease calorie floor"
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    calorieFloor: clampCalorieFloor(d.calorieFloor - CALORIE_FLOOR_STEP),
                  }))
                }
                style={[styles.stepBtn, { borderColor: colors.border }]}
              >
                <Minus size={16} color={colors.text} />
              </Pressable>
              <Text style={[styles.stepHint, { color: colors.textTertiary }]}>
                {CALORIE_FLOOR_MIN.toLocaleString()}–{CALORIE_FLOOR_MAX.toLocaleString()}
              </Text>
              <Pressable
                accessibilityLabel="Increase calorie floor"
                onPress={() =>
                  setDraft((d) => ({
                    ...d,
                    calorieFloor: clampCalorieFloor(d.calorieFloor + CALORIE_FLOOR_STEP),
                  }))
                }
                style={[styles.stepBtn, { borderColor: colors.border }]}
              >
                <Plus size={16} color={colors.text} />
              </Pressable>
            </View>
          </View>

          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <Text style={[styles.rowTitle, { color: colors.text, marginBottom: Spacing.sm }]}>
              Meals per day
            </Text>
            <View style={styles.segRow}>
              {([3, 4] as const).map((n) => {
                const active = draft.mealsPerDay === n;
                return (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${n} meals per day`}
                    onPress={() => setMealsPerDay(n)}
                    style={[
                      styles.segBtn,
                      { borderColor: colors.border },
                      active && { borderColor: accent.primarySolid, backgroundColor: accent.primarySoft },
                    ]}
                  >
                    <Text
                      style={[
                        styles.segLabel,
                        { color: active ? accent.primarySolid : colors.textSecondary },
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
            <View style={styles.toggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>Allow batch & leftovers</Text>
                <Text style={[styles.rowSub, { color: colors.textTertiary }]}>
                  Cook once, repeat across the week
                </Text>
              </View>
              <Switch
                value={draft.allowBatchLeftovers}
                onValueChange={(allowBatchLeftovers) =>
                  setDraft((d) => ({ ...d, allowBatchLeftovers }))
                }
                trackColor={{ true: accent.primarySolid, false: colors.border }}
                thumbColor={colors.card}
                accessibilityLabel="Allow batch and leftovers"
              />
            </View>
          </View>

          <SupprButton
            variant="primary"
            label={saving ? "Saving…" : "Save & regenerate"}
            disabled={saving}
            onPress={() => onSave(draft)}
            style={{ marginTop: Spacing.lg }}
            testID="adjust-constraints-save"
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
    maxHeight: "92%",
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: Radius.full,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  title: { ...Type.title, fontSize: 18 },
  sub: { ...Type.caption, marginTop: 4, marginBottom: Spacing.md },
  card: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.dense,
    marginTop: Spacing.sm,
  },
  spread: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTitle: { ...Type.label, textTransform: "none", letterSpacing: 0, fontSize: 14 },
  rowValue: { fontSize: 15, fontWeight: "700", fontVariant: ["tabular-nums"] },
  rowSub: { ...Type.caption, marginTop: 2 },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepHint: { ...Type.caption, flex: 1, textAlign: "center" },
  segRow: { flexDirection: "row", gap: Spacing.sm },
  segBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  segLabel: { fontSize: 15, fontWeight: "700" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
});

export default AdjustConstraintsSheet;
