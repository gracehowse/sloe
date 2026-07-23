import type { ImportKind } from "./classifyImport";

/** Example chips shown when the unified Import sheet is empty (v3 polish). */
export const IMPORT_INPUT_SAMPLES = [
  {
    id: "reel",
    label: "Reel",
    value: "instagram.com/reel/Cv9k2/marry-me-chicken",
  },
  {
    id: "recipe",
    label: "Recipe",
    value: "bbcgoodfood.com/recipes/marry-me-chicken",
  },
  {
    id: "collection",
    label: "Collection",
    value: "thedoctorskitchen.com/recipes",
  },
  {
    id: "plan",
    label: "Plan",
    value: "Monday\nBreakfast: eggs and toast\nLunch: chicken salad\nTuesday\nBreakfast: oats\nDinner: salmon and rice",
  },
  {
    id: "mfp-csv",
    label: "MFP CSV",
    value: "my-fitness-pal-export.csv",
  },
] as const;

export const IMPORT_INPUT_INTRO =
  "Paste a link or choose a file — a single recipe, a reel, a whole collection, a meal plan, or a MyFitnessPal export. Sloe works out which and reads it for you.";

export const IMPORT_INPUT_PLACEHOLDER = "Paste a link, or choose a file…";

/** Prototype detect-row subline copy — one line per classified kind. */
export function importDetectSubline(kind: ImportKind): string {
  switch (kind) {
    case "social":
      return "One recipe from the caption & video";
    case "collection":
      return "Every recipe on the page";
    case "recipe-url":
      return "One recipe with ingredients & steps";
    case "csv":
      return "Bring your diary history across";
    case "plan-text":
      return "A week of meals → your plan";
    case "recipe-text":
      return "We'll read whatever's there";
    case "empty":
      return "";
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
