"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Smartphone, Users } from "lucide-react";

import { Button } from "@/app/components/ui/button";
import { track } from "@/lib/analytics/track";
import { AnalyticsEvents } from "@/lib/analytics/events";
import { supabase } from "@/lib/supabase/browserClient";
import { formatMacroTrailer } from "@/lib/nutrition/macroFormat";
import {
  mealShareTotals,
  normaliseMealShareToken,
  type MealSharePayload,
  type MealShareStatus,
} from "@/lib/share/mealShareLink";
import { getMealShare, storePendingMealShare } from "@/lib/share/mealShareClient";

type LoadState =
  | { kind: "loading" }
  | { kind: Exclude<MealShareStatus, "ok"> }
  | { kind: "ok"; payload: MealSharePayload };

const ERROR_COPY: Record<Exclude<MealShareStatus, "ok">, { title: string; body: string }> = {
  invalid: {
    title: "This link isn't valid",
    body: "This share link isn't valid — ask your friend to send a new one.",
  },
  expired: {
    title: "This link has expired",
    body: "Ask your friend to share the meal again.",
  },
  revoked: {
    title: "This link was removed",
    body: "The person who shared it turned this link off.",
  },
};

/**
 * ENG-1642 — anon-reachable landing for a `/m/<token>` share link
 * (middleware.ts marks `/m/` public). Resolves the token via
 * `get_meal_share` + the current session in parallel, then renders one of:
 * loading skeleton, an error state (invalid/expired/revoked), or the
 * shared-meal card with the signed-in / signed-out CTA split.
 *
 * Signed-out CTAs stash the token via `storePendingMealShare` before
 * bouncing to `/signup` or `/login` — neither password form supports
 * `?next=`, so the Today surface drains the pending token on `/home`
 * after auth lands (see `mealShareClient.ts` doc comment).
 */
export function MealShareLandingClient({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = React.useState<LoadState>({ kind: "loading" });
  const [authed, setAuthed] = React.useState(false);
  // ENG-1642 — "Open in app" only makes sense on a device that can actually
  // resolve `suppr://` (the app's registered scheme, `apps/mobile/app.json`).
  // Mobile is iOS-only right now, so gate on an iOS UA rather than "any
  // mobile" — there's no Android build for `suppr://` to resolve into yet.
  // Starts false so the server-rendered and first client render match
  // (no hydration mismatch); an iOS UA flips it true post-mount. This is
  // the "Open in app" scheme button the ticket's design section calls for —
  // without it, `apps/mobile/app/meal-shared.tsx` (the native accept
  // screen) has no entry point at all: `buildMobileMealShareUrl` always
  // shares an `https://` URL (no universal links / associatedDomains yet,
  // deliberately out of scope), so the only way IN to the native screen is
  // this handoff link.
  const [isIOS, setIsIOS] = React.useState(false);
  const trackedRef = React.useRef(false);

  React.useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/i.test(window.navigator.userAgent));
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      const [lookup, sessionResult] = await Promise.all([
        getMealShare(supabase, token),
        supabase.auth.getSession(),
      ]);
      if (cancelled) return;

      const isAuthed = Boolean(sessionResult.data.session);
      setAuthed(isAuthed);
      setState(
        lookup.status === "ok"
          ? { kind: "ok", payload: lookup.payload }
          : { kind: lookup.status },
      );

      if (!trackedRef.current) {
        trackedRef.current = true;
        track(AnalyticsEvents.meal_share_link_opened, {
          status: lookup.status,
          authed: isAuthed,
        });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const cleanToken = React.useMemo(() => normaliseMealShareToken(token) ?? token, [token]);

  const handleAddToLog = () => {
    // Also stash the token via the pending rail: a stale/expired session
    // mid-hop gets bounced `/home` → `/login` by middleware, which drops the
    // `?mealShare=` query param — the pending rail is what resumes the
    // share after auth lands in that case.
    storePendingMealShare(cleanToken);
    router.push(`/home?mealShare=${encodeURIComponent(cleanToken)}`);
  };

  const handleSignUp = () => {
    storePendingMealShare(cleanToken);
    track(AnalyticsEvents.shared_meal_signup_started, { surface: "meal_share_landing" });
    router.push("/signup");
  };

  const handleLogin = () => {
    storePendingMealShare(cleanToken);
    router.push("/login");
  };

  /** Hands off to the native accept screen via the app's registered
   *  `suppr://` scheme (Expo Router resolves `meal-shared` by file-based
   *  convention — no custom linking config needed). A plain anchor with a
   *  custom-scheme `href` is the standard "open in app" pattern: if the app
   *  isn't installed, the navigation silently no-ops and the user stays on
   *  this page — never an error page or broken tab. */
  const openInAppHref = `suppr://meal-shared?token=${encodeURIComponent(cleanToken)}`;

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl flex-col justify-center">
        {state.kind === "loading" ? <LoadingSkeleton /> : null}
        {state.kind === "invalid" || state.kind === "expired" || state.kind === "revoked" ? (
          <ErrorState copy={ERROR_COPY[state.kind]} />
        ) : null}
        {state.kind === "ok" ? (
          <SharedMealCard
            payload={state.payload}
            authed={authed}
            onAddToLog={handleAddToLog}
            onSignUp={handleSignUp}
            onLogin={handleLogin}
            openInAppHref={isIOS ? openInAppHref : null}
          />
        ) : null}
      </div>
    </main>
  );
}

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading shared meal">
      <span className="h-4 w-40 rounded bg-muted/60 animate-pulse" />
      <span className="h-8 w-64 rounded bg-muted/60 animate-pulse" />
      <span className="h-24 w-full rounded-lg bg-muted/60 animate-pulse" />
    </div>
  );
}

