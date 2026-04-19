import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { tierFromStripePriceId, tierFromStripePriceIds } from "../../src/lib/stripe/tierFromPrice";

type EnvBackup = {
  baseMonthly: string | undefined;
  baseAnnual: string | undefined;
  proMonthly: string | undefined;
  proAnnual: string | undefined;
};

function snapshotEnv(): EnvBackup {
  return {
    baseMonthly: process.env.STRIPE_PRICE_BASE_MONTHLY,
    baseAnnual: process.env.STRIPE_PRICE_BASE_ANNUAL,
    proMonthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
    proAnnual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  };
}

function restoreEnv(prev: EnvBackup): void {
  process.env.STRIPE_PRICE_BASE_MONTHLY = prev.baseMonthly;
  process.env.STRIPE_PRICE_BASE_ANNUAL = prev.baseAnnual;
  process.env.STRIPE_PRICE_PRO_MONTHLY = prev.proMonthly;
  process.env.STRIPE_PRICE_PRO_ANNUAL = prev.proAnnual;
}

function setTestEnv(): void {
  process.env.STRIPE_PRICE_BASE_MONTHLY = "price_base_m_test";
  process.env.STRIPE_PRICE_BASE_ANNUAL = "price_base_a_test";
  process.env.STRIPE_PRICE_PRO_MONTHLY = "price_pro_m_test";
  process.env.STRIPE_PRICE_PRO_ANNUAL = "price_pro_a_test";
}

describe("tierFromStripePriceId", () => {
  let prev: EnvBackup;

  beforeEach(() => {
    prev = snapshotEnv();
    setTestEnv();
  });

  afterEach(() => {
    restoreEnv(prev);
  });

  it("maps pro monthly + annual to 'pro'", () => {
    expect(tierFromStripePriceId("price_pro_m_test")).toBe("pro");
    expect(tierFromStripePriceId("price_pro_a_test")).toBe("pro");
  });

  it("maps base monthly + annual to 'base'", () => {
    expect(tierFromStripePriceId("price_base_m_test")).toBe("base");
    expect(tierFromStripePriceId("price_base_a_test")).toBe("base");
  });

  it("returns null for unknown ids", () => {
    expect(tierFromStripePriceId("price_other")).toBeNull();
  });

  it("returns null when env var is unset", () => {
    delete process.env.STRIPE_PRICE_PRO_ANNUAL;
    expect(tierFromStripePriceId("price_pro_a_test")).toBeNull();
  });
});

describe("tierFromStripePriceIds", () => {
  let prev: EnvBackup;

  beforeEach(() => {
    prev = snapshotEnv();
    setTestEnv();
  });

  afterEach(() => {
    restoreEnv(prev);
  });

  it("prefers pro when multiple ids present", () => {
    expect(tierFromStripePriceIds(["price_base_m_test", "price_pro_m_test"])).toBe("pro");
  });

  it("prefers pro annual over base monthly", () => {
    expect(tierFromStripePriceIds(["price_base_m_test", "price_pro_a_test"])).toBe("pro");
  });

  it("resolves to base when only base ids present (mixed frequency)", () => {
    expect(tierFromStripePriceIds(["price_base_m_test", "price_base_a_test"])).toBe("base");
  });
});
