/**
 * Legal-approved copy for household sharing scope (F-16, 2026-04-25).
 *
 * These strings are reviewed verbatim by `legal-reviewer` and product-
 * lead (TestFlight feedback `AJ1AeYJ--fF`, 2026-04-19). Both the web
 * panel (`src/app/components/HouseholdPanel.tsx`) and the mobile card
 * (`apps/mobile/components/HouseholdCard.tsx`) MUST import from here
 * so the copy can't silently drift.
 *
 * Rewording ANY of these strings requires a new legal review. The
 * parity test in `tests/unit/householdJoinDisclosureCopy.test.ts` pins
 * verbatim equality.
 */

/**
 * Card-header microcopy. Rendered at the top of the household card
 * when the user does NOT yet belong to a household.
 */
export const HOUSEHOLD_CARD_HEADER_COPY =
  "Share dinner plans with your household. Members see each other's dinners (and lunches, if enabled) — never your breakfasts, snacks, calorie targets, or remaining-today numbers.";

/**
 * Join-flow disclosure. Rendered under the invite-code input the
 * moment the user is about to join someone else's household — before
 * they tap Join.
 */
export const HOUSEHOLD_JOIN_DISCLOSURE_COPY =
  "Joining shares your planned dinners with everyone in this household. If the household turns on lunch sharing, lunches are shared too. Breakfasts, snacks, your calorie and macro targets, and your remaining-today numbers all stay private.";

/**
 * One-time in-app notice shown on the first household-screen load
 * after the F-16 upgrade. Dismiss writes the flag keyed by
 * {@link SCOPE_NARROWING_NOTICE_KEY}.
 */
export const SCOPE_NARROWING_NOTICE_COPY =
  "We've tightened household sharing — targets and remaining-today are now private. Dinners only (plus lunches if your household enables it).";

/**
 * Storage key (AsyncStorage on mobile, localStorage on web) that
 * records whether the current user has seen and dismissed the
 * scope-narrowing notice. Versioned with `_v1` so a future narrowing
 * round can force a fresh notice without stepping on this one.
 */
export const SCOPE_NARROWING_NOTICE_KEY = "household_share_narrowing_seen_v1";

/**
 * Label + helper for the owner-only `share_lunch` toggle on the
 * household screen. Helper text deliberately tells members that
 * dinners are always shared, so the toggle reads as "extend" not
 * "opt out of dinners."
 */
export const SHARE_LUNCH_TOGGLE_LABEL = "Share lunches too";
export const SHARE_LUNCH_TOGGLE_HELPER =
  "Dinners are always shared. Lunches are off by default.";

/**
 * Per-member opt-in for exposing your own calorie and macro targets to
 * other household members (H4 security hardening, 2026-04-21). Default
 * OFF — a target reveals a diet context (cut / bulk / maintenance) that
 * is meaningfully personal, so we require explicit opt-in before it
 * leaves the owner's row.
 *
 * Label / helper are rendered on the mobile household-settings screen
 * and on the web HouseholdPanel for the caller's own row only.
 */
export const SHARE_TARGETS_TOGGLE_LABEL = "Share my nutrition targets with household";
export const SHARE_TARGETS_TOGGLE_HELPER =
  "When on, other household members can see your calorie and macro targets.";

/**
 * Placeholder rendered in place of target/remaining numbers on a
 * member row when that member has not opted into target sharing (or
 * when the API returned `targets: null`). Deliberately terse so the
 * row layout stays stable next to "Owner" / "Member".
 */
export const TARGETS_PRIVATE_LABEL = "Targets private";