function ErrorState({ copy }: { copy: { title: string; body: string } }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold text-primary-solid">Sloe</p>
      <h1 className="text-3xl font-semibold leading-tight tracking-normal text-foreground">
        {copy.title}
      </h1>
      <p className="text-base leading-7 text-muted-foreground">{copy.body}</p>
    </div>
  );
}

function SharedMealCard({
  payload,
  authed,
  onAddToLog,
  onSignUp,
  onLogin,
  openInAppHref,
}: {
  payload: MealSharePayload;
  authed: boolean;
  onAddToLog: () => void;
  onSignUp: () => void;
  onLogin: () => void;
  /** `null` on non-iOS / when the UA check hasn't resolved yet — no scheme
   *  link renders where it can't do anything. */
  openInAppHref: string | null;
}) {
  const totals = mealShareTotals(payload.items);
  const headline = payload.sharedBy
    ? `${payload.sharedBy} shared a meal`
    : "Someone shared a meal with you";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary-solid">
        <Users className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-primary-solid">{headline}</p>
        <h1 className="text-3xl font-semibold leading-tight tracking-normal text-foreground">
          {payload.title}
        </h1>
        <span className="mt-3 inline-flex items-center rounded-full border border-primary-soft bg-primary-soft px-3 py-1 text-xs font-semibold text-foreground">
          {payload.mealSlot}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
        {payload.items.map((item, i) => (
          <div key={`${item.recipeTitle}-${i}`} className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{item.recipeTitle}</p>
            <p className="text-xs text-muted-foreground">
              {formatMacroTrailer({
                calories: item.calories,
                protein: item.protein,
                carbs: item.carbs,
                fat: item.fat,
                fiber: item.fiberG,
              })}
            </p>
          </div>
        ))}
        <div className="border-t border-border pt-3">
          <p className="text-sm font-semibold text-foreground">{formatMacroTrailer(totals)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {authed ? (
          <Button size="lg" onClick={onAddToLog}>
            Add to my log
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <>
            <Button size="lg" onClick={onSignUp}>
              Join Sloe and add it
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Button>
            <Button size="lg" variant="ghost" onClick={onLogin}>
              I already have an account
            </Button>
          </>
        )}
        {openInAppHref ? (
          <Button size="lg" variant="ghost" asChild>
            <a href={openInAppHref}>
              <Smartphone className="mr-2 h-4 w-4" aria-hidden />
              Open in the Sloe app
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
