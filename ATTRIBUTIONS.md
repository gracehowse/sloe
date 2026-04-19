# Attributions

Suppr is built on the work of open-source contributors and the maintainers of public food-data databases.

The full, user-facing attribution and licence list ships at [**/licences**](https://suppr-club.com/licences) inside the product. The points below summarise the obligations we meet there.

## Software

- **Open-source dependencies** — MIT / BSD / ISC / Apache-2.0 licences dominate the dependency tree; notice-bearing packages (`caniuse-lite` CC-BY-4.0, `lightningcss` MPL-2.0, `@expo/vector-icons` MIT / OFL / CC-BY-4.0) are credited in `app/licences/page.tsx`. A full machine-readable list can be generated with `npx license-checker --production --json`.
- **shadcn/ui** patterns are used under the [MIT licence](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).
- **Inter** is used via `next/font/google` under the SIL Open Font License 1.1.

## Data

- **USDA FoodData Central** — public-domain data from the U.S. Department of Agriculture. USDA does not endorse Suppr.
- **Open Food Facts** — product data © Open Food Facts contributors, provided under the [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
- **Edamam** — restaurant and branded-food nutrition data under the Edamam Food Database API commercial terms. Food-search results that come from Edamam are *Powered by Edamam*.
- **FatSecret Platform API** — food and nutrition database under FatSecret Platform commercial terms.

## Images

- Historical: seed placeholder imagery used during development was sourced from [Unsplash](https://unsplash.com) under the [Unsplash Licence](https://unsplash.com/license). Default user / creator avatars are now rendered as a self-hosted neutral silhouette SVG (see `src/lib/ui/neutralAvatar.ts`) to avoid any right-of-publicity concerns in using real-person photography as defaults.

## Trademarks

All product and company names mentioned in Suppr are trademarks of their respective owners. Mention does not imply partnership, sponsorship, or endorsement. See [/licences](https://suppr-club.com/licences) for the full list.
