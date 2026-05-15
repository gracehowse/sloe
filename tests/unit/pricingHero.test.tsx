import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PricingHero } from "../../app/pricing/PricingHero.tsx";

/**
 * D13 (design-system sweep 2026-04-21) — /pricing gradient hero panel.
 *
 * These tests protect:
 *  1. The hero renders the prototype-aligned title ("The full meal
 *     planning loop"). The SUPPR pill was removed in premium-sweep-v2
 *     P0 row 3.3 (commit 139c874, 2026-05-14) as duplicate-of-top-bar-
 *     wordmark; the title remains the primary identifier.
 *  2. The brand gradient (fixed hex pair `#4c6ce0` → `#e04888`) is
 *     preserved on the hero background. Sync-enforcer-equivalent
 *     guard — the gradient must match the header wordmark and the
 *     mobile paywall banner.
 *  3. `app/pricing/page.tsx` renders the hero (not the retired flat
 *     "Everything you need to eat well" copy). Source-level check so
 *     we don't need to boot the full RSC for this assertion.
 */
describe("PricingHero (D13)", () => {
  it("renders the prototype title without the duplicate SUPPR pill", () => {
    const { container } = render(<PricingHero />);
    const text = container.textContent ?? "";
    expect(text).toContain("The full meal planning loop");
    // 2026-05-14 premium-sweep-v2 P0 row 3.3 — SUPPR pill removed
    // (duplicated the top-bar wordmark). Regression guard: don't let
    // a future copy refresh silently re-introduce it.
    expect(text).not.toContain("SUPPR");
  });

  it("keeps the fixed brand gradient on the hero background", () => {
    const { container } = render(<PricingHero />);
    const hero = container.firstElementChild as HTMLElement | null;
    expect(hero).not.toBeNull();
    const bg = hero?.style.backgroundImage ?? "";
    expect(bg).toContain("#4c6ce0");
    expect(bg).toContain("#e04888");
  });
});

describe("/pricing — D13 + M2 wiring", () => {
  const SRC = readFileSync(
    join(process.cwd(), "app/pricing/page.tsx"),
    "utf8",
  );

  it("renders <PricingHero /> and not the retired flat hero copy", () => {
    expect(SRC).toContain("<PricingHero />");
    expect(SRC).not.toContain("Everything you need to eat well");
  });

  it("uses design-system tokens rather than raw Tailwind slate classes", () => {
    // M2 — no raw slate-{50,900,950,200,800,400,300,600,700,500}
    // class in the file (dark: or otherwise). If a new slate-* class
    // sneaks in, this fails and forces a token swap.
    expect(SRC).not.toMatch(/\bbg-slate-/);
    // text-slate- is allowed nowhere on this page now.
    expect(SRC).not.toMatch(/\btext-slate-/);
    expect(SRC).not.toMatch(/\bborder-slate-/);
  });
});
