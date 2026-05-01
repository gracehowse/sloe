/**
 * Honeydew parity (2026-04-30) — mobile + web shopping shared scope.
 *
 * The shopping list is the single biggest competitive gap vs Honeydew
 * flagged in the 2026-04-30 audit. The fix turns `shopping_items`
 * into a household-scoped relation; both platforms must read/write
 * through the same scope helper so a regression on one mirrors on
 * the other.
 *
 * This is a source-level structural test (no Supabase, no React) that
 * pins the import + call shape on both platforms:
 *
 *   - `apps/mobile/app/shopping.tsx` imports from
 *     `src/lib/household/shoppingScope.ts` (NOT a duplicate scope helper).
 *   - `src/context/appData/useShoppingListState.ts` imports from the
 *     same module.
 *   - Both files reference `shoppingScopeRealtimeFilter` so neither
 *     accidentally goes back to the legacy "user_id only" filter.
 *   - Both files render the "shared with" / banner / attribution chip
 *     surface that the audit demanded — discoverable via stable
 *     identifiers (`testID="shopping-household-banner"` on mobile,
 *     `data-testid="shopping-household-banner"` on web).
 *
 * If this test starts failing because someone forked scope rules into
 * a platform-specific helper — DON'T fix the test by relaxing it,
 * consolidate the duplication first.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_SHOPPING = resolve(__dirname, "../../app/shopping.tsx");
const MOBILE_PLANNER = resolve(__dirname, "../../app/(tabs)/planner.tsx");
const WEB_HOOK = resolve(
  __dirname,
  "../../../../src/context/appData/useShoppingListState.ts",
);
const WEB_LIST = resolve(
  __dirname,
  "../../../../src/app/components/ShoppingList.tsx",
);

describe("shopping list household scope — cross-platform parity", () => {
  it("mobile shopping screen imports the shared scope helper", () => {
    const sql = readFileSync(MOBILE_SHOPPING, "utf8");
    expect(sql).toMatch(
      /from\s+["'][^"']*src\/lib\/household\/shoppingScope/,
    );
    expect(sql).toMatch(/shoppingScopeFor/);
    expect(sql).toMatch(/shoppingScopeRealtimeFilter/);
  });

  it("mobile planner imports the shared scope helper for generation", () => {
    const sql = readFileSync(MOBILE_PLANNER, "utf8");
    expect(sql).toMatch(
      /from\s+["'][^"']*src\/lib\/household\/shoppingScope/,
    );
    expect(sql).toMatch(/shoppingScopeInsertStamp/);
  });

  it("web `useShoppingListState` imports the shared scope helper", () => {
    const sql = readFileSync(WEB_HOOK, "utf8");
    expect(sql).toMatch(/from\s+["'][^"']*household\/shoppingScope/);
    expect(sql).toMatch(/shoppingScopeFor/);
    expect(sql).toMatch(/shoppingScopeRealtimeFilter/);
  });

  it("mobile shopping renders the household banner with stable testID", () => {
    const sql = readFileSync(MOBILE_SHOPPING, "utf8");
    expect(sql).toMatch(/testID="shopping-household-banner"/);
    // The "Synced live" copy is the user-facing real-time hint.
    expect(sql).toMatch(/Synced live/);
  });

  it("web shopping renders the household banner with stable data-testid", () => {
    const sql = readFileSync(WEB_LIST, "utf8");
    expect(sql).toMatch(/data-testid="shopping-household-banner"/);
    expect(sql).toMatch(/Synced live/);
  });

  it("mobile shopping renders the per-row attribution chip", () => {
    const sql = readFileSync(MOBILE_SHOPPING, "utf8");
    expect(sql).toMatch(/shopping-attribution-/);
    expect(sql).toMatch(/householdMemberInitials/);
    expect(sql).toMatch(/householdMemberAccent/);
  });

  it("web shopping renders the per-row attribution chip", () => {
    const sql = readFileSync(WEB_LIST, "utf8");
    expect(sql).toMatch(/shopping-attribution-/);
    expect(sql).toMatch(/householdMemberInitials/);
    expect(sql).toMatch(/householdMemberAccent/);
  });

  it("mobile shopping subscribes to supabase real-time on shopping_items", () => {
    const sql = readFileSync(MOBILE_SHOPPING, "utf8");
    expect(sql).toMatch(/supabase\s*\.\s*channel/);
    expect(sql).toMatch(/postgres_changes/);
    expect(sql).toMatch(/table:\s*"shopping_items"/);
  });

  it("web `useShoppingListState` subscribes to supabase real-time on shopping_items", () => {
    const sql = readFileSync(WEB_HOOK, "utf8");
    expect(sql).toMatch(/supabase\s*\.\s*channel/);
    expect(sql).toMatch(/postgres_changes/);
    expect(sql).toMatch(/table:\s*"shopping_items"/);
  });
});
