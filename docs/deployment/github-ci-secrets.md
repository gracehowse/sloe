# GitHub Actions secrets (CI)

Configure these in the repository: **Settings → Secrets and variables → Actions**.

## Required for full CI parity

| Secret | Purpose |
|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (e.g. `https://xxx.supabase.co`). Baked into the Next.js build. If omitted, the app falls back to `utils/supabase/info.tsx` for local/CI smoke runs. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key. Same fallback behavior as the URL. |

## Optional — authenticated E2E

| Secret | Purpose |
|--------|---------|
| `E2E_EMAIL` | Test user email for Playwright smoke tests that sign in. |
| `E2E_PASSWORD` | Test user password. |

Without `E2E_*`, smoke tests that require a logged-in session may skip or hit login-only flows; middleware and builds still succeed with the Supabase fallback.

## Production / Vercel (not GitHub)

Use your host’s env UI for `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, Stripe keys, etc. See `.env.example` at the repo root.
