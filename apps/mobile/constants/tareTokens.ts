/**
 * Tare aesthetic v1 — token palettes for mobile.
 *
 * Mobile-side mirror of `src/styles/tare-aesthetic.css` (web). Same hex
 * values; same semantic structure. Locked direction documented at
 * `docs/decisions/2026-05-19-suppr-design-direction-v1.md`.
 *
 * Architecture note: web uses CSS custom properties remapped via
 * `body.tare-on { --primary: … }` so every `var(--token)` consumer
 * remaps atomically with one class flip. React Native has no equivalent
 * — consumers import static values directly. This module exports the
 * Tare palette as JS objects; the `useTarePalette()` hook in
 * `lib/tareAesthetic.ts` returns the active palette when the feature
 * flag (or the device-local preview override) resolves true, and
 * `null` otherwise so consumers fall back to the existing `Accent` /
 * `MacroColors` exports in `constants/theme.ts`.
 *
 * Phase 0.8 (2026-05-19) — softened macro palette. Each macro keeps
 * its hue family (blue / orange / pink / green) at ~12-15% lower
 * saturation than Suppr's current data-viz palette. Considered
 * tonality without going earthy. See ledger in the direction doc.
 *
 * NEVER use these values directly. Always read via `useTarePalette()`
 * so consumers respect the flag.
 */

export type TareMode = "light" | "dark";

export interface TarePalette {
  // ── Surfaces (warm cream daily / peach acquisition / warm-black dark) ──
  bg: string;             // page background
  card: string;           // card surface — lifts off the page
  secondary: string;      // inset / chip backgrounds
  muted: string;          // hover / muted background
  surfacePeach: string;   // acquisition-only — paywall hero / onboarding intro
  surfacePeachInk: string; // text on peach surface

  // ── Rules / dividers (warm hairlines) ──
  border: string;         // hairline rule
  borderStrong: string;   // 8% alpha on text colour — for stronger dividers

  // ── Text ramp (true greyscale, four steps) ──
  fg: string;             // primary text
  fgSoft: string;         // de-emphasised primary
  fgMute: string;         // secondary text
  fgDim: string;          // tertiary / labels
  fgFaint: string;        // disabled

  // ── Accent — INK monochrome, the canonical default ──
  // Used ONLY in: streak count · ring progress · FAB · "Log meal" CTA ·
  // today marker · active tab-bar item label. Nowhere else.
  accent: string;
  accentInk: string;      // text on the accent
  accentStrong: string;   // depper variant for text-on-page-bg
  accentWash: string;     // 6-10% alpha — subtle backgrounds

  // ── Warmth-pack accent (terracotta) — opt-in for marketing surfaces ──
  // Apply per-surface via the warmthPack pickers; NEVER the daily-use
  // default. Phase V11 will wire user-selectable theme presets.
  accentWarm: string;
  accentWarmInk: string;
  accentWarmWash: string;

  // ── Macros — SOFTENED DATA palette (Phase 0.8) ──
  // Functional only. Each macro keeps its hue family at ~12-15% lower
  // saturation than the iOS-data-viz default. Considered tonality.
  macroProtein: string;       // cobalt-denim
  macroProteinSoft: string;
  macroCarbs: string;          // warm amber
  macroCarbsSoft: string;
  macroFat: string;             // soft rose
  macroFatSoft: string;
  macroFiber: string;            // sage-leaning green
  macroFiberSoft: string;
  macroCalories: string;          // matches fiber tonality (calorie ring)
  macroWater: string;             // cyan (kept — not a macro identity)

  // ── Source / provenance dots ──
  sourceUsda: string;
  sourceOff: string;
  sourceFatSecret: string;
  sourceAi: string;

  // ── Meal-slot tints (tied to macro identity per print-bundle pattern) ──
  slotBreakfast: string;     // carbs tint (wheat / oats)
  slotBreakfastSoft: string;
  slotLunch: string;          // fiber tint (greens / vegetables)
  slotLunchSoft: string;
  slotDinner: string;         // protein tint (the main meal)
  slotDinnerSoft: string;
  slotSnack: string;           // cyan (own identity)
  slotSnackSoft: string;

