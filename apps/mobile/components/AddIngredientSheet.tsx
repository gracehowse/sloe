/**
 * AddIngredientSheet (Batch 2.7) — mobile bottom-sheet mirror of
 * `AddIngredientDialog` (web). Lets the user add a row the importer
 * missed to an imported recipe.
 *
 * Flow:
 *  1. User types a name + quantity + unit.
 *  2. "Find match" calls the shared verify pipeline for a single row
 *     (via the Next.js API — same `/api/nutrition/verify-recipe` path as
 *     the web dialog) and prefills match macros.
 *  3. Optional manual override inputs replace the match when saving.
 *  4. `onAdd` is called with the payload — the parent writes to Supabase.
 */
import { useEffect, useMemo, useState } from "react";
import { SHEET_RADIUS } from "@/components/ui/SupprCard";
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Constants from "expo-constants";

import { Radius, Spacing, Type } from "@/constants/theme";
import { FilterChip } from "@/components/ui/FilterChip";
import { useAccent } from "@/context/theme";
import { SupprButton } from "./ui/SupprButton";
import { authedFetch } from "@/lib/authedFetch";
import {
  sanitizeOverrideInput,
  type IngredientOverride,
} from "@suppr/nutrition-core/ingredientOverrides";
import { ingredientVerifyNeedsReview } from "@suppr/nutrition-core/verifyConfidencePolicy";
import { formatMacro } from "@suppr/nutrition-core/formatMacro";
import { formatNutritionSourceLabel } from "@/lib/sourceLabel";
import { MODAL_OVERLAY_SCRIM } from "@suppr/shared/theme/modalOverlay";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

type Theme = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  card: string;
  cardBorder: string;
  background: string;
  border: string;
  primaryForeground: string;
};

export type AddIngredientPayload = {
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  /** ENG-1299 — absolute micros panel from the verify match (optional). */
  micros?: Record<string, number>;
  source: string;
  hasMatch: boolean;
  confidence: number;
  overrideMacros?: IngredientOverride;
  /** ENG-1346 — matched food id (any source); feeds `matched_alias_key` at insert. */
  fatSecretFoodId?: string | null;
};

type Match = {
  matchedName: string | null;
  confidence: number;
  source: string;
  macros: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiberG: number;
    sugarG: number;
    sodiumMg: number;
  } | null;
  /** ENG-1299 — absolute micros panel at the row's scaled grams (optional). */
  micros?: Record<string, number>;
  /** ENG-1346 — matched food id (any source) from the verify pipeline. */
  fatSecretFoodId?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (payload: AddIngredientPayload) => void | Promise<void>;
  colors: Theme;
  /** When set, low-confidence matches emit `recipe_verify_needs_review` (parity with web `AddIngredientDialog`). */
  recipeId?: string;
};

const UNITS = ["g", "ml", "oz", "lb", "tbsp", "tsp", "cup", "piece", "slice"] as const;
type Extra = { supprApiUrl?: string };
function apiBase(): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  return (extra?.supprApiUrl ?? "").replace(/\/$/, "");
}

