import { NextResponse } from "next/server";

/** Server-only env keys we care about for nutrition + DB-backed routes. */
export const ServerEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "NEXT_PUBLIC_SUPABASE_URL",
  SUPABASE_SERVICE_ROLE_KEY: "SUPABASE_SERVICE_ROLE_KEY",
  USDA_FDC_API_KEY: "USDA_FDC_API_KEY",
  FATSECRET_CONSUMER_KEY: "FATSECRET_CONSUMER_KEY",
  FATSECRET_CONSUMER_SECRET: "FATSECRET_CONSUMER_SECRET",
} as const;

export function hasEnv(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

/** Used at startup / diagnostics: which optional integrations are absent. */
export function missingServerEnvKeys(): string[] {
  const missing: string[] = [];
  if (!hasEnv(ServerEnv.NEXT_PUBLIC_SUPABASE_URL)) missing.push(ServerEnv.NEXT_PUBLIC_SUPABASE_URL);
  if (!hasEnv(ServerEnv.SUPABASE_SERVICE_ROLE_KEY)) missing.push(ServerEnv.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasEnv(ServerEnv.USDA_FDC_API_KEY)) missing.push(ServerEnv.USDA_FDC_API_KEY);
  if (!hasEnv(ServerEnv.FATSECRET_CONSUMER_KEY)) missing.push(ServerEnv.FATSECRET_CONSUMER_KEY);
  if (!hasEnv(ServerEnv.FATSECRET_CONSUMER_SECRET)) missing.push(ServerEnv.FATSECRET_CONSUMER_SECRET);
  return missing;
}

export function hasSupabaseServiceConfig(): boolean {
  return hasEnv(ServerEnv.NEXT_PUBLIC_SUPABASE_URL) && hasEnv(ServerEnv.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasUsdaConfig(): boolean {
  return hasEnv(ServerEnv.USDA_FDC_API_KEY);
}

export function hasFatSecretConfig(): boolean {
  return hasEnv(ServerEnv.FATSECRET_CONSUMER_KEY) && hasEnv(ServerEnv.FATSECRET_CONSUMER_SECRET);
}

/**
 * Barcode mapping + OFF lookup with DB corrections need the service role.
 * Returns a 503 JSON response if misconfigured; otherwise null.
 */
export function misconfiguredServiceRoleResponse(): NextResponse | null {
  if (hasSupabaseServiceConfig()) return null;
  const missing: string[] = [];
  if (!hasEnv(ServerEnv.NEXT_PUBLIC_SUPABASE_URL)) missing.push(ServerEnv.NEXT_PUBLIC_SUPABASE_URL);
  if (!hasEnv(ServerEnv.SUPABASE_SERVICE_ROLE_KEY)) missing.push(ServerEnv.SUPABASE_SERVICE_ROLE_KEY);
  return NextResponse.json(
    {
      ok: false,
      error: "server_misconfigured",
      message: "Server is missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
      missing,
    },
    { status: 503 },
  );
}

/**
 * USDA search route: needs API key.
 */
export function misconfiguredUsdaResponse(): NextResponse | null {
  if (hasUsdaConfig()) return null;
  return NextResponse.json(
    {
      ok: false,
      error: "server_misconfigured",
      message: "USDA FoodData Central is not configured. Set USDA_FDC_API_KEY on the server.",
      missing: [ServerEnv.USDA_FDC_API_KEY],
    },
    { status: 503 },
  );
}

export function misconfiguredFatSecretResponse(): NextResponse | null {
  if (hasFatSecretConfig()) return null;
  const missing: string[] = [];
  if (!hasEnv(ServerEnv.FATSECRET_CONSUMER_KEY)) missing.push(ServerEnv.FATSECRET_CONSUMER_KEY);
  if (!hasEnv(ServerEnv.FATSECRET_CONSUMER_SECRET)) missing.push(ServerEnv.FATSECRET_CONSUMER_SECRET);
  return NextResponse.json(
    {
      ok: false,
      error: "server_misconfigured",
      message: "FatSecret is not configured. Set FATSECRET_CONSUMER_KEY and FATSECRET_CONSUMER_SECRET on the server.",
      missing,
    },
    { status: 503 },
  );
}
