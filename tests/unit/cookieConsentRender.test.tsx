/**
 * Render tests for the cookie-consent strip chrome (P5 parity gap #31).
 *
 * The banner is a pre-consent surface: it must paint on first paint with NO
 * feature flag gate. These tests pin the redesign-token retoken (bg-card /
 * border-border / muted text + the --elev-sheet depth token + the quiet
 * SupprPlateMark) so a regression back to raw slate chrome breaks the build.
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

// `next/navigation` — CookieConsent reads usePathname only (to lift above the
// product FAB on Today/Plan/Shopping). Default to a marketing route so the
// strip sits at bottom-0.
const mockPathname = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

import { CookieConsent } from "@/app/components/CookieConsent";

beforeEach(() => {
  localStorage.clear();
  mockPathname.mockReturnValue("/");
});

afterEach(() => {
  cleanup();
});

async function renderBanner() {
  const utils = render(<CookieConsent />);
  // visible is set in a useEffect after mount when no consent is stored.
  await waitFor(() => expect(screen.getByText(/Essential cookies on/)).toBeTruthy());
  return utils;
}

describe("CookieConsent — chrome tokens (gap #31)", () => {
  it("renders the strip when no consent has been stored", async () => {
    await renderBanner();
    expect(screen.getByText("Essential only")).toBeTruthy();
    expect(screen.getByText("Accept all")).toBeTruthy();
  });

  it("uses redesign surface tokens, not raw slate, on the container", async () => {
    const { container } = await renderBanner();
    const strip = container.querySelector("div.fixed") as HTMLElement;
    expect(strip).toBeTruthy();
    const cls = strip.className;
    // Retokened surface.
    expect(cls).toContain("bg-card/95");
    expect(cls).toContain("border-border");
    expect(cls).toContain("shadow-[var(--elev-sheet)]");
    // Old raw-slate chrome must be gone.
    expect(cls).not.toContain("bg-white/95");
    expect(cls).not.toContain("dark:bg-slate-900/95");
    expect(cls).not.toContain("border-slate-200");
    expect(cls).not.toContain("shadow-lg");
  });

  it("body copy uses muted-foreground (not slate) and stays single-line", async () => {
    await renderBanner();
    const body = screen.getByText(/Essential cookies on/).closest("p") as HTMLElement;
    expect(body).toBeTruthy();
    expect(body.className).toContain("text-muted-foreground");
    expect(body.className).toContain("line-clamp-1");
    expect(body.className).not.toContain("text-slate-700");
  });

  it("decline button uses the muted token, Accept keeps primary (equal prominence)", async () => {
    await renderBanner();
    const decline = screen.getByText("Essential only");
    const accept = screen.getByText("Accept all");
    expect(decline.className).toContain("bg-muted");
    expect(decline.className).toContain("text-muted-foreground");
    expect(decline.className).not.toContain("bg-slate-100");
    expect(accept.className).toContain("bg-primary");
    expect(accept.className).toContain("text-primary-foreground");
    // Equal-prominence: both share the same size/shape utilities, only fill differs.
    for (const u of ["px-2.5", "py-1", "text-xs", "font-medium", "rounded-md"]) {
      expect(decline.className).toContain(u);
      expect(accept.className).toContain(u);
    }
  });

  it("renders the quiet brand mark pre-consent without evaluating the brandmark flag", async () => {
    const { container } = await renderBanner();
    const mark = container.querySelector('[data-slot="sloe-mark"]');
    expect(mark).toBeTruthy();
  });

  it("does not render once a consent choice is stored", () => {
    localStorage.setItem("suppr_cookie_consent", "accepted");
    const { container } = render(<CookieConsent />);
    expect(container.querySelector("div.fixed")).toBeNull();
  });
});
