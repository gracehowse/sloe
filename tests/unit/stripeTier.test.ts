import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { tierFromStripePriceId, tierFromStripePriceIds } from "../../src/lib/stripe/tierFromPrice";

describe("tierFromStripePriceId", () => {
  const prev = { base: process.env.STRIPE_PRICE_BASE_MONTHLY, pro: process.env.STRIPE_PRICE_PRO_MONTHLY };

  beforeEach(() => {
    process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
  });

  afterEach(() => {
    process.env.STRIPE_PRICE_BASE_MONTHLY = prev.base;
    process.env.STRIPE_PRICE_PRO_MONTHLY = prev.pro;
  });

  it("maps pro before base when both envs match", () => {
    expect(tierFromStripePriceId("price_pro_test")).toBe("pro");
    expect(tierFromStripePriceId("price_base_test")).toBe("base");
  });

  it("returns null for unknown ids", () => {
    expect(tierFromStripePriceId("price_other")).toBeNull();
  });
});

describe("tierFromStripePriceIds", () => {
  const prev = { base: process.env.STRIPE_PRICE_BASE_MONTHLY, pro: process.env.STRIPE_PRICE_PRO_MONTHLY };

  beforeEach(() => {
    process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_test";
    process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_test";
  });

  afterEach(() => {
    process.env.STRIPE_PRICE_BASE_MONTHLY = prev.base;
    process.env.STRIPE_PRICE_PRO_MONTHLY = prev.pro;
  });

  it("prefers pro when multiple ids present", () => {
    expect(tierFromStripePriceIds(["price_base_test", "price_pro_test"])).toBe("pro");
  });
});
