import type { CustomFoodsApiFetch } from "@suppr/nutrition-core/customFoodsClient";
import { getSupprApiBase } from "./supprWeb";

/**
 * Mobile transport for `createCustomFood` (ENG-1420). Prepends the deployed API
 * base (localhost is unreachable from a device; React Native has no relative
 * host) and attaches the Supabase bearer via `authedFetch` — the exact pattern
 * `useCoach` uses for `/api/nutrition/coach`
 * (`authedFetch(`${getSupprApiBase()}/api/…`, init)`, apps/mobile/lib/useCoach.ts).
 * Mirrors the web binding `src/lib/nutrition/customFoodsApiFetch.ts`
 * (same-origin relative fetch + cookie auth).
 *
 * `authedFetch` is imported lazily (inside the call, not at module top level)
 * because it transitively imports `./supabase`, which constructs a Supabase
 * client at MODULE LOAD TIME — a eager `createClient()` call. This file is
 * imported unconditionally by `FoodSearchPanel.tsx`, a component many
 * unrelated test files pull in transitively; a top-level import here forced
 * every one of those tests to either mock `@/lib/supabase` or crash with
 * "supabaseUrl is required" the moment the test environment's
 * `expo-constants` mock has no configured URL — even tests that never call
 * this function. Deferring the import until the function actually runs
 * removes that module-load side effect for everyone who doesn't invoke it.
 */
export const customFoodsApiFetch: CustomFoodsApiFetch = async (path, init) => {
  const { authedFetch } = await import("./authedFetch");
  return authedFetch(`${getSupprApiBase()}${path}`, init);
};
