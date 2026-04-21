/**
 * Household member accents — 2026-04-20 Claude Design prototype port.
 *
 * The prototype persona data carries a per-member `color` hex
 * (`docs/prototypes/2026-04-19-whole-app-experience/project/data.jsx`
 * lines 186–189) used for avatar chips, legend dots, and the member
 * pills in the compact HouseholdBar. Our production data model
 * (see `src/lib/household/householdClient.ts`) doesn't persist a
 * per-member colour, so we derive one deterministically by member
 * index here and share the helper across web + mobile so the palette
 * can never drift.
 *
 * Palette (prototype order, preserved verbatim):
 *   index 0 → #6c8cff (blue)   — Alex
 *   index 1 → #4cd080 (green)  — Sam
 *   index 2 → #ffc04c (amber)  — Mia
 *   index 3 → #ff7eb3 (pink)   — Leo
 *
 * Members beyond index 3 wrap through a four-extra palette derived
 * from the Suppr brand secondary tokens (cyan / orange / violet /
 * success-light) so up to 8-member households (our hard cap per
 * `householdClient.ts:MAX_MEMBERS`) still get a stable hue.
 *
 * The colour is NOT stored server-side. Using index-based assignment
 * keeps parity cheap: both platforms sort members by `joined_at ASC`
 * when reading (`getMyHousehold`), so a given member lands on the
 * same index on every client.
 */

const PRIMARY_PALETTE = [
  "#6c8cff", // blue (prototype Alex)
  "#4cd080", // green (prototype Sam)
  "#ffc04c", // amber (prototype Mia)
  "#ff7eb3", // pink  (prototype Leo)
] as const;

const EXTENDED_PALETTE = [
  "#06b6d4", // cyan     (Accent.cyan)
  "#f97316", // orange   (Accent.orange)
  "#8b5cf6", // violet   (StimulantColors.caffeine — reused as extra accent)
  "#22a860", // success  (Accent.success)
] as const;

/**
 * Colour for the member at a given (zero-based) index.
 * Members 0..3 use the prototype palette verbatim; 4..7 wrap through
 * the extended palette; >= 8 fall back to primary-palette cycling so
 * an over-cap household (shouldn't exist, belt+braces) still renders.
 */
export function householdMemberAccent(index: number): string {
  if (index < 0 || !Number.isFinite(index)) return PRIMARY_PALETTE[0];
  if (index < PRIMARY_PALETTE.length) return PRIMARY_PALETTE[index];
  const extIndex = index - PRIMARY_PALETTE.length;
  if (extIndex < EXTENDED_PALETTE.length) return EXTENDED_PALETTE[extIndex];
  // Defensive wrap — should never hit in production (8-member cap) but
  // avoids returning `undefined` if a caller passes a silly index.
  return PRIMARY_PALETTE[index % PRIMARY_PALETTE.length];
}

/**
 * 2-letter uppercase initials from a display name.
 * "Alex" → "AL", "Sam Taylor" → "ST", "" → "?" (never empty — a
 * chip with a blank avatar reads as a broken row, parity-pinned by
 * `tests/unit/householdMemberAccents.test.ts`).
 */
export function householdMemberInitials(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "?";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    // Single-word — take first two letters (or repeat if 1-char).
    const word = parts[0];
    return (word.slice(0, 2) || word).toUpperCase().padEnd(1, "").slice(0, 2) || "?";
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * First-name extract for the member pill label. "Sam Taylor" → "Sam",
 * "Alex" → "Alex", " Mia " → "Mia". Falls back to "Member" for an
 * empty string so the UI never renders a blank pill.
 */
export function householdMemberFirstName(name: string | null | undefined): string {
  const raw = (name ?? "").trim();
  if (!raw) return "Member";
  const first = raw.split(/\s+/)[0];
  return first || "Member";
}

export const __test__ = {
  PRIMARY_PALETTE,
  EXTENDED_PALETTE,
};
