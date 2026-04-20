import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { projectId, publicAnonKey } from "./utils/supabase/info.tsx";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/signup",
  "/roadmap",
  "/auth/callback",
  "/help",
  "/pricing",
  "/privacy",
  "/terms",
  "/reset-password",
]);

/** Dev-only preview routes. Reachable without auth in development so
 *  Grace + reviewers can interact with in-flight redesign work
 *  (Phase 1 primitives at `/dev/primitives`, Phase 2 onboarding at
 *  `/onboarding/v2`). The page components themselves still call
 *  `notFound()` when `NODE_ENV === "production"`, so even if these
 *  paths slip into the production middleware allowlist by accident
 *  the user gets a 404, not the page. */
const DEV_PREVIEW_PREFIXES = ["/dev/", "/onboarding/v2"];
function isDevPreview(pathname: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return DEV_PREVIEW_PREFIXES.some(
    (p) => pathname === p.replace(/\/$/, "") || pathname.startsWith(p),
  );
}

function isPublic(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  if (pathname.startsWith("/api/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/favicon")) return true;
  if (isDevPreview(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || `https://${projectId}.supabase.co`;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || publicAnonKey;

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh session — must call getUser() to refresh the auth token cookie
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Allow public routes unconditionally
  if (isPublic(pathname)) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and images.
     * See: https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
