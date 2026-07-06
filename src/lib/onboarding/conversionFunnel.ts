/** ENG-1233 / ENG-1241 — onboarding conversion funnel flag (web + mobile). */
export const CONVERSION_FUNNEL_FLAG = "onboarding_conversion_funnel_v1";

export const FIRST_LOG_CHIPS = [
  { id: "breakfast" as const, label: "Breakfast" },
  { id: "coffee" as const, label: "Coffee" },
  { id: "search" as const, label: "Search food" },
];

/**
 * ENG-1450 — `firstLogChoice` used to be write-only: captured on the
 * "One quick win" step, never read again, so Continue silently skipped
 * the promised first log. Shared by web (`web-flow.tsx`) and mobile
 * (`mobile-flow.tsx`) completion handlers: appends the existing
 * `?openLog=1` LogSheet deep-link to the post-onboarding querystring, with
 * Breakfast/Coffee pre-scoping the search via `openLogQuery` so the user
 * still picks a real, validated food match — never invented preset
 * nutrition. `skip`/`null` add nothing (straight to Today, as before).
 */
export function firstLogDeepLinkQs(
  firstLogChoice: "breakfast" | "coffee" | "search" | "skip" | null,
): string {
  if (firstLogChoice === "search") return "&openLog=1";
  if (firstLogChoice === "breakfast" || firstLogChoice === "coffee") {
    const label = firstLogChoice === "breakfast" ? "Breakfast" : "Coffee";
    return `&openLog=1&openLogQuery=${encodeURIComponent(label)}`;
  }
  return "";
}
