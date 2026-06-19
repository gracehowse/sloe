/**
 * ENG-1035 / launch-readiness audit P0-1 — static contract tests for the
 * BEFORE INSERT tier-lockdown guard.
 *
 * These pin the migration SQL so a future edit can't silently re-open the
 * DELETE-then-INSERT escalation. They are deliberately migration-text
 * assertions (the same approach as profilesLockdownInventory.test.ts) because
 * this harness does not run pgTAP / a live Postgres in CI. The live exploit
 * verification is a manual runbook (docs/decisions/2026-06-11-gate0-db-security.md)
 * Grace runs after `supabase db push --linked`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(__dirname, "../../supabase/migrations");

const INSERT_LOCKDOWN = readFileSync(
  resolve(MIGRATIONS_DIR, "20260611120000_profiles_insert_lockdown_eng1035.sql"),
  "utf8",
);
const PROMO = readFileSync(
  resolve(MIGRATIONS_DIR, "20260611120200_redeem_promo_lifetime_pro_eng1043.sql"),
  "utf8",
);
const ENG1103 = readFileSync(
  resolve(MIGRATIONS_DIR, "20260614120000_eng1103_deactivate_test_promo_throttle_redeem.sql"),
  "utf8",
);
const ENG1106 = readFileSync(
  resolve(MIGRATIONS_DIR, "20260614120100_eng1106_saved_meal_items_nutrition_micros.sql"),
  "utf8",
);
const ENG1154 = readFileSync(
  resolve(MIGRATIONS_DIR, "20260615180000_eng1154_pin_search_path_tier_lockdown.sql"),
  "utf8",
);
const ENG1154_SQL = ENG1154.replace(/^\s*--.*$/gm, "");

describe("ENG-1035 — profiles BEFORE INSERT tier lockdown", () => {
  it("attaches a BEFORE INSERT trigger on public.profiles", () => {
    expect(INSERT_LOCKDOWN).toMatch(
      /create\s+trigger\s+profiles_tier_column_insert_lockdown_trg[\s\S]*?before\s+insert\s+on\s+public\.profiles/i,
    );
  });

  it("rejects an inserted user_tier that is anything other than 'free'", () => {
    // The guard compares NEW.user_tier against the allowed default, NOT against
    // OLD (which is NULL on INSERT) — so a default-free signup still succeeds.
    expect(INSERT_LOCKDOWN).toMatch(
      /new\.user_tier\s+is\s+not\s+null\s+and\s+new\.user_tier\s+is\s+distinct\s+from\s+'free'/i,
    );
    expect(INSERT_LOCKDOWN).toMatch(/errcode\s*=\s*'42501'/i);
  });

  it("rejects a non-null stripe_customer_id on insert", () => {
    expect(INSERT_LOCKDOWN).toMatch(/new\.stripe_customer_id\s+is\s+not\s+null/i);
  });

  it("lets service-role writers (webhooks, promo) bypass", () => {
    expect(INSERT_LOCKDOWN).toMatch(/auth\.role\(\)\s*=\s*'service_role'/i);
  });

  it("runs the same forward-compat jsonb loop as the UPDATE lockdown", () => {
    expect(INSERT_LOCKDOWN).toMatch(/forward_banned\s+text\[\]\s*:=\s*array\s*\[/i);
    for (const col of [
      "subscription_status",
      "trial_started_at",
      "trial_ends_at",
      "trial_days_given",
      "billing_period_end_at",
      "billing_period_start_at",
      "paid_through_at",
    ]) {
      expect(INSERT_LOCKDOWN).toContain(`'${col}'`);
    }
  });

  it("does NOT reuse the UPDATE function (which would break default signups on INSERT)", () => {
    // A BEFORE INSERT trigger wired to profiles_tier_column_lockdown() would
    // compare against a NULL OLD and reject even the 'free' default. The fix
    // must use the dedicated insert function.
    expect(INSERT_LOCKDOWN).toMatch(
      /execute\s+function\s+public\.profiles_tier_column_insert_lockdown\(\)/i,
    );
    expect(INSERT_LOCKDOWN).not.toMatch(
      /before\s+insert[\s\S]*?execute\s+function\s+public\.profiles_tier_column_lockdown\(\)/i,
    );
  });
});

describe("ENG-1043 — promo comp path survives the lockdown + grants lifetime_pro", () => {
  it("redeem_promo_code sets the authorised-writer GUC before the profile write", () => {
    expect(PROMO).toMatch(/set_config\(\s*'app\.tier_writer'\s*,\s*'on'\s*,\s*true\s*\)/i);
  });

  it("BOTH lockdown trigger functions honour the app.tier_writer GUC bypass", () => {
    const bypass = /coalesce\(\s*current_setting\(\s*'app\.tier_writer'\s*,\s*true\s*\)\s*,\s*''\s*\)\s*=\s*'on'/gi;
    const matches = PROMO.match(bypass) ?? [];
    // One in the re-stated UPDATE function, one in the re-stated INSERT function.
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it("never downgrades a higher held tier (lifetime_pro / pro floor)", () => {
    expect(PROMO).toMatch(/tier_rank\s*\(\s*v_current\s*\)\s*>=\s*public\.tier_rank\s*\(\s*v_row\.tier\s*\)/i);
  });

  it("ranks lifetime_pro above pro so it is treated as a durable floor", () => {
    expect(PROMO).toMatch(/when\s+'lifetime_pro'\s+then\s+3/i);
    expect(PROMO).toMatch(/when\s+'pro'\s+then\s+2/i);
  });

  it("redeem_promo_code stays SECURITY DEFINER with a pinned search_path", () => {
    expect(PROMO).toMatch(
      /create\s+or\s+replace\s+function\s+public\.redeem_promo_code[\s\S]*?security\s+definer[\s\S]*?set\s+search_path\s*=\s*public,\s*pg_temp/i,
    );
  });
});

describe("ENG-1103 — deactivate SUPPR_TEST_PREMIUM + throttle redeem_promo_code", () => {
  it("deactivates the guessable test promo code", () => {
    expect(ENG1103).toMatch(/update\s+public\.promo_codes[\s\S]*?active\s*=\s*false[\s\S]*?SUPPR_TEST_PREMIUM/i);
  });

  it("creates promo_redeem_throttle with RLS enabled", () => {
    expect(ENG1103).toMatch(/create\s+table\s+if\s+not\s+exists\s+public\.promo_redeem_throttle/i);
    expect(ENG1103).toMatch(/enable\s+row\s+level\s+security/i);
  });

  it("returns rate_limited after 10 failed attempts per 60s window", () => {
    expect(ENG1103).toMatch(/coalesce\(v_failed,\s*0\)\s*>=\s*10/i);
    expect(ENG1103).toMatch(/'rate_limited'/);
  });
});

describe("ENG-1106 — saved-meal items persist nutrition_micros", () => {
  it("adds nutrition_micros jsonb to user_saved_meal_items", () => {
    expect(ENG1106).toMatch(/alter\s+table\s+public\.user_saved_meal_items[\s\S]*nutrition_micros\s+jsonb/i);
  });
});

describe("ENG-1154 — tier-lockdown functions pin search_path", () => {
  it("re-states both trigger functions with public, pg_temp search_path", () => {
    expect(ENG1154).toMatch(
      /create\s+or\s+replace\s+function\s+public\.profiles_tier_column_lockdown\(\)[\s\S]*?security\s+invoker[\s\S]*?set\s+search_path\s*=\s*public,\s*pg_temp[\s\S]*?as\s+\$\$/i,
    );
    expect(ENG1154).toMatch(
      /create\s+or\s+replace\s+function\s+public\.profiles_tier_column_insert_lockdown\(\)[\s\S]*?security\s+invoker[\s\S]*?set\s+search_path\s*=\s*public,\s*pg_temp[\s\S]*?as\s+\$\$/i,
    );
  });

  it("does not recreate existing trigger bindings", () => {
    expect(ENG1154_SQL).not.toMatch(/drop\s+trigger/i);
    expect(ENG1154_SQL).not.toMatch(/create\s+trigger/i);
    expect(ENG1154).toMatch(/notify\s+pgrst,\s*'reload schema'/i);
  });
});
