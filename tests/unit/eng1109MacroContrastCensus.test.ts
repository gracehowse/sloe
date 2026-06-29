/**
 * ENG-1109 — Today macro chips + slot pills WCAG AA contrast census.
 *
 * Computes real WCAG 2.x ratios for the `-solid` macro text tokens and the
 * secondary-foreground slot-pill label on each meal-slot soft tint. Values
 * mirror `src/styles/theme.css` + `apps/mobile/constants/theme.ts`.
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
const TODAY_MEALS = readFileSync(
  resolve(ROOT, "src/app/components/suppr/today-meals-section.tsx"),
  "utf8",
);
const MOBILE_TODAY_MEALS = readFileSync(
  resolve(ROOT, "apps/mobile/components/today/TodayMealsSection.tsx"),
  "utf8",
);
const MACRO_COLORS_TS = readFileSync(
  resolve(ROOT, "src/lib/theme/macroColors.ts"),
  "utf8",
);

const AA_NORMAL = 4.5;

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
  if (h.length === 8) {
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function hexAlpha(hex: string): number {
  const h = hex.replace("#", "");
  if (h.length !== 8) return 1;
  return parseInt(h.slice(6, 8), 16) / 255;
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

function softSurface(token: string, card: RGB): RGB {
  const fg = hexToRgb(token.slice(0, 7));
  const alpha = hexAlpha(token);
  return composite(fg, alpha, card);
}

function readMobileMacroSolid(key: string): string {
  const m = MOBILE_THEME.match(new RegExp(`${key}:\\s*'([^']+)'`));
  expect(m, `MacroColors.${key}`).not.toBeNull();
  return m![1].toLowerCase();
}

/** Read a `key: '#hex'` entry scoped to the `MacroColorsDark` literal (ENG-1217).
 *  The light `MacroColors` literal appears first, so an unscoped match would
 *  return the light value — scope to the dark block. */
function readMobileMacroDark(key: string): string {
  const start = MOBILE_THEME.indexOf("export const MacroColorsDark");
  expect(start, "MacroColorsDark literal").toBeGreaterThanOrEqual(0);
  const slice = MOBILE_THEME.slice(start, start + 1200);
  const m = slice.match(new RegExp(`${key}:\\s*'([^']+)'`));
  expect(m, `MacroColorsDark.${key}`).not.toBeNull();
  return m![1].toLowerCase();
}

