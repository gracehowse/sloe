/**
 * F-138 Phase 4 — admin corrections queue: contract / shape pins.
 *
 * Spec: docs/planning/F-138-P4-admin-queue-spec.md
 *
 * Static-analysis tests on the route + actions + row component to pin
 * the load-bearing parts of the spec against drift. Live admin-flow
 * exercising lives in the integration suite (real Supabase, real
 * service role key); this file makes sure a refactor that breaks the
 * spec contract fails CI.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PAGE_SRC = readFileSync(
  resolve(__dirname, "../../app/admin/corrections/page.tsx"),
  "utf8",
);
const ACTIONS_SRC = readFileSync(
  resolve(__dirname, "../../app/admin/corrections/actions.ts"),
  "utf8",
);
const ROW_SRC = readFileSync(
  resolve(__dirname, "../../app/admin/corrections/QueueRow.tsx"),
  "utf8",
);

describe("admin corrections queue — page-level contract (spec §3.1, §3.2, §4)", () => {
  it("uses the nodejs runtime + force-dynamic (the page must never cache)", () => {
    expect(PAGE_SRC).toMatch(/export const runtime = "nodejs"/);
    expect(PAGE_SRC).toMatch(/export const dynamic = "force-dynamic"/);
  });

  it("calls notFound() (not redirect) when the user is not an admin (spec §4)", () => {
    // Spec §4: non-admins should not learn the route exists — use
    // notFound() not redirect('/login'). Three notFound() calls cover
    // unauthenticated, no-service-role, and not-in-admin_users.
    expect(PAGE_SRC).toMatch(/import \{ notFound \} from "next\/navigation"/);
    const notFoundCalls = (PAGE_SRC.match(/notFound\(\)/g) ?? []).length;
    expect(notFoundCalls).toBeGreaterThanOrEqual(3);
    expect(PAGE_SRC).not.toMatch(/redirect\(['"]\/login/);
  });

  it("checks admin_users membership (not a hardcoded email)", () => {
    expect(PAGE_SRC).toMatch(/from\("admin_users"\)/);
    expect(PAGE_SRC).toMatch(/\.eq\("user_id", user\.id\)/);
    // Negative — no hardcoded email check.
    expect(PAGE_SRC).not.toMatch(/gracehowse@outlook\.com/);
  });

  it("queries the two queue sections in the spec'd order (spec §3.2)", () => {
    // Section A — pending oldest first.
    expect(PAGE_SRC).toMatch(/eq\("verification_status", "pending"\)[\s\S]*?order\("created_at", \{ ascending: true \}\)/);
    // Section B — verified-but-flagged oldest flag first.
    expect(PAGE_SRC).toMatch(
      /eq\("verification_status", "verified"\)[\s\S]*?\.not\("flagged_for_admin_at", "is", null\)[\s\S]*?order\("flagged_for_admin_at", \{ ascending: true \}\)/,
    );
  });

  it("renders both sections + an empty state when the queue is empty", () => {
    expect(PAGE_SRC).toMatch(/admin-queue-pending-section/);
    expect(PAGE_SRC).toMatch(/admin-queue-flagged-section/);
    expect(PAGE_SRC).toMatch(/admin-queue-empty-state/);
  });
});

describe("admin corrections queue — server actions (spec §3.4)", () => {
  it("declares a 'use server' directive", () => {
    expect(ACTIONS_SRC.startsWith('"use server"') || ACTIONS_SRC.startsWith("'use server'")).toBe(true);
  });

  it("re-asserts the admin gate inside every action (defence in depth)", () => {
    // Each public action must call getCallerUserIdAndAssertAdmin
    // before touching the DB. Three public actions = 3 calls.
    const gateCalls = (ACTIONS_SRC.match(/getCallerUserIdAndAssertAdmin\(\)/g) ?? []).length;
    expect(gateCalls).toBeGreaterThanOrEqual(3);
  });

  it("approveCorrection sets verification_status = 'verified' + clears the flag", () => {
    expect(ACTIONS_SRC).toMatch(/export async function approveCorrection/);
    expect(ACTIONS_SRC).toMatch(
      /approveCorrection[\s\S]*?\.update\(\{[\s\S]*?verification_status: "verified"[\s\S]*?flagged_for_admin_at: null/,
    );
  });

  it("rejectCorrection sets verification_status = 'rejected'", () => {
    expect(ACTIONS_SRC).toMatch(/export async function rejectCorrection/);
    expect(ACTIONS_SRC).toMatch(
      /rejectCorrection[\s\S]*?\.update\(\{[\s\S]*?verification_status: "rejected"/,
    );
  });

  it("editAndApproveCorrection refuses negative or non-finite values", () => {
    expect(ACTIONS_SRC).toMatch(/Number\.isFinite/);
    expect(ACTIONS_SRC).toMatch(/v < 0/);
    expect(ACTIONS_SRC).toMatch(/Invalid value for/);
  });

  it("editAndApproveCorrection writes verification_status + edits in one UPDATE (spec §3.4 macro-reset trigger note)", () => {
    expect(ACTIONS_SRC).toMatch(
      /editAndApproveCorrection[\s\S]*?\.update\(\{[\s\S]*?\.\.\.cleaned[\s\S]*?verification_status: "verified"/,
    );
  });

  it("revalidates the admin path after every successful write", () => {
    // Three actions, three revalidatePath calls.
    const revalidateCalls = (ACTIONS_SRC.match(/revalidatePath\(/g) ?? []).length;
    expect(revalidateCalls).toBeGreaterThanOrEqual(3);
    expect(ACTIONS_SRC).toMatch(/revalidatePath\(ADMIN_PATH\)/);
  });
});

describe("admin corrections queue — row component (spec §3.3 + §3.4)", () => {
  it("renders the four spec'd action buttons (approve, reject, edit) with stable test ids", () => {
    expect(ROW_SRC).toMatch(/admin-queue-row-approve/);
    expect(ROW_SRC).toMatch(/admin-queue-row-reject/);
    expect(ROW_SRC).toMatch(/admin-queue-row-edit/);
    expect(ROW_SRC).toMatch(/admin-queue-row-edit-save/);
  });

  it("computes the plausibility band via the shared checkSubmissionPlausibility helper", () => {
    expect(ROW_SRC).toMatch(/import \{ checkSubmissionPlausibility \}/);
    expect(ROW_SRC).toMatch(/checkSubmissionPlausibility\(\{/);
  });

  it("collapses the auto_verify verdict into 'pass' for the band display", () => {
    expect(ROW_SRC).toMatch(/auto_verify[\s\S]{0,80}pass/);
  });

  it("shows 'No photo' when evidence_url is null (spec §3.3 strong-signal pill)", () => {
    expect(ROW_SRC).toMatch(/No photo/);
  });

  it("disables every action button while a transition is in flight", () => {
    // useTransition's `busy` flag must gate every action button so the
    // admin can't double-fire. Three action buttons in the default view
    // + two in the edit panel = at least 5 disabled={busy} checks.
    const disabledChecks = (ROW_SRC.match(/disabled=\{busy\}/g) ?? []).length;
    expect(disabledChecks).toBeGreaterThanOrEqual(5);
  });
});
