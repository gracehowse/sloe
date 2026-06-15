import { resolve } from "node:path";

/** Playwright storage state paths — host-scoped so localhost ≠ 127.0.0.1 (ENG-1167). */
export const AUTH_FILES = {
  "127.0.0.1": resolve(process.cwd(), "tests/e2e/.auth/user.json"),
  localhost: resolve(process.cwd(), "tests/e2e/.auth/user-localhost.json"),
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

export const QA_AUTH_HOSTS = [
  { origin: "http://127.0.0.1:3000", file: AUTH_FILES["127.0.0.1"] },
  { origin: "http://localhost:3000", file: AUTH_FILES.localhost },
] as const;
