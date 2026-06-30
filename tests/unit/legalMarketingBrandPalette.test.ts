import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ENG-1219 — the web legal / marketing pages used to paint their links,
 * filled CTAs, FAB, badge, focus-rings, and hovers with the off-brand
 * Tailwind `violet-*` palette instead of the Sloe plum brand token
 * (`text-primary` / `bg-primary` / `--primary`). Violet is wrong; plum is
 * the brand. This sweep migrates every occurrence onto the semantic
 * `primary` token family (the same token sibling legal/product pages like
 * `app/checkout/success/page.tsx` and `app/recipe/[id]/page.tsx` already
 * use). Source-assertion style so the migration can't silently regress to
 * `violet-`.
 */
const read = (rel: string) => readFileSync(resolve(__dirname, "../..", rel), "utf8");

/** Strip `//` line + block comments so the negative literal-assertion tests
 *  the actual CODE, not a doc-comment that legitimately names the old
 *  violet treatment it replaced. */
function codeOnly(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Every web legal / marketing surface in the ENG-1219 scope. */
const SCOPED_FILES = [
  "app/dmca/page.tsx",
  "app/dmca/_form/DmcaTakedownForm.tsx",
  "app/help/HelpClient.tsx",
  "app/licences/page.tsx",
  "app/privacy/page.tsx",
  "app/terms/page.tsx",
  "app/whats-new/page.tsx",
  "app/account/billing/BillingUnavailableFallback.tsx",
] as const;

describe("ENG-1219 — legal/marketing pages use the plum brand token, not violet", () => {
  for (const rel of SCOPED_FILES) {
    it(`${rel} has no off-brand violet-* palette literal`, () => {
      const code = codeOnly(read(rel));
      expect(code).not.toMatch(/violet-\d/);
      expect(code).not.toMatch(/violet-/);
    });
  }

  it("text links + CTAs route through the primary brand token", () => {
    // Spot-check the load-bearing swaps so a future edit that drops the
    // token (e.g. reverting to a literal hex) breaks here.
    // ENG-1273 (2026-06-29): the on-card billing links route through the
    // AA-safe `text-primary-solid` ink — bare `text-primary` (the OLED-lifted
    // #7E5C92 fill) reads only ~3.5:1 on the dark page (AA FAIL). Still a
    // primary-brand token (the guard's real intent: not violet, not a hex).
    const billing = read("app/account/billing/BillingUnavailableFallback.tsx");
    expect(billing).toMatch(/text-primary-solid underline underline-offset-2/);

    const dmcaForm = read("app/dmca/_form/DmcaTakedownForm.tsx");
    expect(dmcaForm).toMatch(/bg-primary text-primary-foreground/);

    const help = read("app/help/HelpClient.tsx");
    // Sticky contact FAB — filled brand pill.
    expect(help).toMatch(/bg-primary text-primary-foreground hover:brightness-95/);
    // Search focus-ring.
    expect(help).toMatch(/focus:ring-2 focus:ring-primary/);
    // FAB shadow re-tinted to the brand.
    expect(help).toMatch(/shadow-primary\/30/);
  });

  it("whats-new Latest badge uses the soft-tint sibling pattern with the AA-safe -solid ink", () => {
    // bg-primary/10 + text-primary fails AA in dark mode (3.23:1 on the
    // #120D18 ground); text-primary-solid clears it (8.57:1 dark /
    // 10.79:1 light) — matching the bg-primary/10 + text-primary-solid
    // chip pattern used across CookMode/FastingTimer/Library/MealPlanner.
    const whatsNew = read("app/whats-new/page.tsx");
    expect(whatsNew).toMatch(/bg-primary\/10 text-primary-solid border border-primary\/20/);
  });
});
