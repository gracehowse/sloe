/**
 * ENG-1308 — chunk-aware Supabase session-cookie parsing in
 * `getUserIdFromRequest` (`src/lib/supabase/serverAnonClient.ts`).
 *
 * Supabase's cookie storage (`@supabase/ssr`) splits a large session
 * (e.g. Google OAuth carrying a provider token) into
 * `sb-<ref>-auth-token.0`, `.1`, … cookies. The pre-fix implementation
 * regex-matched a SINGLE `sb-…-auth-token*` cookie, so for chunked
 * sessions it grabbed one fragment, JSON.parse failed on the partial
 * JSON, the fragment was sent to `auth.getUser()` as if it were a JWT,
 * and every cookie-authed API call 401'd for those users.
 *
 * Regression coverage (cases that FAIL on the old code path):
 *   - 2-chunk plain-JSON session split mid-access-token
 *   - 11-chunk session (numeric vs string chunk ordering: .10 < .2 lex)
 *   - `base64-`-prefixed session value (old code JSON.parsed the
 *     prefixed string, failed, and forwarded `base64-…` as the token)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    auth: { getUser: getUserMock },
  })),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

import { getUserIdFromRequest } from "../../src/lib/supabase/serverAnonClient";

// Realistic three-segment JWT, long enough to split mid-token.
const VALID_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9." +
  "eyJzdWIiOiJ1c2VyLTEyMyIsImF1ZCI6ImF1dGhlbnRpY2F0ZWQiLCJleHAiOjE3NTAwMDAwMDB9." +
  "c2lnbmF0dXJlLXNlZ21lbnQtYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXo";

/** Real-shaped session JSON as `@supabase/ssr` serializes it. */
const SESSION_OBJECT = {
  access_token: VALID_JWT,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: 1_750_000_000,
  refresh_token: "rt-abcdef123456",
  user: { id: "user-123", aud: "authenticated", email: "g@example.com" },
};