describe("ENG-1109 — macro -solid tokens clear WCAG AA on light surfaces", () => {
  const light = block(":root");
  const card = hexToRgb(readCssVar(light, "card"));
  const white = hexToRgb("#ffffff");

  const pairs: Array<[string, string, string]> = [
    ["macro-protein-solid", "proteinSolid", readCssVar(light, "macro-protein-solid")],
    ["macro-carbs-solid", "carbsSolid", readCssVar(light, "macro-carbs-solid")],
    ["macro-fat-solid", "fatSolid", readCssVar(light, "macro-fat-solid")],
    ["macro-fiber-solid", "fiberSolid", readCssVar(light, "macro-fiber-solid")],
  ];

  it.each(pairs)(
    "web %s + mobile %s match and pass AA on card + white",
    (_cssName, mobileKey, cssHex) => {
      expect(readMobileMacroSolid(mobileKey)).toBe(cssHex);
      expect(ratio(cssHex, card)).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(ratio(cssHex, white)).toBeGreaterThanOrEqual(AA_NORMAL);
    },
  );

  it("light-as-text-risky fill hues fail AA on card (why -solid exists); plum/sage pass", () => {
    // Sloe v3: the warm/mid fills (carbs amber, fat berry-rose) still fail AA as
    // small text, so they carry a darkened `-solid`. Protein (plum) and fiber/
    // calories (sage) are dark enough to pass as fill — their `-solid` equals the
    // fill — so the small palette is partly self-sufficient.
    expect(ratio(readCssVar(light, "macro-carbs"), card)).toBeLessThan(AA_NORMAL);
    expect(ratio(readCssVar(light, "macro-fat"), card)).toBeLessThan(AA_NORMAL);
    expect(ratio(readCssVar(light, "macro-protein"), card)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("sodium/water fills fail AA as text on white — why ENG-1217 added their -solid", () => {
    // The clay (#C8794E) and muted-teal (#5A8A99) fills only clear ~3.3–3.8:1 as
    // small text. Before ENG-1217 the tile value read the bare fill var and
    // failed AA when tier-v1 coloured the value; the darkened `-solid` fixes it.
    expect(ratio(readCssVar(light, "macro-sodium"), white)).toBeLessThan(AA_NORMAL);
    expect(ratio(readCssVar(light, "macro-water"), white)).toBeLessThan(AA_NORMAL);
    expect(ratio(readCssVar(light, "macro-sodium-solid"), white)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(readCssVar(light, "macro-water-solid"), white)).toBeGreaterThanOrEqual(AA_NORMAL);
    // Sugar (damson) already passed as fill, so its `-solid` equals the fill.
    expect(readCssVar(light, "macro-sugar-solid")).toBe(readCssVar(light, "macro-sugar"));
    expect(ratio(readCssVar(light, "macro-sugar-solid"), white)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("ENG-1217 — macro tile value -solid tokens clear WCAG AA on the DARK card", () => {
  const dark = block(".dark");
  const card = hexToRgb(readCssVar(dark, "card"));
  // Every macro the Today tiles render reads its value ink off a `-solid`
  // (`MACRO_TEXT_COLOR_VARS`). In `.dark` the OLED-lifted fills double as the
  // `-solid`, so the value ink resolves these eight hues on the dark card.
  const darkSolids = [
    "macro-protein-solid",
    "macro-carbs-solid",
    "macro-fat-solid",
    "macro-fiber-solid",
    "macro-sugar-solid",
    "macro-sodium-solid",
    "macro-water-solid",
  ] as const;

  it.each(darkSolids)("%s passes AA-normal on the dark card", (token) => {
    expect(ratio(readCssVar(dark, token), card)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("calories value hue passes AA on the dark card (ring identity, no -solid)", () => {
    // Calories has no `-solid` (it's the ring, not a tile value), but the sage
    // lift must still clear AA wherever it is rendered as text in dark.
    expect(ratio(readCssVar(dark, "macro-calories"), card)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("ENG-1217 — web .dark macro hues mirror mobile MacroColorsDark (parity)", () => {
  const dark = block(".dark");

  // The core five were already pinned by crossPlatformThemeTokens; ENG-1217
  // realigned the secondary three (sugar/sodium/water) that had drifted from
  // mobile. All eight must match so the Today macro tile renders the same value
  // ink, icon, and fill on both platforms in dark.
  const pairs: Array<[string, string]> = [
    ["macro-protein", "protein"],
    ["macro-carbs", "carbs"],
    ["macro-fat", "fat"],
    ["macro-fiber", "fiber"],
    ["macro-calories", "calories"],
    ["macro-sugar", "sugar"],
    ["macro-sodium", "sodium"],
    ["macro-water", "water"],
  ];

  it.each(pairs)("web .dark --%s equals mobile MacroColorsDark.%s", (cssName, mobileKey) => {
    expect(readCssVar(dark, cssName)).toBe(readMobileMacroDark(mobileKey));
  });

  it("dark -solid equals the dark fill for every macro (dark -solid pattern)", () => {
    for (const key of ["protein", "carbs", "fat", "fiber", "sugar", "sodium", "water"]) {
      expect(readCssVar(dark, `macro-${key}-solid`)).toBe(readCssVar(dark, `macro-${key}`));
    }
  });
});

describe("ENG-1109 — slot pill secondary label on soft tints (light)", () => {
  const light = block(":root");
  const card = hexToRgb(readCssVar(light, "card"));
  const label = readCssVar(light, "foreground-secondary");

  const slots = ["slot-breakfast-soft", "slot-lunch-soft", "slot-dinner-soft", "slot-snack-soft"] as const;

  it.each(slots)("%s + foreground-secondary passes AA-normal", (slot) => {
    const surface = softSurface(readCssVar(light, slot), card);
    expect(ratio(label, surface)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("ENG-1109 — Today call sites use AA-safe tokens", () => {
  it("web Today macro chips reference -solid CSS vars", () => {
    expect(TODAY_MEALS).toContain("var(--macro-protein-solid)");
    expect(TODAY_MEALS).toContain("var(--macro-carbs-solid)");
    expect(TODAY_MEALS).toContain("var(--macro-fat-solid)");
    expect(TODAY_MEALS).toContain("var(--macro-fiber-solid)");
  });

  it("mobile SlotMacroChips use the *Solid AA-safe macro tokens", () => {
    // ENG-1223 made mobile macros scheme-aware via the `useMacroColors()` hook
    // (light → MacroColors, dark → MacroColorsDark). The chips now read the
    // *Solid AA-safe variants off the hook's `m` colours rather than the static
    // `MacroColors.*` import — the AA-safe-solid intent is unchanged.
    expect(MOBILE_TODAY_MEALS).toContain("useMacroColors");
    expect(MOBILE_TODAY_MEALS).toContain(".proteinSolid");
    expect(MOBILE_TODAY_MEALS).toContain(".carbsSolid");
    expect(MOBILE_TODAY_MEALS).toContain(".fatSolid");
    expect(MOBILE_TODAY_MEALS).toContain(".fiberSolid");
  });

  it("web slot pills use foreground-secondary, not slot hue as text", () => {
    expect(TODAY_MEALS).toMatch(/ENG-1109/);
    expect(TODAY_MEALS).toContain("text-foreground-secondary");
    expect(TODAY_MEALS).not.toMatch(/slotPillClassName[\s\S]*text-slot-breakfast/);
  });

  it("ENG-1217 — every macro tile value routes through a -solid token", () => {
    // The Today macro tile value ink reads `macroTextColorVarFor` →
    // `MACRO_TEXT_COLOR_VARS`. After ENG-1217 sugar/sodium/water join
    // protein/carbs/fat/fiber on `-solid` so the value is AA-safe in BOTH
    // schemes (the cascade resolves `:root` vs `.dark`). Calories is the ring
    // identity (no tile), so it keeps the bare hue.
    for (const key of ["protein", "carbs", "fat", "fiber", "sugar", "sodium", "water"]) {
      expect(
        MACRO_COLORS_TS,
        `MACRO_TEXT_COLOR_VARS.${key} should use var(--macro-${key}-solid)`,
      ).toMatch(new RegExp(`${key}:\\s*"var\\(--macro-${key}-solid\\)"`));
    }
  });
});
