import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * T20 (full-sweep 2026-04-24) — pin the household write-path hardening
 * migration so the AND'd UPDATE policy + immutability trigger + RPC
 * filters can't silently regress.
 *
 * Live policy / RPC behaviour is exercised in integration; this file
 * pins the SQL contract.
 */

const SQL = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260503100500_household_write_path_hardening.sql"),
  "utf-8",
);

describe("household_meals UPDATE policy — AND'd attribution + membership", () => {
  it("drops + recreates the 'Creator or owner can update meals' policy", () => {
    expect(SQL).toMatch(
      /drop policy if exists "Creator or owner can update meals" on public\.household_meals/i,
    );
    expect(SQL).toMatch(
      /create policy "Creator or owner can update meals"\s+on public\.household_meals for update/i,
    );
  });

  it("WITH CHECK clause requires BOTH added_by = auth.uid() AND household_id in (auth_household_ids())", () => {
    // The bug was an OR — re-introducing OR would let a creator move
    // a meal to a foreign household. Slice the policy body on the
    // expected anchors so we can assert clause membership without
    // having to match nested parens in regex.
    const policyStart = SQL.toLowerCase().indexOf(
      'create policy "creator or owner can update meals"',
    );
    expect(policyStart).toBeGreaterThan(-1);
    const policyEnd = SQL.toLowerCase().indexOf(";", policyStart);
    expect(policyEnd).toBeGreaterThan(policyStart);
    const policyBody = SQL.slice(policyStart, policyEnd).toLowerCase();
    const checkIdx = policyBody.indexOf("with check");
    expect(checkIdx).toBeGreaterThan(-1);
    const checkBody = policyBody.slice(checkIdx);
    expect(checkBody).toContain("added_by = auth.uid()");
    expect(checkBody).toContain("household_id in (select public.auth_household_ids())");
    expect(checkBody).toContain(" and ");
    // The CHECK must not OR the clauses together (the original bug).
    // Strip any "or" appearing inside `created or replace` or comments
    // by checking only after the `with check` anchor — the clauses are
    // a single boolean expression there.
    expect(checkBody).not.toMatch(/added_by\s*=\s*auth\.uid\(\)\s+or\s/i);
  });
});

describe("household_meals immutability trigger (defense-in-depth)", () => {
  it("declares the trigger function", () => {
    expect(SQL).toMatch(
      /create or replace function public\.household_meals_immutable_attribution\(\)/i,
    );
  });

  it("rejects mutations to added_by + household_id with 42501", () => {
    expect(SQL).toMatch(/added_by is distinct from old\.added_by/i);
    expect(SQL).toMatch(/household_id is distinct from old\.household_id/i);
    const errcodeCount = (SQL.match(/errcode = '42501'/g) ?? []).length;
    expect(errcodeCount).toBeGreaterThanOrEqual(2);
  });

  it("service role bypasses the guard for migrations / admin use", () => {
    expect(SQL).toMatch(/auth\.role\(\)\s*=\s*'service_role'/);
  });

  it("attaches as a BEFORE UPDATE row trigger (drop + create)", () => {
    expect(SQL).toMatch(
      /drop trigger if exists household_meals_immutable_attribution_trg on public\.household_meals/i,
    );
    expect(SQL).toMatch(
      /create trigger household_meals_immutable_attribution_trg\s+before update on public\.household_meals/i,
    );
  });
});

describe("household_join_by_invite_code — disbanded + expiry filters", () => {
  it("loads disbanded_at and invite_code_expires_at into the lookup record", () => {
    expect(SQL).toMatch(
      /select h\.id, h\.name, h\.disbanded_at, h\.invite_code_expires_at/i,
    );
  });

  it("returns household_disbanded when disbanded_at is not null", () => {
    expect(SQL).toMatch(/'household_disbanded'/);
    expect(SQL).toMatch(/disbanded_at is not null/i);
  });

  it("returns invite_expired when invite_code_expires_at is in the past", () => {
    expect(SQL).toMatch(/'invite_expired'/);
    expect(SQL).toMatch(/invite_code_expires_at\s*<=\s*now\(\)/i);
  });

  it("preserves the existing distinct codes (invalid_code, household_full, already_in_household)", () => {
    expect(SQL).toMatch(/'invalid_code'/);
    expect(SQL).toMatch(/'household_full'/);
    expect(SQL).toMatch(/'already_in_household'/);
  });

  it("grants execute to authenticated", () => {
    expect(SQL).toMatch(
      /grant execute on function public\.household_join_by_invite_code\(text, text\) to authenticated/i,
    );
  });
});

describe("HouseholdPanel + HouseholdCard error mapping (sweep handoff)", () => {
  it("HouseholdPanel.tsx maps household_disbanded + invite_expired to user-facing strings", () => {
    const p = readFileSync(
      resolve(process.cwd(), "src/app/components/HouseholdPanel.tsx"),
      "utf-8",
    );
    expect(p).toMatch(/case "household_disbanded":/);
    expect(p).toMatch(/case "invite_expired":/);
  });

  it("mobile HouseholdCard.tsx maps the same codes", () => {
    const p = readFileSync(
      resolve(process.cwd(), "apps/mobile/components/HouseholdCard.tsx"),
      "utf-8",
    );
    expect(p).toMatch(/case "household_disbanded":/);
    expect(p).toMatch(/case "invite_expired":/);
  });
});
