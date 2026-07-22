import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocket as WsWebSocket } from "ws";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../../utils/supabase/publicConfig.ts";

// Node 20 (the CI pin) has no native WebSocket; supabase-js eagerly
// constructs its realtime client at createClient() time and throws without
// one — even though this spec only performs REST/auth calls. Same shim the
// seed scripts use (scripts/setup-e2e-visual-golden-user.mts).
(globalThis as { WebSocket?: unknown }).WebSocket ??= WsWebSocket;

/**
 * ENG-1650 — meal share links (ENG-1642) e2e happy path + landing states.
 *
 * Human-style journey: sharer creates a share (RPC-direct — the ticket's own
 * framing; the kebab UI entry is flag-gated and covered by unit tests),
 * an anonymous visitor previews it on /m/<token>, and a signed-in recipient
 * accepts it into their own diary — asserted against the DATABASE (identical
 * totals including micros), not just the toast.
 *
 * Self-provisioning: creates throwaway @example.com users against the
 * configured Supabase project (the repo's documented e2e convention) and
 * cleans up its diary rows in afterAll. `meal_shares` rows cannot be deleted
 * by clients (table lockdown is part of the design) — they are revoked
 * instead and expire in 30 days.
 *
 * Skips (rather than fails) when the meal_shares RPC surface is absent —
 * i.e. environments where migration 20260722090000 has not been applied.
 *
 * NOT covered here (deliberate): the signed-out landing → signup →
 * onboarding → pending-share resume rail. Driving full onboarding in e2e is
 * brittle; the resume mechanics are pinned by unit tests
 * (tests/unit/sharedMealAcceptHost.test.tsx, tests/unit/mealShareClient.test.ts).
 */

const SHARE_TITLE = "E2E meal-share salmon bowl";
const MICROS = { sodium_mg: 640, iron_mg: 2.5 };

type Provisioned = {
  sharer: SupabaseClient;
  recipient: SupabaseClient;
  recipientEmail: string;
  password: string;
  token: string;
  revokedToken: string;
  sharerMealRowId: string;
};

let p: Provisioned | null = null;
let rpcSurfaceMissing = false;

