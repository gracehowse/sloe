import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";
import { safeAuthRedirectPath } from "@/lib/auth/safeRedirectPath";

/**
 * Completes Supabase OAuth / magic-link PKCE: exchanges `?code=` for a session cookie.
 *
 * REQUIRED Supabase dashboard config (Authentication → URL Configuration):
 *   Site URL:       https://suppr-club.com
 *   Redirect URLs:  https://suppr-club.com/auth/callback
 *                   http://localhost:3000/auth/callback   (for local dev)
 */
async function handleCallback(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next")?.trim() || "/";

  // Handle OAuth errors (e.g. user cancelled Apple Sign In, provider misconfiguration)
  const oauthError = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");
  if (oauthError || !code) {
    console.error("[auth/callback] OAuth error:", oauthError, errorDescription);
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "oauth");
    if (errorDescription) {
      login.searchParams.set("error_description", errorDescription);
    }
    return NextResponse.redirect(login);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || `https://${projectId}.supabase.co`;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || publicAnonKey;

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // set from Server Component edge cases — session may still be established via middleware refresh
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth/callback] Code exchange failed:", error.message);
    const login = new URL("/login", requestUrl.origin);
    login.searchParams.set("error", "oauth");
    login.searchParams.set("error_description", error.message);
    return NextResponse.redirect(login);
  }

  const safePath = safeAuthRedirectPath(next);
  return NextResponse.redirect(new URL(safePath, requestUrl.origin));
}

export async function GET(request: Request) {
  return handleCallback(request);
}

// Apple Sign In can use form_post response mode which may result in
// Supabase redirecting via POST in some edge cases.
export async function POST(request: Request) {
  return handleCallback(request);
}
