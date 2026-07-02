# Rebrand checklist: Suppr → Sloe

Product: **Sloe** (mid-flight rebrand from Suppr, 2026-06). Live domain: **getsloe.com** (legacy **suppr-club.com** still serves). Not yet incorporated — "Suppr Ltd" was aspirational, see `docs/planning/ip-followups-2026-04-19.md`.

## Status (2026-07-01, ENG-1298 stale-brand sweep)

**The user-facing brand is Sloe; the plumbing is still suppr.** Current reality:

- **Sloe (live):** wordmark on web + mobile, all user-facing product copy, page
  titles/metadata, legal pages (terms / privacy / dmca / licences), paywall
  ("SLOE PRO"), share/notification strings, `getsloe.com` mailboxes
  (support@ / privacy@ / dmca@ / legal@). Guarded by
  `tests/unit/brandDriftSloe.test.ts`.
- **Still suppr (intentional, infra not brand):** bundle id
  `com.supprclub.supprapp`, URL scheme `suppr://`, `@suppr/shared` +
  `@suppr/nutrition-core` package aliases, `suppr-*` localStorage keys,
  `suppr-club.com` legacy domain/links, `Suppr*` component export names,
  DB-canonical source value `"Suppr"` (CHECK-constraint pinned; remapped to
  "Sloe" at display via `src/lib/nutrition/sourceLabel.ts` and
  `src/lib/recipes/displayAttribution.ts`), the recipe crawler UA `SupprBot`,
  and the `Suppr.storekit` file identifier/Xcode scheme.
- **Dashboard-side renames still owed (Grace):** App Store Connect
  subscription-group display name "Suppr Pro" → "Sloe Pro" (repo `.storekit`
  test configs already renamed), App Store listing name/subtitle, Stripe
  Customer Portal branding, PostHog / Sentry project names (cosmetic).

**You still need to update external systems** to match.

## GitHub

- Rename the repository (Settings → General → Repository name) if it still uses the old name.
- Update the remote locally: `git remote set-url origin <new-url>`.
- Refresh any CI badges, branch protection notes, or links in other repos.

## Apple Developer & App Store Connect

- **Bundle / application ID** in `apps/mobile/app.json` is **`com.supprclub.suppr`** for both `ios.bundleIdentifier` and `android.package`. It must match Apple Developer, App Store Connect, and Google Play after prebuild. If the portal still uses another id, either migrate the app id or align `app.json` and regenerate native projects (`npx expo prebuild --clean --platform ios` / `android`).
- **Associated domains / universal links** and **Sign in with Apple**: update Services IDs and redirect URLs if they referenced the old app name or bundle id.
- **App Store listing**: name, subtitle, description, keywords, screenshots, support URL (**getsloe.com** or your chosen support path).

## Vercel & hosting

- Rename the Vercel project if desired; update any hardcoded API URLs in `app.json` `extra` (`supprApiUrl`, `supprWebUrl`) when the backend moves off legacy hosts.

## Supabase & OAuth

- Auth provider redirect URLs and any **custom scheme** callbacks: **`suppr://`** only.
- Email templates and auth email “from” branding if they mention the old name.

## Analytics & third parties

- PostHog / Sentry project names and release tracking (cosmetic but helps operators).
- Stripe Customer Portal and product copy if it still says the old brand.

## Local dev (mobile)

- Tunnel script log: `/tmp/suppr-expo-tunnel.log`.
- Optional env: **`SUPPR_KEEP_METRO=1`**.

## Storage keys (web) — intentional legacy

All localStorage keys use the `suppr-*` prefix. Intentionally kept through the
Sloe rebrand — renaming would orphan existing users' local state for zero
user-visible gain. Not a gap.

## Package names

- Root `package.json` **name**: `suppr`.
- Mobile workspace: `suppr-mobile`.

## Brand mark / icons

**Sloe mobile (Today header, app icon, splash, launch screen):** Newsreader wordmark via:

```bash
npm run build:brand-icons
```

That runs `scripts/render-sloe-brand-png.mjs` (PNG + `docs/brand/sloe/assets/logo-wordmark-sloe-*.svg`) and `npm run sync-ios-brand --prefix apps/mobile`. Rebuild the iOS dev client after changing icons. Do **not** rasterize path-outline SVGs (`scale(0.13 -0.13)` in `wordmark-lockup.svg`) — they export upside-down in sharp.

**Legacy Suppr web PWA:** `public/suppr-mark.svg` and `npm run build:icons` (web PNGs only when that file exists).

Outputs (Sloe): `apps/mobile/assets/images/{icon,favicon,splash-icon,android-icon-*}.png`, `ios/Suppr/Images.xcassets/*`.
