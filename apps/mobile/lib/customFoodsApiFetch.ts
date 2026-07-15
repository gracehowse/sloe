import type { CustomFoodsApiFetch } from "@suppr/nutrition-core/customFoodsClient";
import { authedFetch } from "./authedFetch";
import { getSupprApiBase } from "./supprWeb";

/**
 * Mobile transport for `createCustomFood` (ENG-1420). Prepends the deployed API
 * base (localhost is unreachable from a device; React Native has no relative
 * host) and attaches the Supabase bearer via `authedFetch` — the exact pattern
 * `useCoach` uses for `/api/nutrition/coach`
 * (`authedFetch(`${getSupprApiBase()}/api/…`, init)`, apps/mobile/lib/useCoach.ts).
 * Mirrors the web binding `src/lib/nutrition/customFoodsApiFetch.ts`
 * (same-origin relative fetch + cookie auth).
 */
export const customFoodsApiFetch: CustomFoodsApiFetch = (path, init) =>
  authedFetch(`${getSupprApiBase()}${path}`, init);
