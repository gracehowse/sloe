/**
 * Unit tests for the web "Export everything" client helper
 * (`src/lib/client/exportEverythingWeb.ts`) — ENG-1262.
 *
 * The helper backs BOTH the standalone Settings "Export everything" row AND
 * the DeleteAccount "Download a copy first" action. It calls the
 * server-authoritative `GET /api/export/me` (the COMPLETE archive) and triggers
 * a browser blob download. These tests pin:
 *   - 401 / no-token → not_authenticated (never fires a download)
 *   - 429 → rate_limited
 *   - network throw → network
 *   - 5xx → server_error
 *   - happy path → triggers an <a download> with the server filename + ok:true
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  downloadSupprExport,
  type ExportSessionProvider,
} from "@/lib/client/exportEverythingWeb";

function clientWithToken(token: string | null): ExportSessionProvider {
  return {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: token ? { access_token: token } : null },
      })),
    },
  };
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("downloadSupprExport (web export-everything helper)", () => {
  let clickSpy: ReturnType<typeof vi.fn>;
  let appendSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    // Stub the anchor so the happy path doesn't require a real DOM navigation.
    appendSpy = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(((node: Node) => node) as never);
    removeSpy = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(((node: Node) => node) as never);
    vi.spyOn(document, "createElement").mockImplementation(((tag: string) => {
      if (tag === "a") {
        return { href: "", download: "", click: clickSpy } as unknown as HTMLElement;
      }
      return document.createElementNS("http://www.w3.org/1999/xhtml", tag) as HTMLElement;
    }) as never);
    // jsdom lacks createObjectURL / revokeObjectURL.
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () =>
      "blob:mock";
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns not_authenticated without a session token (no download fired)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await downloadSupprExport(clientWithToken(null));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_authenticated");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("calls /api/export/me with the bearer token", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response('{"ok":true}', {
        status: 200,
        headers: {
          "content-type": "application/json",
          "content-disposition": 'attachment; filename="sloe-export-u1-2026-06-29.json"',
        },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await downloadSupprExport(clientWithToken("tok-abc"));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/export/me");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok-abc",
    );
  });

  it("maps 429 to rate_limited", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(429, { ok: false, error: "rate_limited" })),
    );
    const result = await downloadSupprExport(clientWithToken("tok"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("rate_limited");
    expect(clickSpy).not.toHaveBeenCalled();
  });

  it("maps 401 to not_authenticated", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse(401, { ok: false, error: "unauthorized" })),
    );
    const result = await downloadSupprExport(clientWithToken("tok"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("not_authenticated");
  });

  it("maps a network throw to network", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("offline");
      }),
    );
    const result = await downloadSupprExport(clientWithToken("tok"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("network");
      expect(result.message).toContain("offline");
    }
  });

  it("maps a 500 to server_error with the server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(500, { ok: false, message: "export_failed: boom" }),
      ),
    );
    const result = await downloadSupprExport(clientWithToken("tok"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("server_error");
      expect(result.message).toContain("boom");
    }
  });

  it("triggers a download with the server filename on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response('{"profile":{}}', {
          status: 200,
          headers: {
            "content-type": "application/json",
            "content-disposition":
              'attachment; filename="sloe-export-u1-2026-06-29.json"',
          },
        }),
      ),
    );

    const result = await downloadSupprExport(clientWithToken("tok"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.filename).toBe("sloe-export-u1-2026-06-29.json");
    }
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
  });
});
