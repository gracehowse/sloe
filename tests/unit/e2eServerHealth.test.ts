import { describe, expect, it } from "vitest";
import { parseBaseUrl } from "../../scripts/e2e-server-health.mjs";

describe("e2e-server-health", () => {
  it("parseBaseUrl normalises localhost to 127.0.0.1", () => {
    expect(parseBaseUrl("http://localhost:3000")).toEqual({
      host: "127.0.0.1",
      port: 3000,
      origin: "http://localhost:3000",
    });
  });

  it("parseBaseUrl defaults http port", () => {
    expect(parseBaseUrl("http://127.0.0.1")).toEqual({
      host: "127.0.0.1",
      port: 80,
      origin: "http://127.0.0.1",
    });
  });
});

describe("qaAuthHosts", () => {
  it("uses PLAYWRIGHT_BASE_URL port for CI parity", async () => {
    const { qaAuthHosts } = await import("../../tests/e2e/utils/authHosts");
    const hosts = qaAuthHosts("http://127.0.0.1:3100");
    expect(hosts[0].origin).toBe("http://127.0.0.1:3100");
    expect(hosts[1].origin).toBe("http://localhost:3100");
  });
});