  // ── Calorie ring tokens ──
  ringBg: string;             // track — warm cream hairline
  ringTrack: string;          // progress arc — softened green (under-budget)

  // ── Highlight wash (for italic single-word emphasis) ──
  highlightWash: string;
  highlightInk: string;

  // ── Semantic ──
  destructive: string;
  success: string;
  warning: string;

  // ── Chart palette (line + bar charts) ──
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;

  // ── Confidence colours ──
  confidenceHigh: string;
  confidenceMed: string;
  confidenceLow: string;
  confidenceNeutral: string;

  // ── Font families ──
  // Loaded via @expo-google-fonts/inter + @expo-google-fonts/newsreader
  // in apps/mobile/app/_layout.tsx. The values here are the resolved
  // PostScript names the OS picks up after font.loadAsync completes.
  fontSans: string;          // Inter — body, data, labels
  fontSerif: string;         // Newsreader — editorial moments (titles)
}

// ─────────────────────────────────────────────────────────────────────
// Light mode palette
// ─────────────────────────────────────────────────────────────────────
export const TARE_LIGHT: TarePalette = {
  // 2026-05-19 — lifted from `#f1ebdf` (Phase 0.7 settled value) to
  // `#f6f3ee` after sim review: the warmer/darker cream read as muddy
  // against the white card. `#f6f3ee` is closer to a true warm-paper
  // off-white — cards still have separation, but the page no longer
  // pushes the reader's eye down. Mirror: `--background` in
  // `src/styles/tare-aesthetic.css`. Same commit; web + mobile parity.
  bg: "#f6f3ee",
  card: "#ffffff",
  secondary: "#ebe5d8",
  muted: "#e6dfd0",
  surfacePeach: "#f6e4d6",
  surfacePeachInk: "#2a160e",

  border: "#e6e1d6",
  borderStrong: "rgba(20,14,8,0.08)",

  fg: "#14141a",
  fgSoft: "#3a352e",
  fgMute: "#6f6a60",
  fgDim: "#a39d92",
  fgFaint: "#c7c1b3",

  accent: "#14141a",
  accentInk: "#ffffff",
  accentStrong: "#000000",
  accentWash: "rgba(20,20,26,0.06)",

  accentWarm: "#a04f30",
  accentWarmInk: "#ffffff",
  accentWarmWash: "rgba(160,79,48,0.08)",

  macroProtein: "#5b6fb8",
  macroProteinSoft: "rgba(91,111,184,0.13)",
  macroCarbs: "#c87935",
  macroCarbsSoft: "rgba(200,121,53,0.14)",
  macroFat: "#c4708a",
  macroFatSoft: "rgba(196,112,138,0.14)",
  macroFiber: "#5d8a5c",
  macroFiberSoft: "rgba(93,138,92,0.14)",
  macroCalories: "#4d8a5c",
  macroWater: "#06b6d4",

  sourceUsda: "#4d8a5c",
  sourceOff: "#5b6fb8",
  sourceFatSecret: "#c87935",
  sourceAi: "#c4708a",

  slotBreakfast: "#c87935",
  slotBreakfastSoft: "rgba(200,121,53,0.12)",
  slotLunch: "#5d8a5c",
  slotLunchSoft: "rgba(93,138,92,0.12)",
  slotDinner: "#5b6fb8",
  slotDinnerSoft: "rgba(91,111,184,0.12)",
  slotSnack: "#0e8aa3",
  slotSnackSoft: "rgba(14,138,163,0.12)",

  ringBg: "#e6e1d6",
  ringTrack: "#4d8a5c",

  highlightWash: "#c8d4b8",
  highlightInk: "#14141a",

  destructive: "#b03a2e",
  success: "#5d8a5c",
  warning: "#c87935",

  chart1: "#5b6fb8",
  chart2: "#c87935",
  chart3: "#c4708a",
  chart4: "#5d8a5c",
  chart5: "#14141a",

  confidenceHigh: "#5d8a5c",
  confidenceMed: "#6f6a60",
  confidenceLow: "#a39d92",
  confidenceNeutral: "#6f6a60",

  // Font names: a future increment installs @expo-google-fonts/inter
  // + @expo-google-fonts/newsreader and wires `useFonts` in
  // app/_layout.tsx. Until that lands, RN falls back to system fonts
  // (San Francisco on iOS, Roboto on Android) which are close enough
  // not to visually break foundation testing.
  fontSans: "Inter",
  fontSerif: "Newsreader",
};

