/**
 * ENG-828 — `text-primary` on a `bg-primary/N` tint WCAG AA contrast census.
 *
 * The defect: a chip/badge/pill that fills with the primary soft tint
 * (`bg-primary/10`) and inks its label/icon with `text-primary`. Tailwind's
 * `text-primary` maps to `--primary` — the primary *fill* hue (`#3B2A4D` light
 * / `#7E5C92` dark). On the LIGHT card the deep-plum fill is dark enough to
 * pass as small text (~10.8:1), but on the DARK card the lifted fill `#7E5C92`
 * reads only ~2.8:1 on its own tint — WCAG AA FAIL (and below the 3:1
 * graphical bar for an icon-in-disc, too).
 *
 * The fix (mirrors the macro `-solid` discipline from ENG-1109/1217): ink the
 * label/icon with `text-primary-solid` → `--primary-solid` (`#3B2A4D` light /
 * `#C4ACD0` dark). Light is a pixel-identical no-op (`--primary` ===
 * `--primary-solid` in `:root`); dark lifts the text to an AA-safe hue.
 *
 * This guard computes real WCAG 2.x ratios off `src/styles/theme.css` and the
 * mobile `apps/mobile/constants/theme.ts`, and pins the canonical call sites so
 * the class can't silently regress back to the bare fill hue.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const THEME_CSS = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");
const MOBILE_THEME = readFileSync(
  resolve(ROOT, "apps/mobile/constants/theme.ts"),
  "utf8",
);
const WEB_BADGE = readFileSync(
  resolve(ROOT, "src/app/components/suppr/badge.tsx"),
  "utf8",
);
const WEB_ICON_BOX = readFileSync(
  resolve(ROOT, "src/app/components/ui/icon-box.tsx"),
  "utf8",
);
const MOBILE_BADGE = readFileSync(
  resolve(ROOT, "apps/mobile/components/Badge.tsx"),
  "utf8",
);
const MOBILE_HOUSEHOLD_BAR = readFileSync(
  resolve(ROOT, "apps/mobile/components/HouseholdBar.tsx"),
  "utf8",
);
const MOBILE_PORTION_PICKER = readFileSync(
  resolve(ROOT, "apps/mobile/components/PortionPicker.tsx"),
  "utf8",
);
const MOBILE_STREAK_PIP = readFileSync(
  resolve(ROOT, "apps/mobile/components/today/StreakPip.tsx"),
  "utf8",
);

const AA_NORMAL = 4.5;
const GRAPHICAL = 3;

type RGB = [number, number, number];

function block(selector: ":root" | ".dark"): string {
  const needle = selector === ":root" ? ":root {" : "\n.dark {";
  const idx = THEME_CSS.indexOf(needle);
  const open = THEME_CSS.indexOf("{", idx);
  let depth = 1;
  let i = open + 1;
  while (i < THEME_CSS.length && depth > 0) {
    const ch = THEME_CSS[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return THEME_CSS.slice(open + 1, i - 1);
}

function readCssVar(blockSrc: string, name: string): string {
  const m = blockSrc.match(new RegExp(`--${name}:\\s*([^;]+);`));
  expect(m, `--${name}`).not.toBeNull();
  let value = m![1].trim().toLowerCase();
  const varRef = value.match(/^var\(--([^)]+)\)$/);
  if (varRef) value = readCssVar(blockSrc, varRef[1]);
  return value;
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function composite(fg: RGB, alpha: number, bg: RGB): RGB {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

function relativeLuminance([r, g, b]: RGB): number {
  const lin = (c8: number) => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: string | RGB, b: string | RGB): number {
  const la = relativeLuminance(typeof a === "string" ? hexToRgb(a) : a);
  const lb = relativeLuminance(typeof b === "string" ? hexToRgb(b) : b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Tint fill: ink hue at `pct`% alpha composited over the card. */
function tint(inkHex: string, pct: number, cardHex: string): RGB {
  return composite(hexToRgb(inkHex), pct / 100, hexToRgb(cardHex));
}

function readMobile(key: string, literal = "Accent"): string {
  const start = MOBILE_THEME.indexOf(`export const ${literal}`);
  expect(start, `${literal} literal`).toBeGreaterThanOrEqual(0);
  const slice = MOBILE_THEME.slice(start, start + 2500);
  const m = slice.match(new RegExp(`\\b${key}:\\s*'([^']+)'`));
  expect(m, `${literal}.${key}`).not.toBeNull();
  return m![1].toLowerCase();
}

// The tint percentages ENG-828 call sites actually use across chips/badges/
// pills: 5 / 8 / 10 / 15 / 20.
const TINT_PCTS = [5, 8, 10, 15, 20] as const;

