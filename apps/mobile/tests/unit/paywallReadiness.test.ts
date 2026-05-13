/**
 * paywallReadiness — pins the four IAP wiring states + their next-actions.
 *
 * Authority: ENG-101 + docs/operations/iap-launch-checklist.md.
 */

import { describe, expect, it } from "vitest";
import { classifyPaywallReadiness } from "../../lib/paywallReadiness";

describe("classifyPaywallReadiness", () => {
  it("returns ok when key present + non-empty offering + no error", () => {
    const out = classifyPaywallReadiness({
      hasApiKey: true,
      packages: [{}, {}],
      errored: false,
    });
    expect(out.ready).toBe(true);
    expect(out.reason).toBe("ok");
    expect(out.diagnostic).toContain("2 packages");
  });

  it("returns no-api-key when the env var is missing — even if packages array is somehow populated", () => {
    const out = classifyPaywallReadiness({
      hasApiKey: false,
      packages: [{}],
      errored: false,
    });
    expect(out.ready).toBe(false);
    expect(out.reason).toBe("no-api-key");
    expect(out.nextAction.toLowerCase()).toContain("eas secret");
  });

  it("returns empty-offering when key present but no packages", () => {
    const out = classifyPaywallReadiness({
      hasApiKey: true,
      packages: [],
      errored: false,
    });
    expect(out.ready).toBe(false);
    expect(out.reason).toBe("empty-offering");
    expect(out.nextAction.toLowerCase()).toContain("rc dashboard");
  });

  it("returns error when getOfferings threw — regardless of key/packages state", () => {
    const out = classifyPaywallReadiness({
      hasApiKey: true,
      packages: [{}],
      errored: true,
    });
    expect(out.ready).toBe(false);
    expect(out.reason).toBe("error");
    expect(out.diagnostic.toLowerCase()).toContain("getofferings");
  });

  it("singular package wording when count is 1", () => {
    const out = classifyPaywallReadiness({
      hasApiKey: true,
      packages: [{}],
    });
    expect(out.diagnostic).toContain("1 package.");
  });

  it("accepts a frozen empty array (no mutation)", () => {
    const frozen = Object.freeze([] as unknown[]);
    const out = classifyPaywallReadiness({
      hasApiKey: true,
      packages: frozen,
    });
    expect(out.reason).toBe("empty-offering");
  });
});
