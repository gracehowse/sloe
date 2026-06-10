/**
 * Env presence checks for scripts/tests — mirrors `serverEnv.ts` alias rules.
 */

export function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

export function hasAnyEnv(...names: string[]): boolean {
  return names.some((n) => hasEnv(n));
}

/** True when FatSecret key + secret are set (CLIENT_* or legacy CONSUMER_* names). */
export function hasFatSecretEnv(): boolean {
  return (
    hasAnyEnv("FATSECRET_CLIENT_ID", "FATSECRET_CONSUMER_KEY") &&
    hasAnyEnv("FATSECRET_CLIENT_SECRET", "FATSECRET_CONSUMER_SECRET")
  );
}
