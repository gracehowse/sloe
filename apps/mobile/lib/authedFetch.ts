/**
 * Fetch wrapper that attaches the Supabase session token as Authorization header.
 * Use this for calls to our own API routes that require authentication.
 */
import { supabase } from "./supabase";

export async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers = new Headers(init?.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(url, { ...init, headers });
}
