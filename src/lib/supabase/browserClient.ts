import { createBrowserClient } from "@supabase/ssr";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";

const supabaseUrl = `https://${projectId}.supabase.co`;

/**
 * Browser Supabase client.
 * Generated types are available in `./database.types.ts` for type-safe queries:
 *   import type { Database } from "./database.types";
 *   supabase.from("recipes").select("...") // typed once Database generic is applied
 * Not wired up yet — several tables in migrations are missing from the remote schema.
 */
export const supabase = createBrowserClient(supabaseUrl, publicAnonKey);

