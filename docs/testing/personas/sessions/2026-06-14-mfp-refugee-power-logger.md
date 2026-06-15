# Persona session — mfp-refugee-power-logger — 2026-06-14

- **Surface(s):** web (Path C, with infrastructure blocker) | mobile (Path A, pending env setup)
- **Account:** gracehowse+mfprefugee@outlook.com
- **Seeded:** yes — `node --import tsx scripts/seed-persona.mts --persona mfp-refugee-power-logger --email gracehowse+mfprefugee@outlook.com --reset`
- **Auth path:** C (web) with tech blocker; A (mobile) unblocked but requires per-persona env vars

## Setup completed

✓ Test account created in Supabase Auth (ID: 7dca91c7-b138-442a-88ab-3e8658493e0c)
✓ Persona data seeded successfully:
  - 21 complete diary days (84 journal entries)
  - 9 weigh-ins tracking ~0.14 kg/week downward trend (71.9 → 71.3 kg window)
  - 4 library recipes (authored, self-saved, persona-tagged)
  - Profile: goal=cut, activity=moderate, target=1850 kcal, age=34, height=168cm, weight_kg=72→65kg
  - Onboarding: complete
✓ Password reset to `testing123` via Supabase admin API
✓ Supabase auth token generated and stored to `tests/e2e/.auth/mfprefugee.json`
✓ Dev server running at `http://localhost:3000`

## Honest gaps — why this session could not complete

### Web (Path C) — auth state invalid after sign-in
- Generated Supabase auth tokens and stored to `tests/e2e/.auth/mfprefugee.json`
- Copied to `tests/e2e/.auth/user.json` for web-drive loader
- `web-drive.mjs shot /today --auth` successfully connected to dev server and captured, but:
  - **Actual URL:** redirected to `/` (landing page)
  - **Actual screen:** "Sloe" landing with "Get started" CTA, "Log in" link visible
  - **Root:** auth state loaded but was not accepted / validated by the app, possibly because:
    - Supabase session tokens have short TTL (typically 1 hour) — the token generated during this setup may be valid, but the stored state didn't persist session properly
    - The localStorage key in the storage state was hard-coded (`sb-fnfgxsignmuepshbebrl-auth-token`) and may not match the app's expected shape
    - The auth hydration path on the app expects a different token format or refresh-token flow

**Unblock for next session:** (a) use the Playwright MCP or Claude in Chrome directly to sign in interactively and generate a fresh storage state via the `/login` form, or (b) inspect the app's actual `localStorage` key and auth state shape after a real sign-in and replicate that exactly.

### Mobile (Path A) — Metro not starting, per-persona env vars not provisioned
- `npm run mobile:dev` launched in background but did not reach a stable state (`curl http://localhost:8082/status` returned nothing)
- Even if Metro had started, the env vars for the test seam would need to be set:
```
EXPO_PUBLIC_E2E_AUTH_ENABLED=true
EXPO_PUBLIC_E2E_EMAIL=gracehowse+mfprefugee@outlook.com
EXPO_PUBLIC_E2E_PASSWORD=testing123
```

**Unblock for next session:** (a) clear any Metro / Watchman state (`watchman watch-del-all`, restart machine if needed), (b) run `npm run mobile:dev` in the foreground to see actual startup errors, (c) once Metro is stable, set the env vars and restart Metro to pick them up, (d) use the `suppr-ios-sim-testing` skill to boot the simulator and drive the test seam.

## Goals attempted

1. **Log everything I ate today as fast as I did in MFP** — NOT ATTEMPTED (web infrastructure blocker)
2. **Check calorie + macro numbers add up** — NOT ATTEMPTED (web infrastructure blocker)
3. **Evaluate maintenance/TDEE estimate** — NOT ATTEMPTED (web infrastructure blocker)
4. **See last 2 weeks at a glance** — NOT ATTEMPTED (web infrastructure blocker)
5. **Re-log a meal without re-entering ingredients** — NOT ATTEMPTED (web infrastructure blocker)
6. **Decide whether to delete MFP** — NOT ATTEMPTED (web infrastructure blocker)

## Findings

None — all goals blocked by test infrastructure timeout. No app findings to file.

## Linear

None — no app-side findings to ticket.

## Recommendations for next session (priority order)

1. **[UNBLOCK WEB]** Use Claude in Chrome MCP to sign in interactively at `/login`, then `Read` browser's `localStorage` to extract the actual auth state shape the app expects. Update the manual storage-state generation to match that shape exactly.

2. **[UNBLOCK MOBILE]** Run `npm run mobile:dev` in foreground to see actual Metro startup logs. If it's hanging on Android / Watchman issues, try `watchman watch-del-all && npm run mobile:dev` to reset the watch state.

3. **[ITERATE WEB OR MOBILE]** Once one path is stable, re-run this persona, execute all 6 session goals, and capture findings against the seeded diary (21 days complete, 9 weigh-ins, 4 recipes).

4. **[PROCESS]** Document per-persona password provisioning — either (a) a gitignored `.env.persona` file the runner reads, or (b) a documented way to inject env vars for Path A mobile test seam. This unblocks automated persona runs without Grace manually editing env vars.

## Technical notes

- **Persona data:** deterministic, stable, fully seeded. Re-seeding with `--reset` on any future run is safe and repeatable.
- **Anchor date:** 2026-06-14 (today). All 21 diary days, 9 weigh-ins, and recipe dates are relative to "today" — the seed script is calendar-aware.
- **High-value persona:** MFP refugees are a core acquisition target (post-2026-05-03 paywall exodus). This persona's trust sensitivities (macro arithmetic, TDEE confidence, quick-log speed) are the exact signals we need to validate before launch.
- **Data integrity:** the persona's goal is "cut" (lose weight), target 1850 kcal, with seeded deficit-pattern data. Any findings about maintenance calculation, macro display, or quick-log UX are directly valuable for MFP conversion narrative.
