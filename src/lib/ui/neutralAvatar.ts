/**
 * Neutral avatar placeholder used when a user, creator, or recipe author has
 * no profile image. Self-contained SVG encoded as a data URI so it does not
 * depend on any external image host and cannot depict a real person — which
 * avoids the right-of-publicity risk (Cal. Civ. § 3344, Lanham § 43(a)) of
 * showing a stock-photo face of a model as the default avatar of a paid app.
 *
 * Leaf module: no `@/…` imports, no Next-only or React-Native-only deps, so
 * both the web app and the React Native app can import it directly.
 */
export const NEUTRAL_AVATAR_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 80'>" +
      "<circle cx='40' cy='40' r='40' fill='#e5e7eb'/>" +
      "<circle cx='40' cy='32' r='14' fill='#9ca3af'/>" +
      "<path d='M12 72c4-14 14-22 28-22s24 8 28 22' fill='#9ca3af'/>" +
      "</svg>",
  );
