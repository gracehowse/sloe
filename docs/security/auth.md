# Security & Authentication

**Audience:** Developers / Internal

## Authentication

### Methods

| Method | Web | Mobile |
|--------|-----|--------|
| Email + password | Yes | Yes |
| Magic link (OTP email) | Yes | Yes |
| Apple Sign-In | No | Yes (iOS only) |
| Google Sign-In | No | No |
| Password reset | Yes | Yes |

### Implementation

- **Provider:** Supabase Auth (wraps GoTrue)
- **Session storage:** Supabase JS SDK manages JWTs automatically
- **Token refresh:** Mobile proactively refreshes when app comes to foreground if token expires within 5 minutes

### Web Auth Flow
1. Unauthenticated visitors at `/` see the marketing **landing page** (`app/(landing)/LandingPage.tsx`); every CTA deep-links into `/login?mode=signup` or `/login?mode=signin`
2. User visits `/login` — email/password or magic link form
3. On success, `supabase.auth.getSession()` resolves and `window.location.href = "/"` reloads `/`; the server component now sees a session and renders the authenticated `HomePageClient`
4. Next.js middleware (`middleware.ts`) refreshes the auth token cookie and redirects unauthenticated users to `/login` for all non-public routes
5. `HomeProfileGate` checks if profile is complete, redirects to `/onboarding` if not

**`/` routing:** `app/page.tsx` is a server component that reads the Supabase session via `cookies()`. No session → `<LandingPage />`; session present → `<HomePageClient />` (the authenticated app). The middleware keeps `/` in `PUBLIC_ROUTES` so unauthenticated users are not redirected to `/login` before the landing renders.

**Public routes (bypass middleware auth):** `/`, `/login`, `/signup`, `/roadmap`, `/auth/callback`, `/help`, `/pricing`, `/privacy`, `/terms`, `/reset-password`, all `/api/*` routes (APIs handle their own auth), and static assets.

### Mobile Auth Flow
1. User opens app — `AuthProvider` calls `getSession()` and `onAuthStateChange()`
2. If no session, root layout redirects to `/login`
3. Login screen offers email/password, magic link, Apple Sign-In
4. On success, checks `profiles.onboarding_completed` — routes to `/onboarding` or `/(tabs)`
5. Apple Sign-In uses `expo-apple-authentication` → `signInWithIdToken` against Supabase

**Ops / local:** Apple provider secret for **hosted** projects lives in the Supabase Dashboard. For **`supabase start`**, set `SUPABASE_AUTH_EXTERNAL_APPLE_SECRET` in `supabase/.env` (see [`docs/environment.md`](../environment.md#supabase-cli-local-stack-supabase-start) and `supabase/.env.example`).

### Onboarding signup is session-gated (ENG-672, 2026-05-26)

The signup step inside onboarding (`steps/signup.tsx` on both platforms)
**cannot be advanced past without a real Supabase session.** The shared
validator `canAdvance("signup", …)` returns `true` only when the flow shell
passes `hasSession: true` (web `authedUserId != null`; mobile
`session?.user?.id != null`), and the footer Continue is suppressed on this
step on both platforms. This prevents a user completing onboarding
unauthenticated and losing every answer on a `/login` bounce. Mobile is
Apple-Sign-In-only here (no email path built yet); web keeps its email
signUp form but only advances once a session lands (confirm-email mode shows
a "check your email" interstitial). On a defence-in-depth unauthenticated
terminal-step state, both platforms return the user to the signup step with
answers intact rather than discarding them. Decision:
[`docs/decisions/2026-05-26-onboarding-signup-session-gate.md`](../decisions/2026-05-26-onboarding-signup-session-gate.md).

## Row-Level Security (RLS)

All tables have RLS enabled. Key policies:

| Pattern | Tables | Rule |
|---------|--------|------|
| Own data only | profiles, saves, follows, meal_plans, nutrition_journals, shopping_lists | `auth.uid() = user_id` |
| Own data delete | profiles | `auth.uid() = id` (users can delete their own profile) |
| Published + own | recipes | `published = true OR auth.uid() = author_id` for SELECT |
| Public read | recipe_ingredients, creators, ingredients, foods, food_sources | `true` for SELECT |
| Author write | recipes, recipe_ingredients | `auth.uid() = author_id` |
| No direct read | promo_codes, food_reports, recipe_plan_add_events | Access only via SECURITY DEFINER functions |

## API route reference

**Canonical detail** for every `app/api/**/route.ts` handler — methods, status codes, tier gates, cron headers, env vars — lives in **[API endpoints — Route index](../api/endpoints.md#route-index)**. Prefer updating that file over duplicating tables here.

## API Security (auth-sensitive routes)

This table lists only **non-standard** or **high-risk** patterns (cron secret, webhooks, service-role fan-out, tier gates, origin checks). Bearer-only routes with standard session checks are documented in the index above.

| Route / pattern | Auth / verification | Notes |
|-----------------|---------------------|--------|
| `/api/push/weekly-recap` | `X-Cron-Secret` = `SUPPR_CRON_SECRET` | No user JWT; service-role reads `profiles` |
| `/api/stripe/webhook` | Stripe `Stripe-Signature` | Uses `STRIPE_WEBHOOK_SECRET` |
| `/api/account/delete` | Bearer + **`assertOrigin`** | Service-role deletes; see [endpoints](../api/endpoints.md#account) |
| `/api/nutrition/voice-log`, `/api/nutrition/photo-log` | Bearer + **Pro tier** | `403` `upgrade_required` for Free/Base |
| `/api/recipe-import/image` | Bearer + tier ≠ `free` | `403` `pro_required` |
| `/api/household` `POST`, `/api/household/join`, `/api/household/leave`, `/api/household/meals` | Bearer; some use **`assertOrigin`** | Server uses service-role client scoped to session user — see [endpoints § Household](../api/endpoints.md#household) |
| `/api/user-foods`, `/api/user-foods/vote` | Bearer | Service-role for catalog reads/writes |

**Rate limiting:** Upstash Redis in production, in-memory fallback in dev. In-memory is per-instance only — not distributed. Per-route limits (IP prefix, user id, etc.) are specified in [endpoints](../api/endpoints.md#route-index).

## Data Protection

- Supabase anon key is intentionally public (client-side)
- Service role key is server-side only (`.env.local`, never committed)
- All user data scoped by RLS — even with anon key, users can only read their own data
- Stripe webhook verification uses `STRIPE_WEBHOOK_SECRET` signature check
- No PII is logged beyond email addresses in auth

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [Data Schema](../data/schema.md)
