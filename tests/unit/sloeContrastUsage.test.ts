/**
 * Sloe contrast — CALL-SITE guard (web + mobile parity).
 *
 * `sloeContrastTokens.test.ts` proves the TOKEN VALUES clear AA. This proves
 * the COMPONENTS actually use them — i.e. that the flagged Today/Burn surfaces
 * stopped using the fill hues (`text-primary` clay, `text-activity` honey,
 * white-on-clay) as small text on light. Static source grep, same convention
 * as `cookModeContrast.test.ts` / `paywallDarkContrast.test.ts`.
 *
 * ⚠️ `describe.skip` — this is the ACCEPTANCE GATE for the component swaps,
 * which land in Cursor's lane (src/app + apps/mobile). Per the split for this
 * fix I (tokens + tests + Linear) provide the gate; Cursor applies the swaps,
 * then flips `.skip` → live and confirms green. Tracked in the Linear ticket.
 * Until then it stays skipped so `npm test` / `npm run ci` stay green.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (rel: string) =>
  readFileSync(resolve(__dirname, "../../", rel), "utf8");

describe("Sloe contrast — call sites use the AA-safe tokens", () => {
  // ── Card headings: clay `text-primary` → plum `text-foreground-brand`
  //    (matches mobile MacroColors.calories + the prototype `text-plum`).
  it("web card titles use the plum heading ink, not clay text-primary", () => {
    const steps = read("src/app/components/suppr/today-steps-card.tsx");
    expect(steps).toMatch(/text-foreground-brand/);
    expect(steps).not.toMatch(/text-primary["\s]/);

    const hydration = read(
      "src/app/components/suppr/hydration-stimulants-card.tsx",
    );
    // both "Hydration" + "Stimulants" h3s
    expect(hydration.match(/text-foreground-brand/g)?.length).toBeGreaterThanOrEqual(2);

    const planned = read(
      "src/app/components/suppr/today-planned-meals-card.tsx",
    );
    expect(planned).toMatch(/text-foreground-brand/);
  });

  // ── Clay LINKS/toggles → `text-primary-solid`; white-on-clay → `bg-primary-solid`
  it("web clay links + buttons use the -solid variant", () => {
    const hero = read("src/app/components/suppr/today-hero-ring.tsx");
    expect(hero).toMatch(/text-primary-solid/);

    const northStar = read("src/app/components/suppr/north-star-block.tsx");
    expect(northStar).toMatch(/text-primary-solid/); // overline / CTA / Browse / library-empty sparkle
    // ENG-1198: the white-on-clay "Open Library →" button was removed when the
    // library-empty branch was brought into parity with mobile's flattened
    // quiet-fill chevron-row (no solid-fill CTA on that branch anymore). The clay
    // affordance there is now the text-primary-solid sparkle, covered above.
    // No remaining white-on-clay surface in this file → no bg-primary-solid to
    // guard. The -solid link/toggle invariant still holds via the assertion above.

    const planned = read(
      "src/app/components/suppr/today-planned-meals-card.tsx",
    );
    expect(planned).toMatch(/text-primary-solid/); // "Log today"
  });

  // ── Activity honey text → `text-activity-solid` (icons keep base honey)
  it("web activity TEXT uses activity-solid, not the honey fill", () => {
    const burn = read("src/app/components/BurnDetailPanel.tsx");
    expect(burn).toMatch(/text-activity-solid/);
    expect(burn).not.toMatch(/text-activity["\s][^-]/); // no bare text-activity

    const bonus = read(
      "src/app/components/suppr/today-activity-bonus-card.tsx",
    );
    expect(bonus).toMatch(/text-activity-solid|--activity-solid/);
  });

  // ── Net-energy chip uses the AA-safe solid bg; progressbar has a name
  it("web net-energy chip uses NET_ENERGY_CHIP_BG + the bar is labelled", () => {
    const bonus = read(
      "src/app/components/suppr/today-activity-bonus-card.tsx",
    );
    expect(bonus).toMatch(/NET_ENERGY_CHIP_BG/);
    expect(bonus).toMatch(/role="progressbar"[\s\S]{0,200}aria-label=/);
  });

  // ── Hydration over-limit copy uses warning-solid (amber fill fails as text)
  it("web hydration over-target copy uses warning-solid", () => {
    const hydration = read(
      "src/app/components/suppr/hydration-stimulants-card.tsx",
    );
    expect(hydration).toMatch(/--warning-solid|warning-solid/);
  });

  // ── MOBILE parity: activity TEXT → Accent.activitySolid; chip → NET_ENERGY_CHIP_BG
  it("mobile activity TEXT + chip use the AA-safe tokens", () => {
    const mBurn = read("apps/mobile/app/burn-detail.tsx");
    expect(mBurn).toMatch(/Accent\.activitySolid/);

    const mBonus = read(
      "apps/mobile/components/today/TodayActivityBonusCard.tsx",
    );
    expect(mBonus).toMatch(/Accent\.activitySolid/);
    expect(mBonus).toMatch(/NET_ENERGY_CHIP_BG/);
  });
});
