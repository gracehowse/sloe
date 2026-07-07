"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../src/lib/supabase/browserClient.ts";
import { avatarInitials } from "../../src/lib/avatarInitials.ts";
import { isFeatureEnabled } from "../../src/lib/analytics/track.ts";

/**
 * PricingHeaderAuth — the auth-aware right-hand slot of the `/pricing`
 * header (ENG-1460, part 2).
 *
 * DECIDED (Fable, 2026-07-07, per Grace's delegation): a signed-in user
 * seeing "Sign in" on the surface that asks for money is a wrong-identity
 * moment at the exact point trust converts. Signed-out visitors keep the
 * current "Sign in" link; signed-in visitors get an avatar/account
 * affordance instead.
 *
 * Reads the session via the SHARED `supabase` client from
 * `src/lib/supabase/browserClient.ts` (`createBrowserClient` from
 * `@supabase/ssr`, cookie-backed) — the same client the real app auth
 * context (`AuthSessionContext.tsx`) uses. Deliberately NOT the
 * `createClient(...)` from `@supabase/supabase-js` that `CurrentTierBadge` /
 * `PricingPaywallHonesty` / `CheckoutButton` use on this same page: that
 * plain client defaults to localStorage session storage, which cannot see
 * a session the real app established via the cookie-backed client — those
 * three components silently fail to detect a real logged-in user (found
 * while building this fix; filed as a separate P1, not fixed here to keep
 * this change scoped to ENG-1460). This component uses the client that
 * actually works.
 *
 * Renders the "Sign in" link immediately (no loading flash) and swaps to
 * the avatar once the session read resolves — a signed-out render is the
 * safe default while the session check is in flight.
 *
 * Self-gated behind `pricing_conversion_pair_v1` (default-ON): the flag
 * check happens INSIDE this client component rather than in the server
 * `page.tsx` that renders it — `track.ts` is "use client" and cannot be
 * invoked from a server component. Off → always renders the legacy
 * "Sign in" link regardless of auth state (kill switch).
 */
export function PricingHeaderAuth() {
  const [authed, setAuthed] = useState(false);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled || !session?.user?.id) return;
      setAuthed(true);
      setEmail(session.user.email ?? null);
      const { data } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!cancelled && data?.display_name) {
        setDisplayName(data.display_name as string);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const conversionPairEnabled = isFeatureEnabled("pricing_conversion_pair_v1");

  if (!conversionPairEnabled || !authed) {
    return (
      <Link
        href="/login"
        className="px-5 py-2 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-card transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const initialsSource = displayName?.trim() || email?.split("@")[0]?.trim();
  const initial = initialsSource ? avatarInitials(initialsSource) : "U";
  const label = displayName?.trim() || email?.split("@")[0]?.trim() || "Account";

  return (
    <Link
      href="/home"
      data-testid="pricing-header-account"
      aria-label={`Go to your account (${label})`}
      className="flex items-center gap-2 px-2 py-1.5 pr-3 rounded-full border border-border hover:bg-card transition-colors"
    >
      <span
        aria-hidden
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold text-white"
        style={{
          // SLOE DS: same avatar gradient token as the authed sidebar
          // (`--avatar-gradient-accent`, theme.css) — no raw hex here.
          background:
            "linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 70%, var(--avatar-gradient-accent)) 100%)",
        }}
      >
        {initial}
      </span>
      <span className="hidden sm:inline text-sm font-semibold text-foreground max-w-[120px] truncate">
        {label}
      </span>
    </Link>
  );
}

export default PricingHeaderAuth;
