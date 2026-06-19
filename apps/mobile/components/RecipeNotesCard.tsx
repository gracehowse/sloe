/**
 * Personal recipe notes + rating card (Batch 3.8 — mobile mirror).
 *
 * Counterpart to web `src/app/components/suppr/recipe-notes-card.tsx`.
 * Same shared client helpers, same UX:
 *   - 5-star picker (tap same star to clear; explicit Clear button too)
 *   - Notes textarea with 800ms debounced autosave
 *   - "Last cooked …" line when cookCount > 0
 *   - "Saving…" / "Saved" microcopy + Alert on error
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { Accent, Radius, Spacing, Type } from "@/constants/theme";
import { useAccent } from "@/context/theme";
import { CARD_RADIUS } from "@/components/ui/SupprCard";
import { supabase } from "@/lib/supabase";
import {
  getUserRecipeNotes,
  upsertUserRecipeNotes,
  type UserRecipeNotes,
} from "@suppr/nutrition-core/recipeNotesClient";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { track } from "@/lib/analytics";

const MAX_NOTES_LEN = 10_000;
const AUTOSAVE_DEBOUNCE_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "error";

type ThemeColors = {
  text: string;
  textSecondary: string;
  textTertiary: string;
  // headers census 2026-06-10: card title now uses navPrimary (serif headline
  // card-header treatment); the full useThemeColors() result the caller passes
  // already carries it — this just widens the local narrowing.
  navPrimary: string;
  card: string;
  border: string;
  background: string;
};

function relativeTimeFrom(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const now = Date.now();
  const diff = now - then;
  if (diff < 0) return "just now";
  const day = 24 * 3600 * 1000;
  const days = Math.floor(diff / day);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export type RecipeNotesCardProps = {
  recipeId: string;
  userId: string | null;
  colors: ThemeColors;
};

export function RecipeNotesCard({ recipeId, userId, colors }: RecipeNotesCardProps) {
  // Secondary accent (Frost flag → damson, else clay) for the active star glyph
  // and the loading spinner. Saved/error labels keep success/destructive.
  const accent = useAccent();
  const [loading, setLoading] = useState(true);
  const [notesRow, setNotesRow] = useState<UserRecipeNotes | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedToastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotesRef = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!userId || !recipeId) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      try {
        const row = await getUserRecipeNotes(supabase as any, userId, recipeId);
        if (cancelled) return;
        setNotesRow(row);
        setNotesDraft(row?.notes ?? "");
        setRating(row?.personalRating ?? null);
        lastSavedNotesRef.current = row?.notes ?? "";
      } catch (e) {
        if (!cancelled) {
          Alert.alert(
            "Could not load notes",
            e instanceof Error ? e.message : "Please try again.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, recipeId]);

  const flashSaved = useCallback(() => {
    setSaveStatus("saved");
    if (savedToastTimeoutRef.current) clearTimeout(savedToastTimeoutRef.current);
    savedToastTimeoutRef.current = setTimeout(() => {
      setSaveStatus((s) => (s === "saved" ? "idle" : s));
    }, 2000);
  }, []);

  const saveNow = useCallback(
    async (nextNotes: string, nextRating: number | null) => {
      if (!userId || !recipeId) return;
      try {
        setSaveStatus("saving");
        const row = await upsertUserRecipeNotes(supabase as any, userId, recipeId, {
          notes: nextNotes,
          personalRating: nextRating,
        });
        setNotesRow(row);
        lastSavedNotesRef.current = row.notes;
        flashSaved();
        track(AnalyticsEvents.recipe_note_saved, {
          recipeId,
          rating: row.personalRating ?? undefined,
          hasNotes: row.notes.length > 0,
        });
      } catch (e) {
        setSaveStatus("error");
        Alert.alert(
          "Could not save notes",
          e instanceof Error ? e.message : "Please try again.",
        );
      }
    },
    [userId, recipeId, flashSaved],
  );

  const onNotesChange = useCallback(
    (value: string) => {
      setNotesDraft(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (value !== lastSavedNotesRef.current) {
          void saveNow(value, rating);
        }
      }, AUTOSAVE_DEBOUNCE_MS);
    },
    [rating, saveNow],
  );

  const onRatingPress = useCallback(
    (n: number) => {
      void Haptics.selectionAsync().catch(() => {});
      const next = rating === n ? null : n;
      setRating(next);
      void saveNow(notesDraft, next);
    },
    [rating, notesDraft, saveNow],
  );

  const onClearRating = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
    setRating(null);
    void saveNow(notesDraft, null);
  }, [notesDraft, saveNow]);

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedToastTimeoutRef.current) clearTimeout(savedToastTimeoutRef.current);
    },
    [],
  );

  const lastCookedLabel = useMemo(() => {
    if (!notesRow || notesRow.cookCount <= 0) return null;
    const when = relativeTimeFrom(notesRow.lastCookedAt);
    const times = notesRow.cookCount === 1
      ? "Cooked 1 time"
      : `Cooked ${notesRow.cookCount} times`;
    return when ? `Last cooked ${when} · ${times}` : times;
  }, [notesRow]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: colors.card,
          borderRadius: CARD_RADIUS,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: Spacing.xl,
          gap: Spacing.md,
        },
        headerRow: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        },
        // headers census 2026-06-10: card title → serif Type.headline + navPrimary
        // (was a 15/700 sans intruder; matches the canonical card-header treatment).
        title: { ...Type.headline, color: colors.navPrimary },
        savingLabel: { fontSize: 11, color: colors.textTertiary },
        savedLabel: { fontSize: 11, color: Accent.success, fontWeight: "600" },
        errorLabel: { fontSize: 11, color: Accent.destructive, fontWeight: "600" },
        ratingRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
        ratingLabel: {
          fontSize: 10,
          fontWeight: "700",
          color: colors.textTertiary,
          letterSpacing: 0.8,
          textTransform: "uppercase",
        },
        stars: { flexDirection: "row", alignItems: "center", gap: 2 },
        starBtn: { padding: 4 },
        clearBtn: { paddingHorizontal: 6 },
        clearText: {
          fontSize: 12,
          color: colors.textTertiary,
          textDecorationLine: "underline",
        },
        notesLabel: {
          fontSize: 10,
          fontWeight: "700",
          color: colors.textTertiary,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginTop: Spacing.xs,
        },
        textarea: {
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.background,
          color: colors.text,
          fontSize: 14,
          paddingHorizontal: 12,
          paddingVertical: 10,
          minHeight: 80,
          textAlignVertical: "top",
        },
        lastCookedRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
        },
        lastCookedText: { fontSize: 11, color: colors.textTertiary },
        signinPrompt: {
          backgroundColor: colors.card,
          borderRadius: Radius.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: Spacing.lg,
        },
        signinText: { color: colors.textSecondary, fontSize: 13 },
      }),
    [colors],
  );

  if (!userId) {
    return (
      <View style={styles.signinPrompt}>
        <Text style={styles.signinText}>
          Sign in to save personal notes and a private rating for this recipe.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card} accessible accessibilityLabel="Your personal notes and rating for this recipe">
      <View style={styles.headerRow}>
        <Text style={styles.title}>Your notes</Text>
        {saveStatus === "saving" && <Text style={styles.savingLabel}>Saving…</Text>}
        {saveStatus === "saved" && <Text style={styles.savedLabel}>Saved</Text>}
        {saveStatus === "error" && <Text style={styles.errorLabel}>Could not save</Text>}
      </View>

      {/* Star rating */}
      <View style={styles.ratingRow}>
        <Text style={styles.ratingLabel}>Rating</Text>
        <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Personal rating">
          {[1, 2, 3, 4, 5].map((n) => {
            const active = rating != null && n <= rating;
            return (
              <Pressable
                key={n}
                onPress={() => onRatingPress(n)}
                style={styles.starBtn}
                disabled={loading}
                accessibilityRole="radio"
                accessibilityState={{ checked: rating === n }}
                accessibilityLabel={`Rate ${n} ${n === 1 ? "star" : "stars"}`}
                hitSlop={6}
              >
                <Ionicons
                  name={active ? "star" : "star-outline"}
                  size={22}
                  color={active ? accent.primary : colors.textTertiary}
                />
              </Pressable>
            );
          })}
        </View>
        {rating != null && (
          <Pressable
            onPress={onClearRating}
            style={styles.clearBtn}
            accessibilityRole="button"
            accessibilityLabel="Clear personal rating"
            hitSlop={6}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Notes */}
      <Text style={styles.notesLabel}>Personal notes</Text>
      {loading ? (
        <ActivityIndicator color={accent.primary} />
      ) : (
        <TextInput
          value={notesDraft}
          onChangeText={onNotesChange}
          placeholder="Less salt next time. Double the garlic."
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={MAX_NOTES_LEN}
          style={styles.textarea}
          accessibilityLabel="Personal notes for this recipe"
        />
      )}

      {lastCookedLabel && (
        <View style={styles.lastCookedRow}>
          <Ionicons name="flame-outline" size={12} color={colors.textTertiary} />
          <Text style={styles.lastCookedText}>{lastCookedLabel}</Text>
        </View>
      )}
    </View>
  );
}
