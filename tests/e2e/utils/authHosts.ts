import { resolve } from "node:path";

/** Playwright storage state paths — host-scoped so localhost ≠ 127.0.0.1 (ENG-1167). */
export const AUTH_FILES = {
  "127.0.0.1": resolve(process.cwd(), "tests/e2e/.auth/user.json"),
  localhost: resolve(process.cwd(), "tests/e2e/.auth/user-localhost.json"),
} as const;

/**
 * Deterministic visual-golden account storage. Keep this separate from the
 * general E2E auth state so daily-driver profile changes cannot rewrite goldens.
 */
export const VISUAL_AUTH_FILES = {
  "127.0.0.1": resolve(process.cwd(), "tests/e2e/.auth/visual-user.json"),
  localhost: resolve(process.cwd(), "tests/e2e/.auth/visual-user-localhost.json"),
} as const;

export function authFileForBaseUrl(baseUrl: string): string {
  try {
    const host = new URL(baseUrl).hostname;
    if (host === "localhost") return AUTH_FILES.localhost;
  } catch {
    /* fall through */
  }
  return AUTH_FILES["127.0.0.1"];
}

export function visualAuthFileForBaseUrl(baseUrl: string): string {
  try {
    const host = new URL(baseUrl).hostname;
    if (host === "localhost") return VISUAL_AUTH_FILES.localhost;
  } catch {
    /* fall through */
  }
  return VISUAL_AUTH_FILES["127.0.0.1"];
}

function portSuffix(baseUrl: string): string {
  const url = new URL(baseUrl);
  if (!url.port) return "";
  return `:${url.port}`;
}

/** Login targets for E2E journey auth — honours `PLAYWRIGHT_BASE_URL` port (CI :3100). */
export function qaAuthHosts(baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000") {
  const port = portSuffix(baseUrl);
  return [
    { origin: `http://127.0.0.1${port}`, file: AUTH_FILES["127.0.0.1"] },
    { origin: `http://localhost${port}`, file: AUTH_FILES.localhost },
  ] as const;
}

/** Login targets for visual golden auth — same port rules as `qaAuthHosts`. */
export function qaVisualAuthHosts(baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000") {
  const port = portSuffix(baseUrl);
  return [
    { origin: `http://127.0.0.1${port}`, file: VISUAL_AUTH_FILES["127.0.0.1"] },
    { origin: `http://localhost${port}`, file: VISUAL_AUTH_FILES.localhost },
  ] as const;
}
