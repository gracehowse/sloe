# Mobile Storybook role catalog (ENG-1664)

Per-role stories for the mobile design system, rendered in the **same** root
Storybook / Chromatic pipeline as web (`npm run storybook`).

## Why roles, not screens

Each file under `roles/` documents one **UI role** — when to use it, when not,
and the canonical primitive. This is the answer to "what's the difference
between these two cards?" without opening production screens.

## Roles

| Role | Primitive / fixture |
|------|---------------------|
| Card | `SupprCard` (`size="card"`) |
| InsetPanel | `SupprCard` (`size="inset"`) |
| Notice | `ImplausibleMacrosNotice` |
| Sheet | `SheetChromeFixture` (chrome only — feature sheets stay per-flow) |
| CommitPill | `SupprButton` `variant="primary"` |
| GhostPill | `SupprButton` `variant="ghost"` |
| Chip | `FilterChip` |
| AddRow | `AddRowButton` |
| IconButton | `IconButtonFixture` (catalog until shared primitive ships) |
| CountBadge | `CountBadgeFixture` (catalog until shared primitive ships) |

## States

Every interactive role ships **rest**, **pressed** (play interaction), **disabled**,
and **loading** where the primitive supports it. **Light / dark** via the
Storybook theme toolbar (`@storybook/addon-themes`).

## RN-web wiring

- Stories glob: `.storybook/main.ts` → `apps/mobile/stories/**/*.stories.tsx`
- Vite: `.storybook/mobile-vite.ts` (`vite-plugin-rnw`, mobile `@/` resolver,
  `expo-haptics` + AsyncStorage stubs)
- Theme: `stories/_fixtures/storybook-theme.tsx` (sync provider — no boot gate)

## Commands

```bash
npm run storybook
npm run build-storybook
npx vitest run --config vitest.config.ts apps/mobile/stories
npm run chromatic:storybook   # manual Chromatic upload
```

Follow-on (separate PR): on-device Storybook entry in the Expo dev client.
