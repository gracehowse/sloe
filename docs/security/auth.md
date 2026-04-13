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
1. User visits `/login` — email/password or magic link form
2. On success, `supabase.auth.getSession()` resolves
3. Client-side redirect to `/` — no server middleware
4. `HomeProfileGate` checks if profile is complete, redirects to `/onboarding` if not

**Known gap:** No Next.js middleware. Server components are not protected. There is a brief flash before client-side redirect.

### Mobile Auth Flow
1. User opens app — `AuthProvider` calls `getSession()` and `onAuthStateChange()`
2. If no session, root layout redirects to `/login`
3. Login screen offers email/password, magic link, Apple Sign-In
4. On success, checks `profiles.onboarding_completed` — routes to `/onboarding` or `/(tabs)`
5. Apple Sign-In uses `expo-apple-authentication` → `signInWithIdToken` against Supabase

## Row-Level Security (RLS)

All tables have RLS enabled. Key policies:

| Pattern | Tables | Rule |
|---------|--------|------|
| Own data only | profiles, saves, follows, meal_plans, nutrition_journals, shopping_lists | `auth.uid() = user_id` |
| Public read | recipes, recipe_ingredients, creators, ingredients, foods, food_sources | `true` for SELECT |
| Author write | recipes, recipe_ingredients | `auth.uid() = author_id` |
| No direct read | promo_codes, food_reports, recipe_plan_add_events | Access only via SECURITY DEFINER functions |

## API Security

| Route | Auth Required | Rate Limit |
|-------|-------------|------------|
| `/api/recipe-import` | No | 20/min/IP |
| `/api/nutrition/verify-recipe` | No | 10/min/IP |
| `/api/usda/search` | No | 60/min/IP |
| `/api/usda/food` | No | 60/min/IP |
| `/api/stripe/checkout` | Yes (Bearer token) | None |
| `/api/stripe/webhook` | Stripe signature | None |

**Rate limiting:** Upstash Redis in production, in-memory fallback in dev. In-memory is per-instance only — not distributed.

## Data Protection

- Supabase anon key is intentionally public (client-side)
- Service role key is server-side only (`.env.local`, never committed)
- All user data scoped by RLS — even with anon key, users can only read their own data
- Stripe webhook verification uses `STRIPE_WEBHOOK_SECRET` signature check
- No PII is logged beyond email addresses in auth

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [Data Schema](../data/schema.md)
