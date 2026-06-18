import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = resolve(process.cwd(), "scripts/verify-production-env.ts");

function runVerify(env: Record<string, string | undefined>): string {
  return execFileSync("npx", ["tsx", SCRIPT], {
    encoding: "utf8",
    env: { ...process.env, VERIFY_STRICT: "0", VERCEL_ENV: "preview", ...env },
  });
}

describe("verify-production-env (ENG-1115 / ENG-1146)", () => {
  it("prints advisory SUPADATA + FATSECRET_TIER lines when unset", () => {
    const out = runVerify({
      FATSECRET_TIER: "",
      SUPADATA_KEY: "",
    });
    expect(out).toMatch(/SUPADATA recipe import.*missing/i);
    expect(out).toMatch(/FATSECRET_TIER.*unset/i);
    expect(out).toMatch(/ENG-1115/);
  });

  it("prints OK when premier tier and Supadata key are set", () => {
    const out = runVerify({
      FATSECRET_TIER: "premier",
      SUPADATA_KEY: "sd_test",
    });
    expect(out).toMatch(/\[OK\] FATSECRET_TIER — premier/);
    expect(out).toMatch(/\[OK\] SUPADATA recipe import — configured/);
  });
});
