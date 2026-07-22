/**
 * ENG-1642 — mobile thin client for the `meal_shares` RPCs.
 *
 * Wraps the shared pure module (`@suppr/shared/share/mealShareLink`) with
 * the mobile `supabase` singleton + the app's origin convention. Kept thin
 * on purpose — wire validation, item serialization, and token shape all
 * live in the shared module so mobile and web can't drift.
 */
import Constants from "expo-constants";
import { Share } from "react-native";

import { track, isFeatureEnabled } from "@/lib/analytics";
import { normalizeJournalSlotName, type JournalMeal } from "@/lib/nutritionJournal";
import { buildMealShareText } from "@suppr/shared/share/buildMealShareText";
import {
  MEAL_SHARE_FLAG,
  buildMealShareUrl,
  mealToShareItem,
  normaliseMealShareToken,
  parseMealShareLookup,
  type MealShareLookup,
} from "@suppr/shared/share/mealShareLink";

type Extra = { supprApiUrl?: string };

/** Mirrors the `appOrigin` convention in `app/import-shared.tsx` / `app/recipe/[id].tsx`. */
/**
 * The supabase client is imported LAZILY inside the async functions below:
 * `@/lib/supabase` creates its client at module scope from expo config, so a
 * static import here would make every component that merely imports this
 * module (e.g. TodayMealsSection) explode in test environments with no
 * config. Deferred import = the client only materialises on first RPC.
 */
async function getSupabase() {
  const { supabase } = await import("@/lib/supabase");
  return supabase;
}

export function buildMobileMealShareUrl(token: string): string {
  const extra = Constants.expoConfig?.extra as Extra | undefined;
  const origin = (extra?.supprApiUrl ?? "https://suppr-club.com").replace(/\/$/, "");
  return buildMealShareUrl(token, origin);
}

export type MealShareCreateInput = {
  title: string;
  mealSlot: string;
  items: Record<string, unknown>[];
};

/**
 * Serialize a `JournalMeal` for `create_meal_share`. Returns `null` when
 * the meal doesn't serialize to a valid wire item (mirrors the RPC's own
 * rejection so the caller can fall back to the legacy text share without a
 * round trip). `title` reuses the item's own (already-trimmed,
 * already-length-capped) `recipe_title` rather than re-deriving from
 * `meal.recipeTitle` — `mealToShareItem` already guarantees it's non-empty
 * whenever `item` is non-null, so there's no separate fallback to get out
 * of sync.
 */
export function journalMealToShareInput(meal: JournalMeal): MealShareCreateInput | null {
  const item = mealToShareItem(meal);
  if (!item) return null;
  const mealSlot = normalizeJournalSlotName(meal.name);
  return { title: item.recipe_title as string, mealSlot, items: [item] };
}

export async function createMealShare(
  input: MealShareCreateInput,
): Promise<{ status: string; token?: string; shareId?: string }> {
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("create_meal_share", {
    p_title: input.title,
    p_meal_slot: input.mealSlot,
    p_items: input.items,
  });
  if (error || data == null || typeof data !== "object") {
    return { status: "error" };
  }
  const r = data as Record<string, unknown>;
  const status = typeof r.status === "string" ? r.status : "error";
  const token =
    typeof r.token === "string" ? normaliseMealShareToken(r.token) ?? undefined : undefined;
  const shareId = typeof r.share_id === "string" ? r.share_id : undefined;
  return { status, token, shareId };
}

export async function getMealShare(rawToken: string): Promise<MealShareLookup> {
  const token = normaliseMealShareToken(rawToken);
  if (!token) return { status: "invalid" };
  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc("get_meal_share", { p_token: token });
  if (error) return { status: "invalid" };
  return parseMealShareLookup(data);
}

/**
 * Link half of {@link shareJournalMeal}. Returns `false` (never throws —
 * callers catch too, belt-and-suspenders around the RPC) when the meal
 * can't serialize to a wire item or the RPC doesn't return `created`, so
 * the caller falls through to the text-only path.
 *
 * Once `create_meal_share` returns `created`, this ALWAYS returns `true` —
 * even if the native Share sheet itself throws. A link already exists
 * server-side at that point; falling through to the legacy text share
 * would pop a second, redundant native share sheet on top of/after the
 * first. A Share-sheet throw is tracked as its own `meal_share_invoked`
 * (`outcome: "error"`) and swallowed here instead.
 */
async function shareJournalMealAsLink(meal: JournalMeal, surface: string): Promise<boolean> {
  const input = journalMealToShareInput(meal);
  if (!input) return false;
  const result = await createMealShare(input);
  if (result.status !== "created" || !result.token) return false;
  // Fires immediately on creation success, before the native Share sheet —
  // matches the `meal_share_link_created` contract in
  // `src/lib/analytics/events.ts` ("fires once per successful create,
  // before the share sheet / clipboard write").
  track("meal_share_link_created", { surface, itemCount: 1 });
  const url = buildMobileMealShareUrl(result.token);
  // `message` carries the macro-summary text only — the link goes ONLY in
  // the `url` field. iOS's share sheet renders `message` + `url` together,
  // so appending the url to `message` too would duplicate it on-screen
  // (precedent: the non-rich-card branch this fixes mirrors,
  // `app/recipe/[id].tsx`'s `Share.share({ message, url, title })` call).
  const message = buildMealShareText(meal);
  try {
    const shareResult = await Share.share({ message, url, title: meal.recipeTitle });
    track("meal_share_invoked", {
      surface,
      outcome: shareResult.action === Share.dismissedAction ? "dismissed" : "shared",
      mode: "link",
    });
  } catch {
    track("meal_share_invoked", { surface, outcome: "error", mode: "link" });
  }
  return true;
}

/** EXACT pre-ENG-1642 text-only share (macro summary, no durable link). */
async function shareJournalMealAsText(meal: JournalMeal, surface: string): Promise<void> {
  const message = buildMealShareText(meal);
  try {
    const result = await Share.share({ message, title: meal.recipeTitle });
    track("meal_share_invoked", {
      surface,
      outcome: result.action === Share.dismissedAction ? "dismissed" : "shared",
      mode: "text",
    });
  } catch {
    track("meal_share_invoked", { surface, outcome: "error", mode: "text" });
  }
}

/**
 * Shared "Share meal" entry point for Today's long-press Alert path AND the
 * branded action sheet (ENG-1642, `TodayMealsSection.tsx`).
 *
 * Flag `meal_share_links_v1` ON: mints a durable share link
 * (`create_meal_share`) and shares it alongside the existing macro-summary
 * text, so the recipient can add the meal to their own log via
 * `/meal-shared?token=…`. Flag OFF, the meal fails to serialize to a wire
 * item, or the RPC doesn't return `created`: falls through to the EXACT
 * pre-ENG-1642 text-only share — byte-identical behaviour with the flag
 * off. Once a link IS created, this never falls through to the text-only
 * path (even if the native Share sheet throws) — see
 * {@link shareJournalMealAsLink}'s doc for why a second sheet would be
 * wrong once a link already exists.
 */
export async function shareJournalMeal(meal: JournalMeal, surface: string): Promise<void> {
  if (isFeatureEnabled(MEAL_SHARE_FLAG)) {
    try {
      if (await shareJournalMealAsLink(meal, surface)) return;
    } catch {
      // Falls through to the text-only path below.
    }
  }
  await shareJournalMealAsText(meal, surface);
}
