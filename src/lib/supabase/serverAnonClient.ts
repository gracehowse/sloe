import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";

export function supabasePublicUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return `https://${projectId}.supabase.co`;
}

export function createSupabaseAnonClient(): SupabaseClient {
  return createClient(supabasePublicUrl(), publicAnonKey);
}

/** Validate a Supabase JWT from `Authorization: Bearer …` and return the user id. */
export async function getUserIdFromAuthHeader(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const supabase = createSupabaseAnonClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) return null;
  return data.user.id;
}