function base64Url(s: string): string {
  return Buffer.from(s, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function reqWithCookie(cookie: string): Request {
  return new Request("http://localhost/api/anything", {
    headers: { cookie },
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  getUserMock.mockImplementation(async (token: string) =>
    token === VALID_JWT
      ? { data: { user: { id: "user-123" } }, error: null }
      : { data: { user: null }, error: { message: "invalid JWT" } },
  );
});

describe("getUserIdFromRequest — Supabase session cookies (ENG-1308)", () => {
  it("(a) resolves a single unchunked cookie in the legacy JSON-array format", async () => {
    const value = encodeURIComponent(
      JSON.stringify([VALID_JWT, "rt-abcdef123456", null, null, null]),
    );
    const userId = await getUserIdFromRequest(
      reqWithCookie(`sb-abcdefghij-auth-token=${value}`),
    );
    expect(userId).toBe("user-123");
    expect(getUserMock).toHaveBeenCalledWith(VALID_JWT);
  });

  it("(a) resolves a single unchunked cookie carrying a plain-JSON session object", async () => {
    const value = encodeURIComponent(JSON.stringify(SESSION_OBJECT));
    const userId = await getUserIdFromRequest(
      reqWithCookie(`sb-abcdefghij-auth-token=${value}`),
    );
    expect(userId).toBe("user-123");
    expect(getUserMock).toHaveBeenCalledWith(VALID_JWT);
  });

  it("(b) reassembles a 2-chunk session JSON split mid-access-token (fails on pre-fix code)", async () => {
    const json = JSON.stringify(SESSION_OBJECT);
    // Split INSIDE the access_token value so neither fragment parses.
    const splitAt = json.indexOf(VALID_JWT) + 20;
    const chunk0 = encodeURIComponent(json.slice(0, splitAt));
    const chunk1 = encodeURIComponent(json.slice(splitAt));
    const userId = await getUserIdFromRequest(
      reqWithCookie(
        `sb-abcdefghij-auth-token.0=${chunk0}; sb-abcdefghij-auth-token.1=${chunk1}`,
      ),
    );
    expect(userId).toBe("user-123");
    expect(getUserMock).toHaveBeenCalledWith(VALID_JWT);
  });

  it("(b) orders 11 chunks numerically, not lexicographically (.10 sorts after .9)", async () => {
    const json = JSON.stringify(SESSION_OBJECT);
    const chunkCount = 11;
    const size = Math.ceil(json.length / chunkCount);
    const cookies: string[] = [];
    for (let i = 0; i < chunkCount; i++) {
      const piece = json.slice(i * size, (i + 1) * size);
      cookies.push(`sb-abcdefghij-auth-token.${i}=${encodeURIComponent(piece)}`);
    }
    // Shuffle the header order too — parsing must not rely on it.
    cookies.reverse();
    const userId = await getUserIdFromRequest(reqWithCookie(cookies.join("; ")));
    expect(userId).toBe("user-123");
    expect(getUserMock).toHaveBeenCalledWith(VALID_JWT);
  });

  it("(c) decodes the base64- prefixed format, unchunked (fails on pre-fix code)", async () => {
    const value = encodeURIComponent(`base64-${base64Url(JSON.stringify(SESSION_OBJECT))}`);
    const userId = await getUserIdFromRequest(
      reqWithCookie(`sb-abcdefghij-auth-token=${value}`),
    );
    expect(userId).toBe("user-123");
    expect(getUserMock).toHaveBeenCalledWith(VALID_JWT);
  });

  it("(c) decodes the base64- prefixed format split across 2 chunks", async () => {
    const whole = `base64-${base64Url(JSON.stringify(SESSION_OBJECT))}`;
    const splitAt = Math.floor(whole.length / 2);
    const userId = await getUserIdFromRequest(
      reqWithCookie(
        `sb-abcdefghij-auth-token.0=${encodeURIComponent(whole.slice(0, splitAt))}; ` +
          `sb-abcdefghij-auth-token.1=${encodeURIComponent(whole.slice(splitAt))}`,
      ),
    );
    expect(userId).toBe("user-123");
    expect(getUserMock).toHaveBeenCalledWith(VALID_JWT);
  });

  it("(d) returns null for a garbage cookie value without forwarding it as a JWT", async () => {
    const userId = await getUserIdFromRequest(
      reqWithCookie("sb-abcdefghij-auth-token=garbage-not-json-not-a-jwt"),
    );
    expect(userId).toBeNull();
    // The old code forwarded arbitrary junk to auth.getUser(); the fix
    // only forwards JWT-shaped or successfully-parsed tokens.
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("(d) returns null for malformed percent-encoding instead of throwing", async () => {
    const userId = await getUserIdFromRequest(
      reqWithCookie("sb-abcdefghij-auth-token=%E0%A4%A"),
    );
    expect(userId).toBeNull();
  });

  it("returns null when no auth-token cookie is present", async () => {
    const userId = await getUserIdFromRequest(reqWithCookie("theme=dark; other=1"));
    expect(userId).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("ignores the PKCE code-verifier cookie (not a session)", async () => {
    const userId = await getUserIdFromRequest(
      reqWithCookie("sb-abcdefghij-auth-token-code-verifier=some-verifier-value"),
    );
    expect(userId).toBeNull();
    expect(getUserMock).not.toHaveBeenCalled();
  });

  it("prefers the Authorization header over cookies (mobile path unchanged)", async () => {
    const req = new Request("http://localhost/api/anything", {
      headers: {
        authorization: `Bearer ${VALID_JWT}`,
        cookie: "sb-abcdefghij-auth-token=garbage",
      },
    });
    const userId = await getUserIdFromRequest(req);
    expect(userId).toBe("user-123");
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(getUserMock).toHaveBeenCalledWith(VALID_JWT);
  });

  it("still accepts a bare JWT-shaped cookie value (defensive legacy path)", async () => {
    const userId = await getUserIdFromRequest(
      reqWithCookie(`sb-abcdefghij-auth-token=${encodeURIComponent(VALID_JWT)}`),
    );
    expect(userId).toBe("user-123");
  });
});
