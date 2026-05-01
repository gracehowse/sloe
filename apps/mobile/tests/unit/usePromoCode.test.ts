/**
 * Shared promo-code hook logic (D9 M1, 2026-04-21).
 *
 * Covers the pure helpers extracted from `settings.tsx` into
 * `apps/mobile/hooks/usePromoCode.ts`:
 *   - `normalizeRedeemPromoRpcData` — PostgREST jsonb normalisation
 *   - `messageForPromoError` — mapping RPC error codes to copy
 *   - `normalizeUserTier` — tier string coercion
 *
 * Plus source-level assertions that the paywall + settings are wired
 * to the shared module. The full React hook isn't mounted here (same
 * rationale as `paywallCopyParity.test.ts`: the paywall + settings
 * trees pull react-native-purchases / expo-router and aren't viable
 * under vitest).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  normalizeRedeemPromoRpcData,
  messageForPromoError,
  normalizeUserTier,
} from "@/hooks/usePromoCode";

describe("normalizeRedeemPromoRpcData", () => {
  it("handles a plain object", () => {
    expect(normalizeRedeemPromoRpcData({ ok: true, tier: "pro" })).toEqual({
      ok: true,
      tier: "pro",
      error: undefined,
    });
  });

  it("handles a single-element array wrapper (PostgREST quirk)", () => {
    expect(
      normalizeRedeemPromoRpcData([{ ok: true, tier: "base" }]),
    ).toEqual({ ok: true, tier: "base", error: undefined });
  });

  it("handles a JSON string payload", () => {
    expect(
      normalizeRedeemPromoRpcData('{"ok":true,"tier":"pro"}'),
    ).toEqual({ ok: true, tier: "pro", error: undefined });
  });

  it("handles the double-encoded string edge case", () => {
    expect(
      normalizeRedeemPromoRpcData('"{\\"ok\\":false,\\"error\\":\\"invalid_or_expired\\"}"'),
    ).toEqual({ ok: false, tier: undefined, error: "invalid_or_expired" });
  });

  it("coerces string 'true' to boolean true", () => {
    expect(normalizeRedeemPromoRpcData({ ok: "true", tier: "pro" })).toEqual({
      ok: true,
      tier: "pro",
      error: undefined,
    });
  });

  it("returns null on non-object input", () => {
    expect(normalizeRedeemPromoRpcData(null)).toBeNull();
    expect(normalizeRedeemPromoRpcData(42)).toBeNull();
  });

  it("returns null on invalid JSON string", () => {
    expect(normalizeRedeemPromoRpcData("{not json")).toBeNull();
  });

  it("surfaces the error branch", () => {
    expect(
      normalizeRedeemPromoRpcData({ ok: false, error: "not_authenticated" }),
    ).toEqual({ ok: false, tier: undefined, error: "not_authenticated" });
  });
});

describe("messageForPromoError", () => {
  it("maps known error codes to user-facing copy", () => {
    expect(messageForPromoError("invalid_or_expired")).toMatch(/not valid/i);
    expect(messageForPromoError("not_authenticated")).toMatch(/sign in/i);
    expect(messageForPromoError("invalid_code")).toMatch(/enter a promo code/i);
  });

  it("falls back on unknown / undefined codes", () => {
    expect(messageForPromoError(undefined)).toMatch(/could not be applied/i);
    expect(messageForPromoError("something_else")).toMatch(/could not be applied/i);
  });
});

describe("normalizeUserTier", () => {
  it("accepts the three canonical tier strings", () => {
    expect(normalizeUserTier("pro")).toBe("pro");
    expect(normalizeUserTier("base")).toBe("base");
    expect(normalizeUserTier("free")).toBe("free");
  });

  it("lowercases + trims before matching", () => {
    expect(normalizeUserTier("  PRO ")).toBe("pro");
    expect(normalizeUserTier("Base")).toBe("base");
  });

  it("defaults unknown / null / undefined to free", () => {
    expect(normalizeUserTier(null)).toBe("free");
    expect(normalizeUserTier(undefined)).toBe("free");
    expect(normalizeUserTier("garbage")).toBe("free");
  });
});

describe("paywall promo expander — source-level wiring", () => {
  const PAYWALL_PATH = resolve(__dirname, "../../app/paywall.tsx");
  const src = readFileSync(PAYWALL_PATH, "utf8");

  it("imports the shared usePromoCode hook", () => {
    expect(src).toMatch(/from\s+"@\/hooks\/usePromoCode"/);
    expect(src).toContain("usePromoCode");
  });

  it("renders the collapsed trigger by default", () => {
    expect(src).toContain("Have a promo code?");
    expect(src).toContain('testID="paywall-promo-trigger"');
    // Default promoExpanded state is false.
    expect(src).toMatch(/setPromoExpanded\][\s\S]*useState\(false\)/);
  });

  it("exposes TextInput + Apply button when expanded", () => {
    expect(src).toContain('testID="paywall-promo-input"');
    expect(src).toContain('testID="paywall-promo-apply"');
    expect(src).toContain('"e.g. SUPPR_TEST_PREMIUM"');
    expect(src).toContain('autoCapitalize="characters"');
  });

  it("closes the paywall on successful redemption (D9 OD2)", () => {
    // Successful redeem() returns `{ ok: true, ... }` → call onClose.
    expect(src).toMatch(/if\s*\(result\.ok\)\s*\{[\s\S]{0,300}onClose\(\)/);
  });
});

describe("settings consumes the shared hook", () => {
  // 2026-05-01 (`claude/settings-mobile-structural-fix` P0-1): the
  // promo-code redemption UI migrated from the legacy in-file
  // `/(tabs)/settings.tsx` Plan section into
  // `<SettingsBundleContent>` Membership card. The bundle is now the
  // canonical consumer of the hook.
  const BUNDLE_PATH = resolve(
    __dirname,
    "../../components/settings/SettingsBundleContent.tsx",
  );
  const src = readFileSync(BUNDLE_PATH, "utf8");

  it("imports usePromoCode from the shared module", () => {
    expect(src).toMatch(/from\s+"@\/hooks\/usePromoCode"/);
    expect(src).toContain("usePromoCode");
  });

  it("no longer defines local promo helpers (moved to the hook)", () => {
    expect(src).not.toMatch(/function normalizeRedeemPromoRpcData\(/);
    expect(src).not.toMatch(/function messageForPromoError\(/);
  });
});
