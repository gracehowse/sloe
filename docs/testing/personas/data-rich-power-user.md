# data-rich-power-user

**Not a behavioural session persona.** This is Grace's standing **data-rich test
account** — a kitchen-sink user that maxes every dimension at once so the
everything-populated state can be eyeballed on web + sim. Use it for manual QA,
visual conformance (ENG-1247 Sloe v3), and screenshotting populated surfaces;
use the other five personas for scripted RUNNER sessions.

## Seeded shape

| Dimension | Value |
|---|---|
| History | 28 days — **today is partial** (breakfast only, ~426 kcal) so the live Today ring shows a realistic mid-day state; the prior 27 days are complete |
| Journal entries | ~109 |
| Weigh-ins | 22 (near-daily), trending −0.025 kg/day from 74.0 → goal 66 |
| Library recipes | 16 imported recipes (mixed provenance: Reels, TikTok, pasted links, cookbook scans) |
| Profile | cut · moderate · female · 32 · 167 cm · **1,900 kcal** (145 P / 175 C / 63 F) · onboarded |

Defined in `scripts/_lib/personaSeed.ts` (`PERSONAS["data-rich-power-user"]`);
guarded by `tests/unit/personaSeed.test.ts`.

## Account + access

- **Account:** `gracehowse+test@outlook.com` (allowlisted test inbox).
- **Web:** sign in at the web app with `gracehowse+test@outlook.com` /
  `testing123` (the repo `E2E_PASSWORD` convention).
- **iOS sim:** the account's Supabase session is injected directly into the
  dev-client AsyncStorage (`sb-fnfgxsignmuepshbebrl-auth-token`). The previous
  account's session is backed up alongside it as
  `…ec91504e…gracemturner.bak` — restore that file (or just re-do Apple Sign
  In) to return the sim to the real `gracemturner` account.

## (Re)seed

```bash
node --import tsx scripts/seed-persona.mts \
  --persona data-rich-power-user --email gracehowse+test@outlook.com [--reset]
```

`--reset` wipes only this account's persona-tagged rows first. The seeder
refuses to run against any non-allowlisted email and hard-blocks the two real
daily-driver accounts.
