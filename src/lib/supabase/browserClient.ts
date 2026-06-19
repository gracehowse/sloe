import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../../utils/supabase/publicConfig.ts";

/**
 * Browser Supabase client.
 * Connection target is resolved via `supabasePublicUrl()` /
 * `supabasePublicAnonKey()`, which prefer `NEXT_PUBLIC_SUPABASE_*` when set so
 * local/staging dev can point at a non-prod project (falls back to the
 * hard-coded prod project otherwise).
 * Generated types are available in `./database.types.ts` for type-safe queries:
 *   import type { Database } from "./database.types";
 *   supabase.from("recipes").select("...") // typed once Database generic is applied
 * Applying the typed Database generic is tracked in ENG-749.
 */
export const supabase = createBrowserClient(supabasePublicUrl(), supabasePublicAnonKey());

