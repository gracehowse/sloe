/** ENG-973 — explicit anti-MFP wedge copy (Log sheet, pricing, paywall). */
export const BARCODE_FREE_FOREVER_HEADLINE = "Barcode scan is free — always.";
export const BARCODE_FREE_FOREVER_DETAIL = "No paywall. No asterisk.";

/** Paywall / upgrade trust chip (ENG-973). */
export const BARCODE_FREE_PAYWALL_CHIP = {
  label: "Barcode scan free — always",
  a11yLabel:
    "Barcode scanning is free on every plan. No paywall and no asterisk — unlike MyFitnessPal.",
} as const;

/** Loud scan CTA on LogSheet (ENG-932). */
export const BARCODE_LOUD_CTA_LABEL = "Scan barcode";

/** data-testid for paywall barcode trust chip (ENG-973). */
export const BARCODE_FREE_PAYWALL_CHIP_TEST_ID = "paywall-barcode-free-chip";
