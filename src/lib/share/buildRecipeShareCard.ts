import { displayAttribution } from "../recipes/displayAttribution";
import { webRecipeDeepLink } from "./recipeDeepLink";

/** Inputs for the "Reel → clean card" share artifact (ENG-978 / ENG-979). */
export type RecipeShareCardInput = {
  recipeId: string;
  title: string;
  calories?: number | null;
  protein?: number | null;
  /** When true (default), macro line ends with ", estimated". */
  estimated?: boolean;
  sourceName?: string | null;
  authorDisplayName?: string | null;
  /** `creators.id` — links credit to `/creator/:id` when set. */
  creatorId?: string | null;
  appOrigin: string;
};

export function formatRecipeShareMacroLine(input: {
  calories?: number | null;
  protein?: number | null;
  estimated?: boolean;
}): string | null {
  const cal = input.calories;
  if (cal == null || !Number.isFinite(cal) || cal <= 0) return null;
  const calPart = `~${Math.round(cal)} kcal`;
  const pro = input.protein;
  const proPart =
    pro != null && Number.isFinite(pro) && pro > 0 ? ` · ${Math.round(pro)}g protein` : "";
  const estSuffix = input.estimated !== false ? ", estimated" : "";
  return `${calPart}${proPart}${estSuffix}`;
}

export function formatRecipeCreatorCredit(input: {
  sourceName?: string | null;
  authorDisplayName?: string | null;
}): string {
  const fromAuthor = displayAttribution({ creatorName: input.authorDisplayName });
  const fromSource = displayAttribution({ source: input.sourceName });
  const credit = fromAuthor || fromSource;
  if (!credit) return "";
  return `Recipe by ${credit}`;
}

export function creatorProfileUrl(input: {
  creatorId?: string | null;
  appOrigin: string;
}): string | null {
  const id = (input.creatorId ?? "").trim();
  if (!id) return null;
  const origin = input.appOrigin.replace(/\/$/, "");
  return `${origin}/creator/${encodeURIComponent(id)}`;
}

export function buildRecipeShareCardMessage(input: RecipeShareCardInput): string {
  const origin = input.appOrigin.replace(/\/$/, "");
  const link = webRecipeDeepLink(input.recipeId, origin);
  const title = input.title.trim() || "Recipe";
  const macro = formatRecipeShareMacroLine(input);
  const credit = formatRecipeCreatorCredit(input);
  const profileUrl = creatorProfileUrl({ creatorId: input.creatorId, appOrigin: origin });

  const parts: string[] = [title];
  if (macro) parts.push(macro);
  if (credit) parts.push(credit);
  parts.push("", "made with Sloe", link);
  if (profileUrl && credit) parts.push(profileUrl);
  return parts.join("\n");
}
