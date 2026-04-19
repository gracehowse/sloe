/**
 * Service-role Supabase client — server-only.
 *
 * Thin wrapper around `createSupabaseServiceRoleClient` in
 * `serverAnonClient.ts`. Exported separately so server-to-server entry
 * points (cron routes, admin tools) can import an explicitly-named
 * "admin" client and future static analysis can flag any unintended
 * import from a client bundle.
 *
 * NEVER import this file from:
 *   - any file under `src/app/components/` or `apps/mobile/`
 *   - any client component (`"use client"`)
 *   - any code that could end up in a Next.js browser bundle
 *
 * The underlying key (`SUPABASE_SERVICE_ROLE_KEY`) bypasses RLS. Keep
 * usage scoped to verified user ids or fully server-trusted flows
 * (cron fan-out, webhooks, account deletion).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "./serverAnonClient";

/**
 * Returns a service-role Supabase client, or `null` when
 * `SUPABASE_SERVICE_ROLE_KEY` is unset. Callers decide how to surface
 * the misconfiguration (503 response, no-op, etc.).
 */
export function getSupabaseAdminClient(): SupabaseClient | null {
  return createSupabaseServiceRoleClient();
}

/**
 * Throwing variant for call sites that cannot reasonably continue
 * without a service-role client (cron routes, one-shot scripts).
 */
export function requireSupabaseAdminClient(): SupabaseClient {
  const client = createSupabaseServiceRoleClient();
  if (!client) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured — cannot obtain service-role Supabase client",
    );
  }
  return client;
}
