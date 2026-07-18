/**
 * Social platforms the import wedge recognises. Mirrors
 * `extractSocialRecipe.ts`'s `SocialPlatform`/`detectSocialPlatform`, inlined
 * here so this pure classifier stays free of that module's server-only deps
 * (SSRF guard, fetch, Upstash monitoring) — it must import cleanly into mobile.
 */
export type SocialPlatform = "instagram" | "tiktok" | "youtube" | null;

function detectSocialPlatform(url: string): SocialPlatform {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "instagram.com" || host.endsWith(".instagram.com") || host === "instagr.am") return "instagram";
    if (host === "tiktok.com" || host.endsWith(".tiktok.com") || host === "vm.tiktok.com") return "tiktok";
    if (host === "youtube.com" || host === "www.youtube.com" || host === "m.youtube.com" || host === "youtu.be") return "youtube";
    return null;
  } catch {
    return null;
  }
}

/**
 * classifyImport (ENG-1225 #3) — the shared "detect-anything" classifier behind
 * the unified Import sheet (the viral import wedge). It takes a pasted/shared
 * string and decides what it is, so ONE entry point can route to the right
 * existing flow and show a "Detected: {label}" chip. Replaces the fragmented
 * per-surface detection (mobile `resolveImportUrl`, the MFP CSV card, the
 * separate plan-paste prompt). Pure + shared web↔mobile; the routing/UI lives in
 * the Import sheet that consumes this.
 *
 * Kinds map to flows that already exist (just fragmented today):
 *   - social     → instagram/tiktok/youtube recipe extraction (`extractSocialRecipe`)
 *   - recipe-url → web recipe URL import (`parseRecipeFromHtml`)
 *   - csv        → MyFitnessPal/Cronometer export → column-mapping (#7)
 *   - plan-text  → pasted meal-plan import (`planImport/parsePlanImportPrompt`)
 *   - recipe-text→ pasted recipe text → structured parse
 *   - empty      → nothing to import
 *
 * Deliberately conservative: when a guess isn't well-supported it falls back to
 * the safe, broadest kind (`recipe-text`) rather than mis-routing.
 *
 * NOTE: a "collection" kind (a saved IG/TikTok collection of many posts) is a
 * future addition — collection URLs are rare + ambiguous, so they currently
 * classify as `social`/`recipe-url`. // deferred: see ENG-1581
 */
export type ImportKind =
  | "social"
  | "recipe-url"
  | "csv"
  | "plan-text"
  | "recipe-text"
  | "empty";

export interface ImportClassification {
  kind: ImportKind;
  /** Chip text, e.g. "Instagram reel" / "Nutrition export (CSV)". */
  label: string;
  /** Extracted URL for social / recipe-url; null otherwise. */
  url: string | null;
  /** Social platform when kind === "social"; null otherwise. */
  platform: SocialPlatform;
}

/**
 * First URL in a blob of text. Handles the common share/paste case where the
 * scheme is dropped (`instagram.com/reel/…`, `tiktok.com/@x/video/…`) by
 * accepting a scheme-less host+path and normalising it to `https://`. Requires a
 * path segment on scheme-less matches so a bare domain-in-a-sentence isn't
 * mistaken for a link. Trailing punctuation is trimmed.
 */
function firstUrl(text: string): string | null {
  const schemed = text.match(/https?:\/\/[^\s<>"')]+/i);
  if (schemed) return schemed[0].replace(/[),.;]+$/, "");
  const bare = text.match(/\b((?:www\.)?[a-z0-9][a-z0-9-]*\.[a-z]{2,}\/[^\s<>"')]+)/i);
  if (bare) return `https://${bare[1].replace(/[),.;]+$/, "")}`;
  return null;
}

const SOCIAL_LABEL: Record<Exclude<SocialPlatform, null>, string> = {
  instagram: "Instagram reel",
  tiktok: "TikTok video",
  youtube: "YouTube video",
};

/** Header/columns that mark a MyFitnessPal / Cronometer nutrition CSV export. */
const CSV_HINT = /\b(date|meal|calories|kcal|energy|protein|carb(?:ohydrate)?s?|fat|fiber|fibre|sodium|sugar|serving|food name|amount)\b/i;

function looksLikeCsv(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const header = lines[0]!;
  const cols = header.split(",");
  // A nutrition export: a comma header with ≥3 columns, at least one a known
  // nutrition/meal field, and the body rows are also comma-delimited.
  if (cols.length < 3 || !CSV_HINT.test(header)) return false;
  const commaRows = lines.slice(1).filter((l) => l.includes(",")).length;
  return commaRows >= Math.max(1, Math.floor((lines.length - 1) * 0.6));
}

const DAY_MARKER = /\b(mon(day)?|tue(s|sday)?|wed(nesday)?|thu(r|rs|rsday)?|fri(day)?|sat(urday)?|sun(day)?|day\s*\d)\b/gi;
const MEAL_MARKER = /\b(breakfast|lunch|dinner|snack|brunch|supper)\b/gi;

function looksLikeMealPlan(text: string): boolean {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 3) return false;
  const days = new Set((text.match(DAY_MARKER) ?? []).map((d) => d.toLowerCase().slice(0, 3))).size;
  const meals = (text.match(MEAL_MARKER) ?? []).length;
  // A plan reads as a grid: several distinct days, or many meal-slot headers.
  return days >= 2 || meals >= 3;
}

export function classifyImport(raw: string): ImportClassification {
  const text = (raw ?? "").trim();
  if (!text) {
    return { kind: "empty", label: "Nothing to import", url: null, platform: null };
  }

  const url = firstUrl(text);
  if (url) {
    const platform = detectSocialPlatform(url);
    if (platform) {
      return { kind: "social", label: SOCIAL_LABEL[platform], url, platform };
    }
    return { kind: "recipe-url", label: "Recipe link", url, platform: null };
  }

  if (looksLikeCsv(text)) {
    return { kind: "csv", label: "Nutrition export (CSV)", url: null, platform: null };
  }
  if (looksLikeMealPlan(text)) {
    return { kind: "plan-text", label: "Meal plan", url: null, platform: null };
  }
  return { kind: "recipe-text", label: "Recipe text", url: null, platform: null };
}
