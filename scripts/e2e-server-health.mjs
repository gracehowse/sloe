/**
 * Shared HTTP health probe for Playwright preflight — detects zombie listeners
 * (port open but app never responds).
 */
import net from "node:net";

/** @param {string} baseURL e.g. http://127.0.0.1:3000 */
export function parseBaseUrl(baseURL) {
  const url = new URL(baseURL);
  const port =
    url.port !== ""
      ? Number(url.port)
      : url.protocol === "https:"
        ? 443
        : 80;
  const host = url.hostname === "localhost" ? "127.0.0.1" : url.hostname;
  return { host, port, origin: url.origin };
}

/** @returns {Promise<boolean>} */
export function isPortListening(host, port, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });
    const done = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("timeout", () => done(false));
    socket.on("error", () => done(false));
  });
}

/**
 * @param {string} baseURL
 * @param {number} timeoutMs
 * @returns {Promise<{ ok: true, status: number } | { ok: false, reason: "timeout" | "refused" | "http", status?: number, message?: string }>}
 */
export async function probeHttpHealth(baseURL, timeoutMs = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(baseURL, { redirect: "follow", signal: ac.signal });
    if (!res.ok) {
      return { ok: false, reason: "http", status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return { ok: false, reason: "timeout" };
    }
    return {
      ok: false,
      reason: "refused",
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Routes that cold-compile slowly under `next dev` — warm before visual runs. */
export const E2E_WARM_ROUTES = ["/login", "/whats-new"];

/**
 * @param {string} baseURL
 * @param {readonly string[]} routes
 */
export async function warmRoutes(baseURL, routes = E2E_WARM_ROUTES) {
  const origin = baseURL.replace(/\/$/, "");
  for (const route of routes) {
    try {
      await fetch(`${origin}${route}`, { redirect: "follow" });
    } catch {
      // Best-effort — preflight already validated root health.
    }
  }
}