describe("ENG-828 — WHY the fix exists: bare `text-primary` fails on its tint in dark", () => {
  it("light: `text-primary` (fill hue) passes AA on its own tint (deep plum is dark enough)", () => {
    const light = block(":root");
    const ink = readCssVar(light, "primary");
    const card = readCssVar(light, "card");
    for (const pct of TINT_PCTS) {
      expect(ratio(ink, tint(ink, pct, card)), `light text-primary on /${pct}`)
        .toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it("dark: bare `text-primary` (lifted fill) FAILS AA on its own tint — the regression class", () => {
    const dark = block(".dark");
    const ink = readCssVar(dark, "primary"); // #7E5C92 lifted fill
    const card = readCssVar(dark, "card");
    for (const pct of TINT_PCTS) {
      // Documents the defect: each of these is < 4.5 (and < 3 graphical).
      expect(ratio(ink, tint(ink, pct, card)), `dark text-primary on /${pct}`)
        .toBeLessThan(AA_NORMAL);
    }
    // The loudest tint still fails even the 3:1 graphical bar (icon-in-disc).
    expect(ratio(ink, tint(ink, 20, card))).toBeLessThan(GRAPHICAL);
  });
});

describe("ENG-828 — the fix: `text-primary-solid` clears AA on the tint in BOTH schemes", () => {
  it.each([":root", ".dark"] as const)(
    "%s: `text-primary-solid` passes AA-normal on bg-primary/{5..20} + on the card",
    (scheme) => {
      const b = block(scheme);
      const ink = readCssVar(b, "primary-solid");
      const fill = readCssVar(b, "primary"); // tint is built from the FILL hue
      const card = readCssVar(b, "card");
      for (const pct of TINT_PCTS) {
        expect(
          ratio(ink, tint(fill, pct, card)),
          `${scheme} text-primary-solid on /${pct}`,
        ).toBeGreaterThanOrEqual(AA_NORMAL);
      }
      // also legible as small text directly on the card (covers the
      // on-card CTAs the sweep also routed to -solid).
      expect(ratio(ink, card), `${scheme} text-primary-solid on card`)
        .toBeGreaterThanOrEqual(AA_NORMAL);
    },
  );

  it("light `--primary-solid` === `--primary` (the swap is a light-mode no-op)", () => {
    const light = block(":root");
    expect(readCssVar(light, "primary-solid")).toBe(readCssVar(light, "primary"));
  });
});

describe("ENG-828 — mobile token parity (primarySolid is the AA-safe twin)", () => {
  it("mobile primarySolid hexes mirror web `--primary-solid` (light + dark)", () => {
    expect(readMobile("primarySolid")).toBe(
      readCssVar(block(":root"), "primary-solid"),
    );
    expect(readMobile("primarySolidDark")).toBe(
      readCssVar(block(".dark"), "primary-solid"),
    );
  });

  it("mobile: primarySolid clears AA on its own primary tint in BOTH schemes", () => {
    // Light: fill #3B2A4D family over white card; Dark: fill #7E5C92 family
    // over the dark card #211A2A. Mirror the web computation with mobile hexes.
    const lightFill = readMobile("primary"); // #3B2A4D
    const lightSolid = readMobile("primarySolid"); // #3B2A4D
    const darkFill = readMobile("primaryDark"); // #7E5C92
    const darkSolid = readMobile("primarySolidDark"); // #C4ACD0
    const lightCard = "#ffffff";
    const darkCard = "#211a2a";
    for (const pct of TINT_PCTS) {
      expect(ratio(lightSolid, tint(lightFill, pct, lightCard)))
        .toBeGreaterThanOrEqual(AA_NORMAL);
      expect(ratio(darkSolid, tint(darkFill, pct, darkCard)))
        .toBeGreaterThanOrEqual(AA_NORMAL);
    }
    // And the bare dark fill as text FAILS — the mobile twin of the defect.
    expect(ratio(darkFill, tint(darkFill, 10, darkCard))).toBeLessThan(AA_NORMAL);
  });
});

describe("ENG-828 — web call sites ink with -solid, not the bare fill", () => {
  it("shared Badge `pro` + `custom` variants use text-primary-solid", () => {
    expect(WEB_BADGE).toMatch(/pro:\s*"bg-primary\/10 text-primary-solid/);
    expect(WEB_BADGE).toMatch(/custom:\s*"bg-primary\/10 text-primary-solid/);
    // No primary variant may regress to the bare fill ink on a tint.
    expect(WEB_BADGE).not.toMatch(/bg-primary\/\d+ text-primary\b(?!-)/);
  });

  it("shared IconBox `primary` tone inks with text-primary-solid", () => {
    expect(WEB_ICON_BOX).toMatch(/primary:\s*"bg-primary\/10 text-primary-solid"/);
  });
});

describe("ENG-828 — mobile call sites ink with primarySolid, not bare accent.primary", () => {
  it("mobile Badge pro/custom ink reads accent.primarySolid", () => {
    expect(MOBILE_BADGE).toContain("accent.primarySolid");
    expect(MOBILE_BADGE).toContain("color: textColor");
  });

  it("HouseholdBar selected chip + Manage link ink read accent.primarySolid", () => {
    expect(MOBILE_HOUSEHOLD_BAR).toContain("fg: active ? accent.primarySolid");
    // The Manage link inks with the solid (not the bare fill hue).
    expect(MOBILE_HOUSEHOLD_BAR).toMatch(
      /color: accent\.primarySolid \}\}>\s*Manage/,
    );
    // No selected-chip / link may regress to the bare fill ink.
    expect(MOBILE_HOUSEHOLD_BAR).not.toMatch(/fg: active \? accent\.primary\b(?!Solid)/);
  });

  it("PortionPicker unit pill + chips ink read accent.primarySolid on the tint", () => {
    // The unit chip-pill label + chevron, the active size chips, and the active
    // unit-list rows all read primarySolid; the bare `color: accent.primary` as
    // small text must not survive.
    expect(MOBILE_PORTION_PICKER).toContain("color: accent.primarySolid");
    expect(MOBILE_PORTION_PICKER).not.toMatch(
      /color:\s*isActive \? accent\.primary\b(?!Solid)/,
    );
  });

  it("StreakPip active pip ink reads accent.primarySolid (not bare colors.tint)", () => {
    expect(MOBILE_STREAK_PIP).toContain("? accent.primarySolid");
  });
});
