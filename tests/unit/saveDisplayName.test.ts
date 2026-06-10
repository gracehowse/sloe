/**
 * saveDisplayName — pins the shared "Your name" save path used by the
 * Settings field on BOTH platforms (web `src/app/components/Settings.tsx`,
 * mobile `apps/mobile/components/settings/SettingsBundleContent.tsx`).
 *
 * What this test protects (the observable save behaviour):
 *   (a) A real name is written, TRIMMED, to `user_metadata.full_name`
 *       via `supabase.auth.updateUser` — and ONLY that key is written
 *       (never an entitlement / profiles column).
 *   (b) An empty / whitespace-only value CLEARS the name (writes "") so
 *       the Today greeting falls back to "Good morning".
 *   (c) No network write happens when the value is unchanged (the
 *       no-op guard) — prevents a redundant USER_UPDATED on every blur.
 *   (d) A Supabase auth error is surfaced as `{ ok: false }`, and a
 *       thrown/rejected client (network down) is caught, not leaked.
 */

import { describe, it, expect, vi } from "vitest";

import { saveDisplayName } from "../../src/lib/account/displayName";

function makeClient(
  updateImpl: (attributes: {
    data: Record<string, unknown>;
  }) => Promise<{ error: { message: string } | null }>,
) {
  const updateUser = vi.fn(updateImpl);
  return { client: { auth: { updateUser } }, updateUser };
}

describe("saveDisplayName", () => {
  it("(a) writes the trimmed name to user_metadata.full_name only", async () => {
    const { client, updateUser } = makeClient(async () => ({ error: null }));

    const result = await saveDisplayName(client, "  Grace Turner  ", "");

    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({
      data: { full_name: "Grace Turner" },
    });
    // No other keys (no profiles / entitlement columns) in the payload.
    const payload = updateUser.mock.calls[0][0].data;
    expect(Object.keys(payload)).toEqual(["full_name"]);
    expect(result).toEqual({ ok: true, value: "Grace Turner", changed: true });
  });

  it("(b) clears the name when the input is empty / whitespace", async () => {
    const { client, updateUser } = makeClient(async () => ({ error: null }));

    const result = await saveDisplayName(client, "   ", "Grace");

    expect(updateUser).toHaveBeenCalledWith({ data: { full_name: "" } });
    expect(result).toEqual({ ok: true, value: "", changed: true });
  });

  it("(c) no-ops without a network write when the value is unchanged", async () => {
    const { client, updateUser } = makeClient(async () => ({ error: null }));

    // Same value (modulo surrounding whitespace) as what's stored.
    const result = await saveDisplayName(client, "  Grace  ", "Grace");

    expect(updateUser).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, value: "Grace", changed: false });
  });

  it("(d) surfaces a Supabase auth error as ok:false", async () => {
    const { client } = makeClient(async () => ({
      error: { message: "rate limited" },
    }));

    const result = await saveDisplayName(client, "Grace", "");

    expect(result).toEqual({ ok: false, message: "rate limited" });
  });

  it("(d) catches a thrown/rejected client (network down)", async () => {
    const { client } = makeClient(async () => {
      throw new Error("Network request failed");
    });

    const result = await saveDisplayName(client, "Grace", "");

    expect(result).toEqual({ ok: false, message: "Network request failed" });
  });
});