const anonClient = () =>
  createClient(supabasePublicUrl(), supabasePublicAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

test.beforeAll(async () => {
  const anon = anonClient();
  const probe = await anon.rpc("get_meal_share", { p_token: "0".repeat(32) });
  if (probe.error) {
    // PGRST202 = function not found → migration not applied in this env.
    rpcSurfaceMissing = true;
    return;
  }

  const suffix = randomBytes(4).toString("hex");
  const password = `E2e!${randomBytes(9).toString("base64url")}`;
  const sharer = anonClient();
  const recipient = anonClient();
  const recipientEmail = `e2e-mealshare-recipient-${suffix}@example.com`;

  const { data: sharerUp, error: sharerErr } = await sharer.auth.signUp({
    email: `e2e-mealshare-sharer-${suffix}@example.com`,
    password,
  });
  if (sharerErr) throw new Error(`sharer signup failed: ${sharerErr.message}`);
  const { data: recipientUp, error: recipientErr } = await recipient.auth.signUp({
    email: recipientEmail,
    password,
  });
  if (recipientErr) throw new Error(`recipient signup failed: ${recipientErr.message}`);

  // Sharer gets a display name (exercises the "{name} shared a meal" header);
  // recipient gets onboarding_completed so /home renders instead of bouncing
  // to /onboarding (homeProfileGate).
  await sharer.from("profiles").upsert({
    id: sharerUp.user!.id,
    display_name: "Riley",
    onboarding_completed: true,
  });
  await recipient.from("profiles").upsert({
    id: recipientUp.user!.id,
    onboarding_completed: true,
  });

  const sharerMealRowId = randomUUID();
  const { error: mealErr } = await sharer.from("nutrition_entries").insert({
    id: sharerMealRowId,
    user_id: sharerUp.user!.id,
    date_key: new Date().toISOString().slice(0, 10),
    name: "Dinner",
    recipe_title: SHARE_TITLE,
    time_label: "7:00 PM",
    calories: 620,
    protein: 42,
    carbs: 48,
    fat: 24,
    fiber_g: 7,
    portion_multiplier: 1,
    nutrition_micros: MICROS,
    source: "manual",
  });
  if (mealErr) throw new Error(`sharer meal insert failed: ${mealErr.message}`);

  const item = {
    recipe_title: SHARE_TITLE,
    calories: 620,
    protein: 42,
    carbs: 48,
    fat: 24,
    fiber_g: 7,
    portion_multiplier: 1,
    nutrition_micros: MICROS,
    source: "manual",
  };
  const mkShare = async () => {
    const { data, error } = await sharer.rpc("create_meal_share", {
      p_title: SHARE_TITLE,
      p_meal_slot: "Dinner",
      p_items: [item],
    });
    if (error || data?.status !== "created") {
      throw new Error(`create_meal_share failed: ${error?.message ?? data?.status}`);
    }
    return data as { token: string; share_id: string };
  };
  const live = await mkShare();
  const doomed = await mkShare();
  const { data: revoked } = await sharer.rpc("revoke_meal_share", {
    p_share_id: doomed.share_id,
  });
  if (revoked?.status !== "revoked") {
    throw new Error(`revoke_meal_share failed: ${revoked?.status}`);
  }

  p = {
    sharer,
    recipient,
    recipientEmail,
    password,
    token: live.token,
    revokedToken: doomed.token,
    sharerMealRowId,
  };
});

test.afterAll(async () => {
  if (!p) return;
  // Diary rows are owner-deletable; shares are revoke-only by design.
  await p.sharer.from("nutrition_entries").delete().eq("id", p.sharerMealRowId);
  const { data: recipientRows } = await p.recipient
    .from("nutrition_entries")
    .select("id")
    .eq("recipe_title", SHARE_TITLE);
  for (const row of recipientRows ?? []) {
    await p.recipient.from("nutrition_entries").delete().eq("id", row.id);
  }
});

test.describe("Meal share links (ENG-1642)", () => {
  test.beforeEach(() => {
    test.skip(rpcSurfaceMissing, "meal_shares RPC surface absent (migration not applied)");
  });

  test("when I open a share link signed out, I see the meal and the join CTA", async ({ page }) => {
    await test.step("I open /m/<token> anonymously", async () => {
      await page.goto(`/m/${p!.token}`);
    });

    await test.step("I expect the shared meal preview", async () => {
      await expect(page.getByText("Riley shared a meal")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(SHARE_TITLE).first()).toBeVisible();
      await expect(page.getByText(/620/).first()).toBeVisible();
    });

    await test.step("I expect the signed-out CTA pair (one filled, one ghost)", async () => {
      await expect(page.getByRole("button", { name: /join sloe and add it/i })).toBeVisible();
      await expect(
        page.getByRole("button", { name: /i already have an account/i }),
      ).toBeVisible();
    });
  });

  test("when I open a revoked or unknown link, I get the graceful states", async ({ page }) => {
    await test.step("a revoked token tells me it was removed", async () => {
      await page.goto(`/m/${p!.revokedToken}`);
      await expect(page.getByText("This link was removed")).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByText("The person who shared it turned this link off."),
      ).toBeVisible();
    });

    await test.step("an unknown token tells me it isn't valid", async () => {
      await page.goto(`/m/${"0".repeat(32)}`);
      await expect(page.getByText("This link isn't valid")).toBeVisible({ timeout: 20_000 });
    });

    await test.step("a malformed token also resolves to the invalid state", async () => {
      await page.goto("/m/not-a-real-token");
      await expect(page.getByText("This link isn't valid")).toBeVisible({ timeout: 20_000 });
    });
  });

  test("when I sign in and follow the link, the meal lands in MY diary with identical totals", async ({
    page,
  }) => {
    await test.step("I sign in as the recipient", async () => {
      await page.goto("/login");
      await page.getByRole("button", { name: "Continue with email" }).click();
      await page.getByPlaceholder("you@domain.com").fill(p!.recipientEmail);
      await page.getByPlaceholder(/your password/i).fill(p!.password);
      await page.getByRole("button", { name: /^sign in$/i }).click();
      // Post-login lands on /today (the default authed view); the accept host
      // is mounted app-wide, so the exact landing route doesn't matter — just
      // wait until we're off the auth pages.
      await page.waitForURL(/\/(home|today)/, { timeout: 45_000 });
    });

    await test.step("I open the share link as a signed-in user and tap Add to my log", async () => {
      // The real landing handoff: signed-in visitors get the "Add to my log"
      // CTA, which stashes the token + routes into the app so the accept host
      // opens the dialog. (Driving the actual button, not a synthetic URL, so
      // the test tracks the shipped flow.)
      await page.goto(`/m/${p!.token}`);
      await page.getByRole("button", { name: /add to my log/i }).click();
    });

    await test.step("the accept dialog shows the meal and I confirm", async () => {
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 45_000 });
      await expect(dialog.getByText(SHARE_TITLE).first()).toBeVisible();
      const confirm = dialog.getByRole("button", { name: /add to my log/i });
      await expect(confirm).toBeEnabled();
      await confirm.click();
      // The dialog closing is the reliable UI signal (the success toast
      // auto-dismisses and can race the assertion); the DB row below is the
      // ground-truth proof.
      await expect(dialog).toBeHidden({ timeout: 20_000 });
    });

    await test.step("the row exists in MY journal with identical totals including micros", async () => {
      const { data: rows, error } = await p!.recipient
        .from("nutrition_entries")
        .select("recipe_title, calories, protein, carbs, fat, fiber_g, nutrition_micros, name")
        .eq("recipe_title", SHARE_TITLE);
      expect(error).toBeNull();
      expect(rows?.length).toBeGreaterThan(0);
      const row = rows![0];
      expect(row.calories).toBe(620);
      expect(row.protein).toBe(42);
      expect(row.carbs).toBe(48);
      expect(row.fat).toBe(24);
      expect(row.fiber_g).toBe(7);
      expect(row.nutrition_micros).toMatchObject(MICROS);
    });
  });
});
