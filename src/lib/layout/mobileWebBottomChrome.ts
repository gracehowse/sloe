/**
 * ENG-1376 / ENG-1323 / ENG-1386 — single source of truth for mobile-web
 * bottom chrome measurements.
 *
 * The fixed tab bar (~57px content) plus the raised centre Log button
 * (`relative -top-4`, 16px projection) reserves `5rem` (80px) of scroll
 * clearance. `CookieConsent` docks above that bar on authed product routes
 * — never over it.
 */
export const MOBILE_WEB_BOTTOM_NAV_INSET = "5rem";

/** Slim single-line consent strip height (py-2 + one-line copy + buttons). */
export const MOBILE_WEB_CONSENT_BANNER_INSET = "3rem";

/** CSS custom property written by `CookieConsent` when the strip is visible. */
export const COOKIE_CONSENT_SCROLL_INSET_VAR = "--cookie-consent-scroll-inset";

/**
 * CSS custom property written by `CookieConsent` when the strip is
 * TOP-anchored (marketing routes, ENG-802) and visible — its live-measured
 * height, so `.lp-nav` (landing.css) can push its `sticky` offset down by
 * that amount instead of sitting underneath the banner at the same `top: 0`.
 * Before this existed, `.lp-nav`'s `z-index: 50` beat the banner's `z-40` at
 * the identical top-0 position, so its "Get started" link intercepted every
 * click meant for the banner's own buttons — confirmed via the chromatic
 * landing capture, 2026-07-21.
 */
export const COOKIE_CONSENT_TOP_INSET_VAR = "--cookie-consent-top-inset";

/** Tailwind arbitrary-value fragments — keep App + banner in sync. */
export const MOBILE_WEB_BOTTOM_NAV_SCROLL_PADDING = `pb-[calc(${MOBILE_WEB_BOTTOM_NAV_INSET}+var(${COOKIE_CONSENT_SCROLL_INSET_VAR},0px)+env(safe-area-inset-bottom))]`;

export const MOBILE_WEB_BOTTOM_NAV_SCROLL_PADDING_BOTTOM = `scroll-pb-[calc(${MOBILE_WEB_BOTTOM_NAV_INSET}+var(${COOKIE_CONSENT_SCROLL_INSET_VAR},0px)+env(safe-area-inset-bottom))]`;

export const MOBILE_WEB_CONSENT_DOCK_BOTTOM = `bottom-[calc(${MOBILE_WEB_BOTTOM_NAV_INSET}+env(safe-area-inset-bottom))]`;

/** First path segment for any authed product surface that renders bottom nav. */
const PRODUCT_APP_SEGMENTS = new Set([
  "today",
  "plan",
  "shopping",
  "library",
  "recipes",
  "progress",
  "settings",
  "profile",
  "recipe",
  "discover",
  "create",
  "import",
  "home",
  "targets",
  "notifications",
  "plan-import",
]);

export function isMobileWebProductRoute(pathname: string): boolean {
  const seg = pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
  return PRODUCT_APP_SEGMENTS.has(seg);
}
