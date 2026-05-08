/**
 * F-138 Phase 3 (vote aggregation + flag-as-bad-data + evidence URL)
 * — pin the migration so the schema contract for the upcoming UI work
 * stays stable. Mirrors the Phase 1 pattern in
 * `userFoodsP0Hardening.test.ts`.
 *
 * What this guards (per
 * `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`
 * Phase 3):
 *
 *   1. Vote-count aggregation trigger — fires on user_food_votes
 *      INSERT/UPDATE/DELETE; recomputes user_foods.upvotes/downvotes;
 *      bypasses the macro-reset trigger because vote counts are NOT
 *      nutrition columns.
 *
 *   2. user_food_flags table — RLS-scoped flag-as-bad-data signals
 *      with a 3-distinct-flag auto-reject trigger for `pending` rows.
 *      `verified` rows get a flagged_for_admin_at stamp instead, so
 *      a malicious flag swarm doesn't silently kick a vetted row out.
 *
 *   3. user_foods.evidence_url — required column for the
 *      "Submit to database" path; ignored for "Save to my foods".
 *      Sanity check: must look like a relative storage path, not a
 *      public URL.
 *
 *   4. food-evidence private storage bucket with owner-only RLS.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

const SQL = read(
  "supabase/migrations/20260513100000_user_foods_phase3_votes_flags_evidence.sql",
);

describe("F-138 Phase 3 — vote-count aggregation trigger", () => {
  it("declares user_food_votes_recompute_counts() function", () => {
    expect(SQL).toMatch(
      /create or replace function public\.user_food_votes_recompute_counts/,
    );
  });

  it("trigger fires after insert OR update OR delete on user_food_votes", () => {
    expect(SQL).toMatch(
      /create trigger user_food_votes_recompute_counts_aiud[\s\S]{0,200}after insert or update or delete on public\.user_food_votes/,
    );
  });

  it("recomputes upvotes (vote = 1) and downvotes (vote = -1) separately", () => {
    expect(SQL).toMatch(/sum\(case when vote = 1\s*then 1 else 0 end\)/);
    expect(SQL).toMatch(/sum\(case when vote = -1 then 1 else 0 end\)/);
  });

  it("backfills existing vote totals at migration time", () => {
    // Loop must touch every distinct user_food_id that has votes.
    expect(SQL).toMatch(
      /for fid in select distinct user_food_id from public\.user_food_votes[\s\S]{0,400}update public\.user_foods/,
    );
  });

  it("trigger updates ONLY upvotes/downvotes (not nutrition cols, so no macro-reset cascade)", () => {
    // Within the recompute function the UPDATE statement must touch
    // only the count columns. Pin that literally.
    const fnMatch = SQL.match(
      /create or replace function public\.user_food_votes_recompute_counts[\s\S]+?\$\$;/,
    );
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      const body = fnMatch[0];
      expect(body).toMatch(/set upvotes\s*=\s*up_count,\s*\n\s*downvotes\s*=\s*down_count/);
      expect(body).not.toMatch(/calories\s*=/);
      expect(body).not.toMatch(/protein\s*=/);
      expect(body).not.toMatch(/verification_status\s*=/);
    }
  });
});

describe("F-138 Phase 3 — user_food_flags table + RLS", () => {
  it("creates user_food_flags table with the right shape", () => {
    expect(SQL).toMatch(/create table if not exists public\.user_food_flags/);
    expect(SQL).toMatch(/user_food_id uuid not null references public\.user_foods\(id\) on delete cascade/);
    expect(SQL).toMatch(/flagger_id uuid not null references auth\.users\(id\) on delete cascade/);
    expect(SQL).toMatch(/unique \(user_food_id, flagger_id\)/);
  });

  it("constrains reason to a closed set of values", () => {
    expect(SQL).toMatch(
      /reason text not null default 'wrong_data'\s*\n?\s*check \(reason in \('wrong_data', 'misleading', 'duplicate', 'spam', 'other'\)\)/,
    );
  });

  it("enables RLS on user_food_flags", () => {
    expect(SQL).toMatch(/alter table public\.user_food_flags enable row level security/);
  });

  it("RLS — read own only (no public-read)", () => {
    expect(SQL).toMatch(
      /create policy "Users can read their own flags"[\s\S]{0,300}flagger_id\s*=\s*auth\.uid\(\)/,
    );
    // Guard: the migration must not grant public/anonymous read.
    expect(SQL).not.toMatch(/on public\.user_food_flags for select[\s\S]{0,200}using \(true\)/);
  });

  it("RLS — insert own only (with check on flagger_id)", () => {
    expect(SQL).toMatch(
      /create policy "Users can insert their own flags"[\s\S]{0,300}with check \(flagger_id\s*=\s*auth\.uid\(\)\)/,
    );
  });

  it("RLS — delete own only (users can withdraw their own flag)", () => {
    expect(SQL).toMatch(
      /create policy "Users can delete their own flags"[\s\S]{0,300}using \(flagger_id\s*=\s*auth\.uid\(\)\)/,
    );
  });
});

describe("F-138 Phase 3 — 3-flag auto-reject trigger", () => {
  it("declares user_food_flags_after_change() function + AID trigger", () => {
    expect(SQL).toMatch(/create or replace function public\.user_food_flags_after_change/);
    expect(SQL).toMatch(
      /create trigger user_food_flags_after_change_aid[\s\S]{0,200}after insert or delete on public\.user_food_flags/,
    );
  });

  it("auto-rejects pending rows when flag_count >= 3", () => {
    const fnMatch = SQL.match(
      /create or replace function public\.user_food_flags_after_change[\s\S]+?\$\$;/,
    );
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      const body = fnMatch[0];
      expect(body).toMatch(/flag_count\s*>=\s*3/);
      expect(body).toMatch(
        /current_status\s*=\s*'pending'[\s\S]{0,400}set verification_status\s*=\s*'rejected'/,
      );
    }
  });

  it("verified rows get flagged_for_admin_at stamp (NO auto-reject)", () => {
    const fnMatch = SQL.match(
      /create or replace function public\.user_food_flags_after_change[\s\S]+?\$\$;/,
    );
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      const body = fnMatch[0];
      // The verified branch must update flagged_for_admin_at, NOT
      // verification_status.
      expect(body).toMatch(
        /current_status\s*=\s*'verified'[\s\S]{0,400}flagged_for_admin_at\s*=\s*coalesce\(flagged_for_admin_at,\s*now\(\)\)/,
      );
      // Pin that the verified branch doesn't sneak a status flip in.
      const verifiedBranch = body.match(
        /elsif current_status = 'verified' then[\s\S]+?(?=elsif|end if;)/,
      )?.[0] ?? "";
      expect(verifiedBranch).not.toMatch(/verification_status\s*=/);
    }
  });

  it("clears flagged_for_admin_at when all flags are withdrawn (flag_count = 0)", () => {
    const fnMatch = SQL.match(
      /create or replace function public\.user_food_flags_after_change[\s\S]+?\$\$;/,
    );
    expect(fnMatch).not.toBeNull();
    if (fnMatch) {
      const body = fnMatch[0];
      expect(body).toMatch(
        /flag_count\s*=\s*0[\s\S]{0,300}set flagged_for_admin_at\s*=\s*null/,
      );
    }
  });

  it("adds flagged_for_admin_at column to user_foods", () => {
    expect(SQL).toMatch(
      /alter table public\.user_foods\s+add column if not exists flagged_for_admin_at timestamptz/,
    );
  });
});

describe("F-138 Phase 3 — evidence_url + private storage bucket", () => {
  it("adds evidence_url column with shape constraint (relative path, not http URL)", () => {
    expect(SQL).toMatch(
      /alter table public\.user_foods\s+add column if not exists evidence_url text/,
    );
    expect(SQL).toMatch(
      /user_foods_evidence_url_shape[\s\S]{0,400}evidence_url not like 'http%'/,
    );
    expect(SQL).toMatch(/length\(evidence_url\)\s*<=\s*512/);
  });

  it("creates private food-evidence storage bucket (public = false)", () => {
    expect(SQL).toMatch(
      /insert into storage\.buckets[\s\S]{0,300}'food-evidence'[\s\S]{0,200}false/,
    );
  });

  it("limits the food-evidence bucket to 6 MB + image/* mime types", () => {
    expect(SQL).toMatch(/6\s*\*\s*1024\s*\*\s*1024/);
    expect(SQL).toMatch(
      /allowed_mime_types[\s\S]{0,400}'image\/jpeg'[\s\S]{0,200}'image\/png'[\s\S]{0,200}'image\/heic'/,
    );
  });

  it("storage RLS — owner-only insert/select/delete (no public read)", () => {
    expect(SQL).toMatch(
      /create policy "Users can upload food-evidence under their uid prefix"[\s\S]{0,400}auth\.uid\(\)::text\s*=\s*\(storage\.foldername\(name\)\)\[1\]/,
    );
    expect(SQL).toMatch(
      /create policy "Users can read their own food-evidence"[\s\S]{0,400}auth\.uid\(\)::text\s*=\s*\(storage\.foldername\(name\)\)\[1\]/,
    );
    expect(SQL).toMatch(
      /create policy "Users can delete their own food-evidence"[\s\S]{0,400}auth\.uid\(\)::text\s*=\s*\(storage\.foldername\(name\)\)\[1\]/,
    );
  });
});
