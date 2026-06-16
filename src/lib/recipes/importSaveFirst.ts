/**
 * ENG-980 — save-first import: land in Library immediately, review later.
 *
 * When `import-save-first-v1` is ON, mobile (and future web) import
 * surfaces persist the parsed recipe before the user finishes review.
 */

export const IMPORT_SAVE_FIRST_FLAG = "import-save-first-v1";

export const IMPORT_SAVE_FIRST_TEST_ID = "import-save-first-banner";

export const IMPORT_SAVE_FIRST_REVIEW_BANNER = {
  label: "In your library — review and refine below",
  a11yLabel:
    "This recipe is already saved to your library. Review ingredients and macros below, then update if you make changes.",
} as const;

export const IMPORT_SAVE_FIRST_UPDATE_CTA = "Update in library";
