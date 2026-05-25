"use client";

/**
 * Personal recipe notes + rating card (Batch 3.8).
 *
 * Renders on `RecipeDetail`, below the action buttons. Owner-agnostic —
 * every signed-in user can add private notes + star rating for any
 * recipe (their own or someone else's).
 *
 * UX decisions:
 *  - Rating stars: radio-like. Click to set, click same star to clear.
 *    Explicit "Clear" link for accessibility. Keyboard: each star is
 *    a focusable button with `aria-label="Rate N stars"`.
 *  - Notes textarea: debounced autosave (800ms after user stops typing).
 *    Explicit visual saving / saved state so the user trusts it.
 *  - "Last cooked" line only appears when `cookCount > 0`.
 *  - We intentionally do NOT fight the main RecipeDetail layout — this
 *    card slots in like any other section.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icons } from "../ui/icons";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "../../../lib/supabase/browserClient";
import {
  getUserRecipeNotes,
  upsertUserRecipeNotes,
  type UserRecipeNotes,
} from "../../../lib/nutrition/recipeNotesClient";
import { AnalyticsEvents } from "../../../lib/analytics/events";
import { track } from "../../../lib/analytics/track";

const MAX_NOTES_LEN = 10_000;
const AUTOSAVE_DEBOUNCE_MS = 800;

type SaveStatus = "idle" | "saving" | "saved" | "error";

function relativeTimeFrom(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const now = Date.now();
  const diffMs = now - then;
  if (diffMs < 0) return "just now";
  const day = 24 * 3600 * 1000;
  const days = Math.floor(diffMs / day);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} wk ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} yr ago`;
}

export interface RecipeNotesCardProps {
  recipeId: string;
  /** Caller passes this in so we don't re-fetch session on every mount. */
  userId: string | null;
}

export function RecipeNotesCard({ recipeId, userId }: RecipeNotesCardProps) {
  const [loading, setLoading] = useState(true);
  const [notesRow, setNotesRow] = useState<UserRecipeNotes | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotesRef = useRef<string>("");

  // Initial load.
  useEffect(() => {
    let cancelled = false;
    if (!userId || !recipeId) {
      setLoading(false);
      return;
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
          toast.error(
            e instanceof Error ? e.message : "Could not load your notes",
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
        setSaveStatus("saved");
        track(AnalyticsEvents.recipe_note_saved, {
          recipeId,
          rating: row.personalRating ?? undefined,
          hasNotes: row.notes.length > 0,
        });
        // Reset to idle after 2 seconds so "Saved" doesn't stick forever.
        setTimeout(() => {
          setSaveStatus((s) => (s === "saved" ? "idle" : s));
        }, 2000);
      } catch (e) {
        setSaveStatus("error");
        toast.error(e instanceof Error ? e.message : "Could not save notes");
      }
    },
    [userId, recipeId],
  );

  // Debounced notes autosave.
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

  // Immediate rating save — no debounce, star clicks feel instant.
  const onRatingChange = useCallback(
    (next: number | null) => {
      setRating(next);
      void saveNow(notesDraft, next);
    },
    [notesDraft, saveNow],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
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

  // Unauthenticated — friendly prompt, no interactive controls.
  if (!userId) {
    return (
      <div className="rounded-card border border-border bg-card p-5 text-sm text-muted-foreground card-elevated">
        Sign in to save personal notes and a private rating for this recipe.
      </div>
    );
  }

  return (
    <section
      aria-labelledby="recipe-notes-heading"
      className="rounded-card border border-border bg-card p-5 space-y-4 card-elevated"
    >
      <div className="flex items-center justify-between">
        <h3
          id="recipe-notes-heading"
          className="text-sm font-semibold text-foreground"
        >
          Your notes
        </h3>
        <SaveStatusLabel status={saveStatus} />
      </div>

      {/* Rating stars */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Rating
        </span>
        <div
          role="radiogroup"
          aria-label="Your personal rating"
          className="flex items-center gap-1"
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const active = rating != null && n <= rating;
            return (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`Rate ${n} ${n === 1 ? "star" : "stars"}`}
                onClick={() => onRatingChange(rating === n ? null : n)}
                className={`p-1 rounded-md transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
                disabled={loading}
              >
                <Star
                  className="w-5 h-5"
                  fill={active ? "currentColor" : "none"}
                  strokeWidth={1.75}
                />
              </button>
            );
          })}
        </div>
        {rating != null && (
          <button
            type="button"
            onClick={() => onRatingChange(null)}
            className="text-xs text-muted-foreground underline hover:text-foreground"
            aria-label="Clear personal rating"
          >
            Clear
          </button>
        )}
      </div>

      {/* Notes textarea */}
      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Personal notes
        </span>
        <textarea
          value={notesDraft}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={loading ? "Loading…" : "Less salt next time. Double the garlic."}
          maxLength={MAX_NOTES_LEN}
          disabled={loading}
          rows={3}
          aria-label="Personal notes for this recipe"
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-y min-h-[80px]"
        />
      </label>

      {lastCookedLabel && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Icons.cook className="w-3 h-3" />
          {lastCookedLabel}
        </p>
      )}
    </section>
  );
}

function SaveStatusLabel({ status }: { status: SaveStatus }) {
  if (status === "saving") {
    return <span className="text-xs text-muted-foreground">Saving…</span>;
  }
  if (status === "saved") {
    return <span className="text-xs text-success">Saved</span>;
  }
  if (status === "error") {
    return <span className="text-xs text-destructive">Could not save</span>;
  }
  return null;
}
