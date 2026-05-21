/**
 * Plan templates bottom sheet (Batch 3.10).
 *
 * Mobile mirror of the web `PlanTemplatesDialog`. Two modes:
 *   - "Save as template" — name + day-count picker
 *   - "My templates" — list with apply + delete actions
 *
 * Saves are rejected loudly (inline error, no toast) when the current plan
 * has zero eligible meals. No shame copy — factual.
 *
 * No I/O happens in this file; callers hand in async onSave/onDelete that
 * route to the shared `planTemplatesClient`.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
} from "react-native";
import { Accent, Radius, Spacing } from "@/constants/theme";
import { useThemeColors } from "@/hooks/use-theme-colors";
import type { PlanTemplate } from "@suppr/shared/nutrition/planTemplates";

type Mode = "save" | "list";

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Eligible (non-placeholder, non-leftover) meal count in the current plan. */
  sourceMealCount: number;
  /** Max dayCount the slider allows — clamped to plan length. */
  maxDayCount: number;
  templates: PlanTemplate[];
  loading: boolean;
  onSave: (name: string, dayCount: number) => Promise<{ ok: boolean; error?: string }>;
  onApply: (templateId: string) => void;
  onDelete: (templateId: string) => Promise<{ ok: boolean; error?: string }>;
};

export function PlanTemplatesSheet({
  visible,
  onClose,
  sourceMealCount,
  maxDayCount,
  templates,
  loading,
  onSave,
  onApply,
  onDelete,
}: Props) {
  const colors = useThemeColors();
  const clampedMax = Math.max(1, Math.min(7, Math.floor(maxDayCount || 1)));
  const [mode, setMode] = useState<Mode>(sourceMealCount > 0 ? "save" : "list");
  const [name, setName] = useState("");
  const [dayCount, setDayCount] = useState<number>(clampedMax);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setName("");
      setDayCount(clampedMax);
      setError(null);
      setMode(sourceMealCount > 0 ? "save" : "list");
    }
  }, [visible, clampedMax, sourceMealCount]);

  const canSave = useMemo(
    () => sourceMealCount > 0 && name.trim().length > 0 && !saving,
    [name, sourceMealCount, saving],
  );

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    const res = await onSave(name.trim(), dayCount);
    setSaving(false);
    if (res.ok) {
      onClose();
    } else {
      setError(res.error ?? "Could not save template.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close templates" />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, borderColor: colors.cardBorder },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Plan templates</Text>
          <Pressable onPress={onClose} accessibilityLabel="Close">
            <Text style={{ color: Accent.primary, fontWeight: "600" }}>Close</Text>
          </Pressable>
        </View>

        <View style={styles.tabs}>
          <Pressable
            onPress={() => setMode("save")}
            style={[
              styles.tab,
              mode === "save" && { backgroundColor: Accent.primary + "22" },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "save" }}
          >
            <Text
              style={{
                color: mode === "save" ? Accent.primary : colors.textSecondary,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              Save as template
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode("list")}
            style={[
              styles.tab,
              mode === "list" && { backgroundColor: Accent.primary + "22" },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: mode === "list" }}
          >
            <Text
              style={{
                color: mode === "list" ? Accent.primary : colors.textSecondary,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              My templates ({templates.length})
            </Text>
          </Pressable>
        </View>

        {mode === "save" ? (
          <View style={{ paddingHorizontal: Spacing.lg }}>
            <Text style={[styles.label, { color: colors.text }]}>Template name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Bulk week, Vacation week, …"
              placeholderTextColor={colors.textTertiary}
              maxLength={80}
              accessibilityLabel="Template name"
              style={[
                styles.input,
                {
                  color: colors.text,
                  borderColor: colors.cardBorder,
                  backgroundColor: colors.background,
                },
              ]}
            />
            <Text style={[styles.label, { color: colors.text, marginTop: Spacing.md }]}>
              {`Day count: ${dayCount} day${dayCount === 1 ? "" : "s"}`}
            </Text>
            <View style={styles.daySelector}>
              {Array.from({ length: clampedMax }, (_, i) => i + 1).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setDayCount(d)}
                  accessibilityLabel={`Save ${d} day${d === 1 ? "" : "s"}`}
                  style={[
                    styles.dayChip,
                    d === dayCount
                      ? { backgroundColor: Accent.primary, borderColor: Accent.primary }
                      : { borderColor: colors.cardBorder },
                  ]}
                >
                  <Text
                    style={{
                      color: d === dayCount ? "#fff" : colors.text,
                      fontWeight: "600",
                      fontSize: 13,
                    }}
                  >
                    {d}
                  </Text>
                </Pressable>
              ))}
            </View>
            {sourceMealCount === 0 ? (
              <Text style={{ color: "#b45309", fontSize: 12, marginTop: Spacing.md }}>
                This plan has no meals to save. Generate a plan first.
              </Text>
            ) : (
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: Spacing.md }}>
                {`Will save the first ${dayCount} day${dayCount === 1 ? "" : "s"} · ${sourceMealCount} meal${sourceMealCount === 1 ? "" : "s"} eligible.`}
              </Text>
            )}
            {error ? (
              <Text style={{ color: "#dc2626", fontSize: 12, marginTop: Spacing.sm }}>
                {error}
              </Text>
            ) : null}
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={[
                styles.primaryBtn,
                { backgroundColor: canSave ? Accent.primary : colors.cardBorder },
              ]}
              accessibilityLabel="Save template"
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {saving ? "Saving…" : "Save template"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={{ paddingHorizontal: Spacing.lg, maxHeight: 360 }}
            contentContainerStyle={{ paddingBottom: Spacing.lg }}
          >
            {loading ? (
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Loading…</Text>
            ) : templates.length === 0 ? (
              <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
                {`No saved templates yet. Switch to "Save as template" after generating a plan.`}
              </Text>
            ) : (
              templates.map((t) => (
                <View
                  key={t.id}
                  style={[
                    styles.templateRow,
                    { backgroundColor: colors.background, borderColor: colors.cardBorder },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontWeight: "600", fontSize: 14 }} numberOfLines={1}>
                      {t.name}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {`${t.dayCount} day${t.dayCount === 1 ? "" : "s"} · ${t.slots.length} meal${t.slots.length === 1 ? "" : "s"}`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => onApply(t.id)}
                    accessibilityLabel={`Apply ${t.name} to this week`}
                    style={styles.rowBtn}
                  >
                    <Text style={{ color: Accent.primary, fontWeight: "600" }}>Apply</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      Alert.alert(
                        "Delete template",
                        `Delete "${t.name}"?`,
                        [
                          { text: "Cancel", style: "cancel" },
                          {
                            text: "Delete",
                            style: "destructive",
                            onPress: async () => {
                              const res = await onDelete(t.id);
                              if (!res.ok && res.error) {
                                Alert.alert("Delete failed", res.error);
                              }
                            },
                          },
                        ],
                      );
                    }}
                    accessibilityLabel={`Delete ${t.name}`}
                    style={styles.rowBtn}
                  >
                    <Text style={{ color: "#dc2626", fontWeight: "600" }}>Delete</Text>
                  </Pressable>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  title: { fontSize: 18, fontWeight: "700" },
  tabs: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  label: { fontSize: 13, fontWeight: "600", marginBottom: Spacing.xs },
  input: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    fontSize: 15,
  },
  daySelector: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.xs,
    flexWrap: "wrap",
  },
  dayChip: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: "center",
  },
  templateRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  rowBtn: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs },
});

export default PlanTemplatesSheet;
