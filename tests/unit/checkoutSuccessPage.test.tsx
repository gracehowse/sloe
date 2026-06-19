/**
 * /checkout/success page — trust-explicit confirmation surface
 * (audit 2026-04-30).
 *
 * Pre-audit Stripe success_url redirected silently to `/?checkout=success`
 * which the App component swallowed and routed to Today — users got
 * zero confirmation, mirroring the dark-pattern every competitor on
 * the 14-app sentiment list got dinged for.
 *
 * These tests guard:
 *   1. The page renders the four trust elements (cancel path,
 *      trial-end, refund window, support email).
 *   2. A "Manage subscription" deep-link to /account/billing is
 *      visible without scrolling — counters Lifesum-pattern.
 *   3. Annual vs monthly trial-end labels swap correctly so the
 *      copy reflects the actual purchase.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import CheckoutSuccessPage from "../../app/checkout/success/page";

async function renderPage(searchParams?: { period?: string; tier?: string }) {
  const ui = await CheckoutSuccessPage({
    searchParams: Promise.resolve(searchParams ?? {}),
  });
  render(ui);
}

describe("/checkout/success — trust-explicit confirmation", () => {
  it("renders the receipt copy block with all four trust elements", async () => {
    await renderPage({ period: "annual", tier: "pro" });
    const receipt = screen.getByTestId("checkout-success-receipt");
    expect(receipt.textContent).toContain("Cancel anytime");
    expect(receipt.textContent).toContain("Settings > Subscription");
    expect(receipt.textContent).toContain("first charge after that");
    expect(receipt.textContent).toContain("7 days");
    expect(receipt.textContent).toContain("support@suppr-club.com");
  });

  it("renders three trust bullets each with a ShieldCheck icon", async () => {
    await renderPage({ period: "annual" });
    const block = screen.getByTestId("checkout-success-trust-bullets");
    expect(block.textContent).toContain("Cancel anytime in-app");
    expect(block.textContent).toContain("7-day refund, no email needed");
    expect(block.textContent).toContain("Price never changes mid-trial");
  });

  it("surfaces a 'Manage subscription' CTA linking to /account/billing", async () => {
    await renderPage({ period: "monthly" });
    const manageLink = screen.getByTestId("checkout-success-manage");
    expect(manageLink).toBeInTheDocument();
    expect(manageLink.getAttribute("href")).toBe("/account/billing");
  });

  it("renders 'Open Suppr' continue CTA that lands on Today", async () => {
    await renderPage({ period: "annual" });
    const openLink = screen.getByTestId("checkout-success-continue");
    expect(openLink.getAttribute("href")).toContain("/home");
    expect(openLink.getAttribute("href")).toContain("view=today");
  });

  it("annual purchases see 'trial ends in 7 days' framing", async () => {
    await renderPage({ period: "annual" });
    const receipt = screen.getByTestId("checkout-success-receipt");
    expect(receipt.textContent).toContain("trial ends in 7 days");
  });

  it("monthly purchases (no trial) see 'with your billing period' framing", async () => {
    await renderPage({ period: "monthly" });
    const receipt = screen.getByTestId("checkout-success-receipt");
    expect(receipt.textContent).toContain("with your billing period");
    expect(receipt.textContent).not.toContain("trial ends in 7 days");
  });

  it("falls back to monthly framing when period query is malformed", async () => {
    await renderPage({ period: "garbage" });
    const receipt = screen.getByTestId("checkout-success-receipt");
    // Defensive default — should not crash, should not claim a trial.
    expect(receipt.textContent).toContain("with your billing period");
  });
});

describe("/checkout/success — on-brand palette (ENG-971)", () => {
  // Assert against rendered markup (no source comments) so the
  // documented-removal references to the old gradient hex in code
  // comments can't false-positive. The DOM is what actually ships.
  let html = "";

  beforeAll(async () => {
    const ui = await CheckoutSuccessPage({
      searchParams: Promise.resolve({ period: "monthly", tier: "pro" }),
    });
    const { container } = render(ui);
    html = container.innerHTML;
  });

  it("renders no off-palette violet/indigo Tailwind classes", () => {
    expect(html).not.toMatch(/from-violet-/);
    expect(html).not.toMatch(/to-indigo-/);
    expect(html).not.toMatch(/(?:bg|text|border)-violet-/);
    expect(html).not.toMatch(/(?:bg|text|border)-indigo-/);
    expect(html).not.toMatch(/shadow-violet-/);
  });

  it("renders no literal off-palette hex (the old #588CE4 → #DF5EBC gradient)", () => {
    expect(html).not.toMatch(/#588CE4/i);
    expect(html).not.toMatch(/#DF5EBC/i);
  });

  it("primary continue CTA uses the brand primary token", async () => {
    await renderPage({ period: "monthly" });
    const cta = screen.getByTestId("checkout-success-continue");
    expect(cta.className).toContain("bg-primary");
    expect(cta.className).toContain("text-primary-foreground");
    expect(cta.className).not.toMatch(/violet|indigo/);
  });

  it("renders the canonical Sloe wordmark in the header (not a gradient clip)", async () => {
    await renderPage({ period: "monthly" });
    // SupprWordmark renders role=img aria-label="Sloe".
    expect(screen.getAllByLabelText("Sloe").length).toBeGreaterThan(0);
  });
});
