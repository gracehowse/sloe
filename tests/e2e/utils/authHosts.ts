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

/** CI runs `next start` on :3100 via PLAYWRIGHT_BASE_URL; local default is :3000. */
function qaOrigin(host: "127.0.0.1" | "localhost"): string {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  try {
    const url = new URL(base);
    const port = url.port ? `:${url.port}` : "";
    return `http://${host}${port}`;
  } catch {
    return host === "localhost" ? "http://localhost:3000" : "http://127.0.0.1:3000";
  }
}

export const QA_AUTH_HOSTS = [
  { origin: qaOrigin("127.0.0.1"), file: AUTH_FILES["127.0.0.1"] },
  { origin: qaOrigin("localhost"), file: AUTH_FILES.localhost },
] as const;

export const QA_VISUAL_AUTH_HOSTS = [
  { origin: qaOrigin("127.0.0.1"), file: VISUAL_AUTH_FILES["127.0.0.1"] },
  { origin: qaOrigin("localhost"), file: VISUAL_AUTH_FILES.localhost },
] as const;
