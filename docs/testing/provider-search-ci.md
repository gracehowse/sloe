# Food search provider smoke — CI (F-05)

Live HTTP smoke for `/api/fatsecret/search`, `/api/usda/search`, and `/api/edamam/search` via [`tests/unit/foodSearchProviderIntegration.test.ts`](../../tests/unit/foodSearchProviderIntegration.test.ts).

## Behaviour

| Env present | CI step | Local |
|-------------|---------|-------|
| No `SUPPR_TEST_AUTH_BEARER` | Step **skipped** — unit suite stays green | Tests `skipIf` — no live calls |
| Bearer + provider keys | Runs after E2E against `http://127.0.0.1:3100` | Same |

Routes require session auth; the bearer must be a valid Clerk/session token for a test account.

## Repository secrets (GitHub → Settings → Secrets → Actions)

| Secret | Required for smoke |
|--------|-------------------|
| `SUPPR_TEST_AUTH_BEARER` | **Yes** — gates the optional CI step |
| `FATSECRET_CLIENT_ID` | FatSecret test |
| `FATSECRET_CLIENT_SECRET` | FatSecret test |
| `USDA_FDC_API_KEY` | USDA test |
| `EDAMAM_APP_ID` | Edamam test |
| `EDAMAM_APP_KEY` | Edamam test |

## Local run

```bash
npm run dev   # or npm run start -- --port 3000
export SUPPR_TEST_API_BASE=http://127.0.0.1:3000
export SUPPR_TEST_AUTH_BEARER="<session-token>"
# plus FATSECRET_*, USDA_FDC_API_KEY, EDAMAM_* from .env.local
npm run test -- --run tests/unit/foodSearchProviderIntegration.test.ts
```

## Workflow

Optional step in [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) — `Food search provider smoke (optional — F-05)`.
