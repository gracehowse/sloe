# Rebrand checklist: Suppr

Product: **Suppr** (Suppr Ltd). Public site: **supprclub.com**. App Store subtitle: **Suppr — Recipes. Plan. Shop. Track.**

This repo is rebranded in code and docs. **You still need to update external systems** to match.

## GitHub

- Rename the repository (Settings → General → Repository name) if it still uses the old name.
- Update the remote locally: `git remote set-url origin <new-url>`.
- Refresh any CI badges, branch protection notes, or links in other repos.

## Apple Developer & App Store Connect

- **Bundle / application ID** in `apps/mobile/app.json` is **`com.supprclub.suppr`** for both `ios.bundleIdentifier` and `android.package`. It must match Apple Developer, App Store Connect, and Google Play after prebuild. If the portal still uses another id, either migrate the app id or align `app.json` and regenerate native projects (`npx expo prebuild --clean --platform ios` / `android`).
- **Associated domains / universal links** and **Sign in with Apple**: update Services IDs and redirect URLs if they referenced the old app name or bundle id.
- **App Store listing**: name, subtitle, description, keywords, screenshots, support URL (**supprclub.com** or your chosen support path).

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

All localStorage keys now use the `suppr-*` prefix. Rebrand complete.

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
