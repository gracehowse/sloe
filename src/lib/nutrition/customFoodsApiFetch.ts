import type { CustomFoodsApiFetch } from "./customFoodsClient";

/**
 * Web transport for `createCustomFood` (ENG-1420). A same-origin relative
 * `fetch`: the browser attaches the Supabase session cookie automatically,
 * which `getUserIdFromRequest` reads server-side. Mirrors the mobile binding
 * `apps/mobile/lib/customFoodsApiFetch.ts`, which instead prepends
 * `getSupprApiBase()` + an Authorization bearer (RN has no relative host).
 */
export const customFoodsApiFetch: CustomFoodsApiFetch = (path, init) => fetch(path, init);
