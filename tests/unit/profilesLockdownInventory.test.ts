/**
 * P0-4 (2026-04-25) — meta-test pinning the contract that any new
 * billing/entitlement column added to `public.profiles` is also added to
 * the `profiles_tier_column_lockdown` trigger function.
 *
 * The trigger lives in `supabase/migrations/20260503100000_profiles_tier_column_lockdown.sql`
 * (initial guard for `user_tier` + `stripe_customer_id`) and is re-stated
 * with the forward-compat fallback in
 * `supabase/migrations/20260503102000_profiles_lockdown_forward_compat.sql`.
 *
 * This test scans every migration that touches `public.profiles` and
 * asserts that any ADD COLUMN with a name matching the forward-banned
 * pattern set is followed (in time order) by an explicit guard branch
 * for that column in a lockdown migration. Until the explicit branch
 * lands, the jsonb runtime fallback in 20260503102000 is the safety net.
 *
 * Patterns we consider billing-sensitive (must be locked down):
 *   - `user_tier`, `stripe_customer_id` (already explicit)
 *   - `subscription_*`
 *   - `trial_*`
 *   - `billing_*`
 *   - `paid_through_*`
 *   - `entitlement_*`, `plan_id`
 *
 * Policy reference: `docs/decisions/2026-04-25-profiles-lockdown-forward-compat.md`.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");
const LOCKDOWN_FILES = [
  "20260503100000_profiles_tier_column_lockdown.sql",
  "20260503102000_profiles_lockdown_forward_compat.sql",
];

const BILLING_PATTERN =
  /^(user_tier|stripe_customer_id|subscription_.+|trial_.+|billing_.+|paid_through_.+|entitlement_.+|plan_id)$/;

const PROFILES_ADD_COLUMN_RE =
  /alter\s+table\s+(public\.)?profiles[\s\S]*?add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gim;

describe("profiles billing-column lockdown contract", () => {
  it("all forward-banned column names listed in 20260503102000 are unique strings", () => {
    const file = readFileSync(
      resolve(MIGRATIONS_DIR, "20260503102000_profiles_lockdown_forward_compat.sql"),
      "utf8",
    );
    // Sanity: the array literal must be present.
    expect(file).toMatch(/forward_banned\s+text\[\]\s*:=\s*array\s*\[/);
    expect(file).toMatch(/'subscription_status'/);
    expect(file).toMatch(/'trial_started_at'/);
    expect(file).toMatch(/'trial_ends_at'/);
    expect(file).toMatch(/'trial_days_given'/);
  });

  it("every billing-sensitive column added to public.profiles has a lockdown guard", () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    const billingColumnsAdded: { col: string; migration: string }[] = [];
    for (const f of files) {
      const text = readFileSync(resolve(MIGRATIONS_DIR, f), "utf8");
      // Skip the lockdown migrations themselves (they don't add columns).
      if (LOCKDOWN_FILES.includes(f)) continue;
      let m: RegExpExecArray | null;
      const re = new RegExp(PROFILES_ADD_COLUMN_RE.source, PROFILES_ADD_COLUMN_RE.flags);
      while ((m = re.exec(text)) !== null) {
        const col = m[2]!.toLowerCase();
        if (BILLING_PATTERN.test(col)) {
          billingColumnsAdded.push({ col, migration: f });
        }
      }
    }

    // Read the combined lockdown source — explicit guards (`new.<col> is
    // distinct from old.<col>`) and the forward_banned array literal.
    const lockdownText = LOCKDOWN_FILES.map((f) =>
      readFileSync(resolve(MIGRATIONS_DIR, f), "utf8"),
    ).join("\n");

    const unguarded: { col: string; migration: string }[] = [];
    for (const { col, migration } of billingColumnsAdded) {
      const explicitGuard = new RegExp(
        `new\\.${col}\\s+is\\s+distinct\\s+from\\s+old\\.${col}`,
        "i",
      );
      const forwardBannedListed = new RegExp(`'${col}'`);
      if (!explicitGuard.test(lockdownText) && !forwardBannedListed.test(lockdownText)) {
        unguarded.push({ col, migration });
      }
    }

    if (unguarded.length > 0) {
      const detail = unguarded
        .map(({ col, migration }) => `  - ${col} (added in ${migration})`)
        .join("\n");
      throw new Error(
        `Found billing-sensitive profiles columns without an explicit lockdown guard or forward_banned listing:\n${detail}\n\nFix: add an explicit guard branch in supabase/migrations/20260503102000_profiles_lockdown_forward_compat.sql (or a fresher lockdown migration) before this column ships.`,
      );
    }

    // No-op assertion to record what we surveyed (for visibility on green runs).
    expect(unguarded).toEqual([]);
  });
});