export default function AddIngredientSheet({ visible, onClose, onAdd, colors, recipeId }: Props) {
  // Secondary accent (Frost flag → damson, else clay) for the active unit chip,
  // the primary Save/Add CTA, the "Find match" button, and its link text.
  const accent = useAccent();
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState<string>("g");
  const [matching, setMatching] = useState(false);
  const [match, setMatch] = useState<Match | null>(null);
  const [matchError, setMatchError] = useState<string | null>(null);
  const [showOverride, setShowOverride] = useState(false);
  const [cal, setCal] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [f, setF] = useState("");
  const [fiber, setFiber] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName("");
      setAmount("1");
      setUnit("g");
      setMatching(false);
      setMatch(null);
      setMatchError(null);
      setShowOverride(false);
      setCal("");
      setP("");
      setC("");
      setF("");
      setFiber("");
      setSaving(false);
    }
  }, [visible]);

  const canFindMatch = name.trim().length > 1 && !matching;

  const handleFindMatch = async () => {
    if (!canFindMatch) return;
    Keyboard.dismiss();
    setMatching(true);
    setMatchError(null);
    try {
      const base = apiBase();
      if (!base) {
        setMatchError("API not configured. Enter macros manually below.");
        setShowOverride(true);
        return;
      }
      const res = await authedFetch(`${base}/api/nutrition/verify-recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredients: [{ name: name.trim(), amount: amount.trim() || "1", unit: unit.trim() }],
          servings: 1,
        }),
      });
      if (!res.ok) {
        setMatchError("Lookup failed. Try manual numbers below.");
        setMatch(null);
        return;
      }
      const json = (await res.json()) as {
        ok: boolean;
        verified?: Match[];
        avgIngredientConfidence?: number;
        minIngredientConfidence?: number;
      };
      const v = json.ok && Array.isArray(json.verified) ? json.verified[0] : null;
      if (v && v.macros) {
        setMatch(v);
        setMatchError(null);
        const avg = typeof json.avgIngredientConfidence === "number" ? json.avgIngredientConfidence : v.confidence;
        const min = typeof json.minIngredientConfidence === "number" ? json.minIngredientConfidence : v.confidence;
        if (ingredientVerifyNeedsReview(avg, min)) {
          const plat = Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "web";
          track(AnalyticsEvents.recipe_verify_needs_review, {
            ...(recipeId ? { recipe_id: recipeId } : {}),
            source: "add_ingredient_match",
            platform: plat,
            avgIngredientConfidence: avg,
            minIngredientConfidence: min,
          });
        }
      } else {
        setMatch(null);
        setMatchError("No confident match. Use manual macros below.");
        setShowOverride(true);
      }
    } catch {
      setMatchError("Lookup failed. Try again or enter manual numbers.");
      setMatch(null);
    } finally {
      setMatching(false);
    }
  };

  const overrideRaw = useMemo(
    () => ({
      calories: cal === "" ? null : cal,
      protein: p === "" ? null : p,
      carbs: c === "" ? null : c,
      fat: f === "" ? null : f,
      fiber: fiber === "" ? null : fiber,
    }),
    [cal, p, c, f, fiber],
  );

  const canAdd = name.trim().length > 0 && amount.trim().length > 0 && !saving;

  const handleAdd = async () => {
    if (!canAdd) return;
    setSaving(true);
    try {
      const mm = match?.macros;
      const override = showOverride ? sanitizeOverrideInput(overrideRaw) : null;
      const source = match?.source ?? (override ? "Manual" : "Unverified");
      const confidence = match?.confidence ?? (override ? 0.5 : 0);
      const amt = parseFloat(amount);
      const payload: AddIngredientPayload = {
        name: match?.matchedName ?? name.trim(),
        amount: Number.isFinite(amt) && amt > 0 ? amt : null,
        unit: unit.trim() || null,
        calories: mm?.calories ?? override?.calories ?? 0,
        protein: mm?.protein ?? override?.protein ?? 0,
        carbs: mm?.carbs ?? override?.carbs ?? 0,
        fat: mm?.fat ?? override?.fat ?? 0,
        fiberG: mm?.fiberG ?? override?.fiber ?? 0,
        sugarG: mm?.sugarG ?? 0,
        sodiumMg: mm?.sodiumMg ?? 0,
        // ENG-1299 — carry the match's micros panel with its macros (manual
        // rows have none; overrides keep the match's panel, mirroring how
        // sugar/sodium stay match-sourced under an override).
        ...(mm && match?.micros ? { micros: match.micros } : {}),
        source,
        hasMatch: Boolean(mm),
        confidence,
        // ENG-1346 — carry the matched food id only for an unmodified match (an override no longer represents that exact food).
        ...(mm && !override && match?.fatSecretFoodId ? { fatSecretFoodId: match.fatSecretFoodId } : {}),
      };
      if (override) payload.overrideMacros = override;
      await onAdd(payload);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    input: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.sm,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      color: colors.text,
      ...Type.bodyLarge,
    },
    label: { fontSize: 12, color: colors.textTertiary, fontWeight: "600", marginBottom: 4 },
    row: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
    half: { flex: 1 },
    // Unit chips migrated to the shared §7 FilterChip (chip ruling
    // 2026-07-10, ENG-1375 S1) — soft-tint selection, no border, no raw
    // alpha-suffix fills.
    unitChipRow: { gap: Spacing.xs },
    footer: {
      flexDirection: "row",
      gap: Spacing.sm,
      marginTop: Spacing.md,
      justifyContent: "flex-end",
    },
    // Layout-only override for the SupprButton Cancel/Add (padding/radius/colour
    // come from the button system; this only sets the min commit-button width).
    btnLayout: { minWidth: 96 },
    matchCard: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: Radius.sm,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    findBtn: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: accent.primary,
      paddingVertical: 10,
      borderRadius: Radius.sm,
      alignItems: "center",
      marginBottom: Spacing.md,
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: MODAL_OVERLAY_SCRIM, justifyContent: "flex-end" }}>
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: colors.card,
            borderTopLeftRadius: SHEET_RADIUS,
            borderTopRightRadius: SHEET_RADIUS,
            padding: Spacing.lg,
            paddingBottom: Spacing.xl,
            maxHeight: "92%",
          }}
        >
          <View style={{ alignItems: "center", marginBottom: Spacing.sm }}>
            <View style={{ width: 36, height: 4, borderRadius: Radius.full, backgroundColor: colors.cardBorder }} />
          </View>

          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: 4 }}>
            Add ingredient
          </Text>
          <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: Spacing.md }}>
            Add a row the importer missed. We look up macros automatically; you can also type label values.
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>
            <Text style={styles.label}>Ingredient</Text>
            <TextInput
              style={[styles.input, { marginBottom: Spacing.md }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. cheddar cheese"
              placeholderTextColor={colors.textTertiary}
              autoFocus
              accessibilityLabel="Ingredient name"
            />

            <View style={styles.row}>
              <View style={styles.half}>
                <Text style={styles.label}>Amount</Text>
                <TextInput
                  style={styles.input}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  accessibilityLabel="Amount"
                />
              </View>
              <View style={{ flex: 1.4 }}>
                <Text style={styles.label}>Unit</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={styles.unitChipRow}
                >
                  {UNITS.map((u) => (
                    <FilterChip
                      key={u}
                      label={u}
                      selected={unit === u}
                      onPress={() => setUnit(u)}
                      restFill="secondary"
                      accessibilityLabel={`Unit ${u}`}
                    />
                  ))}
                </ScrollView>
              </View>
            </View>

            <Pressable
              style={styles.findBtn}
              onPress={() => void handleFindMatch()}
              disabled={!canFindMatch}
              accessibilityRole="button"
              accessibilityLabel="Find match in food database"
            >
              {matching ? (
                <ActivityIndicator size="small" color={accent.primary} />
              ) : (
                <Text style={{ color: accent.primarySolid, fontWeight: "700" }}>Find match</Text>
              )}
            </Pressable>

            {match?.macros ? (
              <View style={styles.matchCard}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text, marginBottom: 2 }}>Match: {match.matchedName ?? name.trim()}</Text>
                <Text style={{ ...Type.captionSmall, color: colors.textSecondary }}>
                  {/* ENG-1298 — source id → display label ("Suppr" → "Sloe"). */}
                  {formatNutritionSourceLabel(match.source) ?? match.source} · {Math.round(match.macros.calories)} kcal ·{" "}
                  {formatMacro(match.macros.protein, "protein")}P /{" "}
                  {formatMacro(match.macros.carbs, "carbs")}C /{" "}
                  {formatMacro(match.macros.fat, "fat")}F
                </Text>
              </View>
            ) : null}

            {matchError ? (
              <Text style={{ ...Type.captionSmall, color: colors.textSecondary, marginBottom: Spacing.md }}>
                {matchError}
              </Text>
            ) : null}

            <Pressable
              onPress={() => setShowOverride((v) => !v)}
              style={{ paddingVertical: 8, marginBottom: Spacing.sm }}
              accessibilityRole="button"
              accessibilityLabel="Toggle manual macros"
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: accent.primarySolid }}>
                {showOverride ? "Hide manual macros" : "Enter manual macros (from label)"}
              </Text>
            </Pressable>

            {showOverride ? (
              <>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>Calories (kcal)</Text>
                    <TextInput
                      style={styles.input}
                      value={cal}
                      onChangeText={setCal}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      accessibilityLabel="Manual calories"
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>Protein (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={p}
                      onChangeText={setP}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      accessibilityLabel="Manual protein"
                    />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.half}>
                    <Text style={styles.label}>Carbs (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={c}
                      onChangeText={setC}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      accessibilityLabel="Manual carbs"
                    />
                  </View>
                  <View style={styles.half}>
                    <Text style={styles.label}>Fat (g)</Text>
                    <TextInput
                      style={styles.input}
                      value={f}
                      onChangeText={setF}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      accessibilityLabel="Manual fat"
                    />
                  </View>
                </View>
                <Text style={styles.label}>Fiber (g) — optional</Text>
                <TextInput
                  style={[styles.input, { marginBottom: Spacing.md }]}
                  value={fiber}
                  onChangeText={setFiber}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                  accessibilityLabel="Manual fiber"
                />
              </>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <SupprButton
              variant="ghost"
              style={styles.btnLayout}
              onPress={onClose}
              disabled={saving}
              label="Cancel"
              accessibilityLabel="Cancel add ingredient"
            />
            <SupprButton
              variant="primary"
              style={styles.btnLayout}
              onPress={() => void handleAdd()}
              disabled={!canAdd}
              loading={saving}
              label="Add"
              accessibilityLabel="Add ingredient to recipe"
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
