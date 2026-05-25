/**
 * ENG-682 — followWithSsrfGuard must re-validate every redirect hop against the
 * allowlist so a 30x chain (e.g. a Pinterest linkout) can't reach an internal /
 * cloud-metadata host. The Pinterest resolver previously used
 * `fetch(redirect: "follow")`, which would follow such a chain blindly.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { followWithSsrfGuard } from "@/lib/recipe-import/ssrfGuard";

/** Minimal Response stub — only `status` + `headers.get` are read by the guard. */
function resp(status: number, headers: Record<string, string> = {}): Response {
  const lower: Record<string, string> = {};
  for (const k of Object.keys(headers)) lower[k.toLowerCase()] = headers[k];
  return {
    status,
    headers: { get: (k: string) => lower[k.toLowerCase()] ?? null },
  } as unknown as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("followWithSsrfGuard", () => {
  it("returns the response + finalUrl for a direct 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(resp(200, { "content-type": "text/html" }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await followWithSsrfGuard("https://example.com/recipe");

    expect(out).not.toBeNull();
    expect(out?.finalUrl).toBe("https://example.com/recipe");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/recipe",
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("follows a redirect to a public host and reports the final URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(302, { location: "https://target.example.org/r" }))
      .mockResolvedValueOnce(resp(200, { "content-type": "text/html" }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await followWithSsrfGuard("https://pin.it/abc");

    expect(out?.finalUrl).toBe("https://target.example.org/r");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses a redirect to a cloud-metadata host (the SSRF case) and stops", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(302, { location: "http://169.254.169.254/latest/meta-data/" }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await followWithSsrfGuard("https://pin.it/evil");

    expect(out).toBeNull();
    // Must NOT have fetched the private redirect target.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a redirect to an RFC-1918 host", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(resp(301, { location: "http://192.168.0.10/admin" }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await followWithSsrfGuard("https://pin.it/x")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("refuses a disallowed entry URL without fetching at all", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await followWithSsrfGuard("http://127.0.0.1/")).toBeNull();
    expect(await followWithSsrfGuard("ftp://example.com/")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