// ─────────────────────────────────────────────────────────────────────
// Dark mode palette — softened macros lifted for warm-black contrast
// ─────────────────────────────────────────────────────────────────────
export const TARE_DARK: TarePalette = {
  bg: "#0e0d0b",
  card: "#1a1815",
  secondary: "#14130f",
  muted: "#1a1815",
  surfacePeach: "#1d1410",
  surfacePeachInk: "#f6e4d6",

  border: "#2a2620",
  borderStrong: "rgba(246,243,238,0.08)",

  fg: "#ece6d8",
  fgSoft: "#c7c1b3",
  fgMute: "#8a857a",
  fgDim: "#5e5a51",
  fgFaint: "#3a352e",

  accent: "#e8e2d4",            // ink-on-dark = cream
  accentInk: "#14141a",
  accentStrong: "#ffffff",
  accentWash: "rgba(232,226,212,0.10)",

  accentWarm: "#d68a6a",
  accentWarmInk: "#1a1815",
  accentWarmWash: "rgba(214,138,106,0.12)",

  macroProtein: "#8696db",
  macroProteinSoft: "rgba(134,150,219,0.16)",
  macroCarbs: "#d69458",
  macroCarbsSoft: "rgba(214,148,88,0.16)",
  macroFat: "#d495a8",
  macroFatSoft: "rgba(212,149,168,0.16)",
  macroFiber: "#86a888",
  macroFiberSoft: "rgba(134,168,136,0.16)",
  macroCalories: "#80a890",
  macroWater: "#5cb4cb",

  sourceUsda: "#80a890",
  sourceOff: "#8696db",
  sourceFatSecret: "#d69458",
  sourceAi: "#d495a8",

  slotBreakfast: "#d69458",
  slotBreakfastSoft: "rgba(214,148,88,0.16)",
  slotLunch: "#86a888",
  slotLunchSoft: "rgba(134,168,136,0.16)",
  slotDinner: "#8696db",
  slotDinnerSoft: "rgba(134,150,219,0.16)",
  slotSnack: "#5cb4cb",
  slotSnackSoft: "rgba(92,180,203,0.16)",

  ringBg: "#2a2620",
  ringTrack: "#80a890",

  highlightWash: "#3a4e2f",
  highlightInk: "#ece6d8",

  destructive: "#d96a5b",
  success: "#86a888",
  warning: "#d69458",

  chart1: "#8696db",
  chart2: "#d69458",
  chart3: "#d495a8",
  chart4: "#86a888",
  chart5: "#e8e2d4",

  confidenceHigh: "#86a888",
  confidenceMed: "#a8a8a8",
  confidenceLow: "#6e6e6e",
  confidenceNeutral: "#a8a8a8",

  // Font names: a future increment installs @expo-google-fonts/inter
  // + @expo-google-fonts/newsreader and wires `useFonts` in
  // app/_layout.tsx. Until that lands, RN falls back to system fonts
  // (San Francisco on iOS, Roboto on Android) which are close enough
  // not to visually break foundation testing.
  fontSans: "Inter",
  fontSerif: "Newsreader",
};

/**
 * Pick the palette for the supplied mode. Pure function — call from
 * `useTarePalette()` (which combines this with the flag/override
 * resolution).
 */
export function getTarePalette(mode: TareMode): TarePalette {
  return mode === "dark" ? TARE_DARK : TARE_LIGHT;
}
