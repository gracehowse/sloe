# Package manager (this repo)

**Source of truth: npm** with root `package-lock.json` and `apps/mobile/package-lock.json`.

- Install from the repo root: `npm ci` (CI) or `npm install` (local).
- Mobile-only work: `cd apps/mobile && npm ci`.

## Why not pnpm / Yarn here

The monorepo is wired for **npm workspaces-style scripts** (`npm run mobile:dev`, `--prefix apps/mobile`) and GitHub Actions cache paths that point at `package-lock.json`. Introducing another lockfile without a deliberate migration would split installs and break CI caching.

If you add `pnpm.overrides` or document pnpm elsewhere, **do not** remove npm lockfiles until CI, Vercel, and mobile E2E are migrated and this file is updated.
