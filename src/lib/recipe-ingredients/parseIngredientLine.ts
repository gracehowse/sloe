/**
 * Split free-text recipe lines (e.g. from JSON-LD) into amount, unit, and ingredient name.
 */

const UNICODE_FRAC: Record<string, string> = {
  "½": "0.5",
  "¼": "0.25",
  "¾": "0.75",
  "⅓": "0.33",
  "⅔": "0.67",
};

/** Longest-first so "tablespoon" wins over "spoon" if we add shorter patterns later */
const UNIT_PREFIXES: { re: RegExp; unit: string }[] = [
  { re: /^tablespoons?\b\.?/i, unit: "tbsp" },
  { re: /^tbsp\.?\b/i, unit: "tbsp" },
  { re: /^teaspoons?\b\.?/i, unit: "tsp" },
  { re: /^tsp\.?\b/i, unit: "tsp" },
  { re: /^fluid\s+ounces?\b/i, unit: "fl oz" },
  { re: /^fl\.?\s*oz\.?\b/i, unit: "fl oz" },
  { re: /^cups?\b\.?/i, unit: "cup" },
  { re: /^mugs?\b\.?/i, unit: "cup" },
  { re: /^(?:milliliters?|ml)\b\.?/i, unit: "ml" },
  { re: /^(?:liters?|litres?)\b\.?/i, unit: "l" },
  { re: /^(?:kilograms?|kg)\b\.?/i, unit: "kg" },
  { re: /^(?:grams?|g)\b\.?/i, unit: "g" },
  { re: /^(?:pounds?|lbs?)\b\.?/i, unit: "lb" },
  { re: /^(?:ounces?|oz)\b\.?/i, unit: "oz" },
  { re: /^tins?\b/i, unit: "tin" },
  { re: /^cans?\b/i, unit: "tin" },
  { re: /^rashers?\b/i, unit: "rasher" },
  { re: /^cloves?\b/i, unit: "clove" },
  { re: /^sprigs?\b/i, unit: "sprig" },
  { re: /^slices?\b/i, unit: "slice" },
  /** "2 sticks celery" — stick form is common in US/UK recipes */
  { re: /^sticks?\b/i, unit: "stalk" },
  { re: /^stalks?\b/i, unit: "stalk" },
  { re: /^medium\b/i, unit: "medium" },
  { re: /^large\b/i, unit: "large" },
  { re: /^small\b/i, unit: "small" },
  { re: /^pinch(?:es)?\b/i, unit: "pinch" },
  { re: /^pack(?:et)?s?\b/i, unit: "pack" },
  { re: /^drizzles?\b/i, unit: "drizzle" },
  { re: /^dash(?:es)?\b/i, unit: "dash" },
  { re: /^splash(?:es)?\b/i, unit: "splash" },
  { re: /^handfuls?\b/i, unit: "handful" },
  { re: /^bunch(?:es)?\b/i, unit: "bunch" },
  { re: /^knobs?\b/i, unit: "knob" },
  { re: /^heads?\b/i, unit: "head" },
  { re: /^bulbs?\b/i, unit: "bulb" },
  { re: /^fillets?\b/i, unit: "fillet" },
  { re: /^breasts?\b/i, unit: "breast" },
  { re: /^thighs?\b/i, unit: "thigh" },
  { re: /^drumsticks?\b/i, unit: "drumstick" },
  { re: /^wings?\b/i, unit: "wing" },
  { re: /^jars?\b/i, unit: "jar" },
  { re: /^chops?\b/i, unit: "chop" },
  { re: /^steaks?\b/i, unit: "steak" },
  { re: /^legs?\b/i, unit: "leg" },
];

function normalizeLeadingFractions(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  for (const [u, v] of Object.entries(UNICODE_FRAC)) {
    if (t.startsWith(`${u} `) || t === u) {
      return `${v}${t.length > u.length ? " " + t.slice(u.length).trim() : ""}`;
    }
  }
  return t;
}

function normalizeCompactUnit(u: string): string {
  const x = u.toLowerCase();
  if (x === "cl") return "cl";
  return x;
}

/** "... , ¾" or "... , 1/2" at end → amount + herb-friendly tbsp for leaves */
function tryTrailingFraction(s: string): { amount: string; unit: string; name: string } | null {
  const m = s.match(/^(.+?)[,，]\s*(½|¼|¾|⅓|⅔|\d+\s*\/\s*\d+)\s*$/);
  if (!m) return null;
  const core = m[1].trim();
  if (!core) return null;
  const sym = m[2].replace(/\s/g, "");
  let amtStr = UNICODE_FRAC[sym];
  if (amtStr === undefined) {
    if (sym.includes("/")) {
      const [a, b] = sym.split("/").map((n) => Number.parseFloat(n.trim()));
      if (b && Number.isFinite(a)) amtStr = String(a / b);
    }
  }
  if (!amtStr) return null;
  const isHerb =
    /basil|oregano|parsley|mint|cilantro|coriander\s+leaf|thyme|rosemary|sage|dill|tarragon/i.test(core);
  return {
    amount: amtStr,
    unit: isHerb ? "tbsp" : "cup",
    name: core,
  };
}

/**
 * Parse a single ingredient line into structured fields.
 *
 * Defensive guard (audit 2026-04-29 papercut #6): if the parse produces a
 * `name` that starts with a digit, the line was likely malformed (e.g.
 * "1 5 large eggs" from a unicode-fraction encoding mishap, or ranges
 * typed without a hyphen) and `splitUnitAndName` left the second
 * number stuck on the front of `name`. Rather than emit garbled
 * `${amount} ${unit} ${name}` like "1 5 large eggs" downstream in the
 * shopping list, attempt a recovery parse on just the name; if that
 * succeeds with a clean (non-digit-leading) name use it, otherwise
 * fall back to a single-string ingredient with no amount/unit so the
 * raw line displays cleanly. See
 * `docs/audits/2026-04-29-mobile-e2e-audit-findings.md` (#6).
 */
export function parseIngredientLine(raw: string): { amount: string; unit: string; name: string } {
  const first = parseIngredientLineInner(raw);
  const cleaned = { ...first, name: stripParentheticalWeight(first.name) };

  if (!nameLooksMalformed(cleaned.name)) {
    return cleaned;
  }

  // Recovery — try parsing the malformed name on its own.
  const recovered = parseIngredientLineInner(cleaned.name);
  const recoveredCleaned = { ...recovered, name: stripParentheticalWeight(recovered.name) };
  if (recoveredCleaned.name && !nameLooksMalformed(recoveredCleaned.name)) {
    // Prefer the recovery's amount/unit when it produced something;
    // otherwise keep the first parse's amount.
    return {
      amount: recoveredCleaned.amount || cleaned.amount,
      unit: recoveredCleaned.unit || cleaned.unit,
      name: recoveredCleaned.name,
    };
  }

  // Recovery didn't help — surface the raw line as the name with no
  // amount/unit so the shopping label renders the user's original
  // text rather than a malformed "1 5 large eggs" composite.
  return { amount: "", unit: "", name: raw.trim() };
}

/**
 * Heuristic: a parsed ingredient name should not start with a digit.
 * When it does, splitUnitAndName failed to consume an embedded
 * quantity/unit and the leading digit is stuck on the noun phrase.
 */
function nameLooksMalformed(name: string): boolean {
  return /^\d/.test(name.trim());
}

function parseIngredientLineInner(raw: string): { amount: string; unit: string; name: string } {
  let s = normalizeLeadingFractions(raw);
  s = s.trim().replace(/\s+/g, " ");
  if (!s) {
    return { amount: "", unit: "", name: "" };
  }

  const hadLeadingArticle = /^(a|an)\s+/i.test(s);
  s = s.replace(/^(a|an)\s+/i, "");

  // "a pinch of salt" → after stripping "a", try to parse "pinch of salt" as "1 pinch of salt".
  // This ensures unit-led phrases like "a dash of", "a handful of", "a pinch of" get amount=1.
  if (hadLeadingArticle) {
    const asOne = splitUnitAndName("1", s);
    if (asOne.unit) return asOne;
  }

  // 2 x 400g tins plum tomatoes → 800 g + name (no space after "g" before "tins" is common in UK recipes)
  const multiPack = s.match(
    /^(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(g|kg|ml)\s*(?:(?:tins?|cans?|jars?|packets?|packs?)\s+)?(.+)$/i,
  );
  if (multiPack) {
    const n = Number(multiPack[1]) * Number(multiPack[2]);
    if (Number.isFinite(n) && n > 0) {
      return {
        amount: String(Math.round(n * 100) / 100),
        unit: multiPack[3].toLowerCase(),
        name: stripPackagingPrefix(multiPack[4].trim()),
      };
    }
  }

  // x 400g tins ... (single pack; often no space after g)
  const implicitX = s.match(
    /^x\s*(\d+(?:\.\d+)?)\s*(g|kg|ml)\s*(?:(?:tins?|cans?|jars?|packets?|packs?)\s+)?(.+)$/i,
  );
  if (implicitX) {
    return {
      amount: implicitX[1],
      unit: implicitX[2].toLowerCase(),
      name: stripPackagingPrefix(implicitX[3].trim()),
    };
  }

  // 500gbeef or 500g beef — no space between number and unit; allow space before name
  const tightWt = s.match(/^(\d+(?:\.\d+)?)(g|kg|ml|cl)\s*([A-Za-z].*)$/i);
  if (tightWt) {
    const u = normalizeCompactUnit(tightWt[2]);
    const namePart = tightWt[3].trim();
    if (u === "cl") {
      const ml = Number(tightWt[1]) * 10;
      if (Number.isFinite(ml)) {
        return { amount: String(ml), unit: "ml", name: stripPackagingPrefix(namePart) };
      }
    }
    return { amount: tightWt[1], unit: u, name: stripPackagingPrefix(namePart) };
  }

  // 500g beef mince (space after unit)
  const compact = s.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|cl)\s+(.+)$/i);
  if (compact) {
    const u = normalizeCompactUnit(compact[2]);
    if (u === "cl") {
      const ml = Number(compact[1]) * 10;
      if (Number.isFinite(ml)) {
        return { amount: String(ml), unit: "ml", name: stripPackagingPrefix(compact[3].trim()) };
      }
    }
    return { amount: compact[1], unit: u, name: stripPackagingPrefix(compact[3].trim()) };
  }

  // Mixed number: 1 1/2 cups ...
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)\s+(.+)$/);
  if (mixed) {
    const whole = Number.parseInt(mixed[1], 10);
    const num = Number.parseInt(mixed[2], 10);
    const den = Number.parseInt(mixed[3], 10);
    const rest = mixed[4].trim();
    if (den !== 0) {
      const amountStr = String(whole + num / den);
      return splitUnitAndName(amountStr, rest);
    }
  }

  // Simple fraction at start: 1/2 cup
  const frac = s.match(/^(\d+)\/(\d+)\s+(.+)$/);
  if (frac) {
    const num = Number.parseInt(frac[1], 10);
    const den = Number.parseInt(frac[2], 10);
    const rest = frac[3].trim();
    if (den !== 0) {
      return splitUnitAndName(String(num / den), rest);
    }
  }

  // Range: 2-3 sprigs
  const range = s.match(/^(\d+\s*-\s*\d+)\s+(.+)$/);
  if (range) {
    return splitUnitAndName(range[1].replace(/\s/g, ""), range[2].trim());
  }

  // Decimal or integer + space + rest
  const numRest = s.match(/^(\d+\.\d+|\d+)\s+(.+)$/);
  if (numRest) {
    return splitUnitAndName(numRest[1], numRest[2].trim());
  }

  const trail = tryTrailingFraction(s);
  if (trail) return trail;

  const trailSpaceFrac = tryTrailingFractionSpace(s);
  if (trailSpaceFrac) return trailSpaceFrac;

  const suffixWt = trySuffixWeight(s);
  if (suffixWt) return suffixWt;

  return { amount: "", unit: "", name: s };
}

/**
 * Detect whole countable produce/food items that should get a "medium" unit
 * when no explicit unit is provided.
 * e.g. "red pepper, diced" → true, "olive oil" → false
 */
function isCountableWholeItem(name: string): boolean {
  const n = name.toLowerCase().replace(/,.*$/, "").trim();
  const COUNTABLE_ITEMS = [
    // Vegetables
    // Peppers: only colour/type-qualified peppers are countable produce.
    // Bare "pepper" is a spice — should NOT get "medium" unit.
    /\b(?:bell|red|green|yellow|orange|sweet|romano|roasted)\s+peppers?\b/,
    /\bonions?\b/, /\bcarrots?\b/, /\bpotato(?:es)?\b/, /\btomato(?:es)?\b/,
    /\bcourgettes?\b/, /\bzucchinis?\b/, /\baubergines?\b/, /\beggplants?\b/,
    /\bcucumbers?\b/, /\bavocados?\b/, /\bsweet potato(?:es)?\b/, /\bbeetroots?\b/,
    /\bturnips?\b/, /\bparsnips?\b/, /\bleeks?\b/, /\bfennels?\b/, /\bceleriac\b/,
    /\bcauliflowers?\b/, /\bbroccoli\b/, /\bcabbages?\b/, /\blettuces?\b/,
    /\bcorn\b/, /\bsquash(?:es)?\b/, /\bpumpkins?\b/,
    // Fruits
    /\blemons?\b/, /\blimes?\b/, /\bapples?\b/, /\bpears?\b/, /\boranges?\b/,
    /\bbananas?\b/, /\bmangos?\b/, /\bpeach(?:es)?\b/, /\bnectarines?\b/, /\bplums?\b/,
    /\bpomegranates?\b/, /\bgrapefruits?\b/, /\bkiwis?\b/,
    // Proteins (NOT eggs — they use countableGrams at 50g, not "medium" 110g)
    /\bchicken breasts?\b/, /\bchicken thighs?\b/, /\bsausages?\b/,
    /\bfillets?\b/, /\bsteaks?\b/, /\bchops?\b/, /\bpork chops?\b/, /\blamb chops?\b/,
    // Baked
    /\bbread rolls?\b/, /\bpittas?\b/, /\btortillas?\b/, /\bwraps?\b/, /\bbagels?\b/,
  ];
  return COUNTABLE_ITEMS.some((pat) => pat.test(n));
}

/** Remove leading "tins/cans of" style noise left after weight parsing */
function stripPackagingPrefix(name: string): string {
  const stripped = name.replace(/^(?:tins?|cans?|jars?)\s+(?:of\s+)?/i, "").trim() || name;
  return stripParentheticalWeight(stripped);
}

/** Strip parenthetical weight/volume info: "tomatoes (14 oz)" → "tomatoes" */
function stripParentheticalWeight(name: string): string {
  // Matches patterns like (14 oz), (400g), (1.5 kg), (28 fl oz), (14.5-oz), (400 ml)
  return name.replace(/\s*\(\s*[\d.,]+\s*-?\s*(?:oz|g|kg|ml|l|lb|fl\s*oz|ounce|gram|liter|litre)s?\s*\)/gi, "").trim() || name;
}

/** "basil picked ¾" (no comma before fraction) */
function tryTrailingFractionSpace(s: string): { amount: string; unit: string; name: string } | null {
  const m = s.match(/^(.+?)\s+(½|¼|¾|⅓|⅔|\d+\s*\/\s*\d+)\s*$/);
  if (!m) return null;
  const core = m[1].trim();
  if (!core) return null;
  const sym = m[2].replace(/\s/g, "");
  let amtStr = UNICODE_FRAC[sym];
  if (amtStr === undefined && sym.includes("/")) {
    const [a, b] = sym.split("/").map((n) => Number.parseFloat(n.trim()));
    if (b && Number.isFinite(a)) amtStr = String(a / b);
  }
  if (!amtStr) return null;
  const isHerb =
    /basil|oregano|parsley|mint|cilantro|coriander\s+leaf|thyme|rosemary|sage|dill|tarragon/i.test(core);
  return {
    amount: amtStr,
    unit: isHerb ? "tbsp" : "cup",
    name: core,
  };
}

/** "beef mince 500g" */
function trySuffixWeight(s: string): { amount: string; unit: string; name: string } | null {
  const m = s.match(/^(.+?)\s+(\d+(?:\.\d+)?)\s*(g|kg|ml)\s*$/i);
  if (!m) return null;
  const namePart = m[1].trim();
  if (!namePart || /^\d+$/.test(namePart)) return null;
  const u = normalizeCompactUnit(m[3]);
  if (u === "cl") {
    const ml = Number(m[2]) * 10;
    if (Number.isFinite(ml)) return { amount: String(ml), unit: "ml", name: namePart };
  }
  return { amount: m[2], unit: u, name: namePart };
}

function normalizeCountableUnit(raw: string): string {
  const u = raw.toLowerCase().replace(/s$/i, "");
  if (u === "stick") return "stalk";
  if (u === "drumstick") return "drumstick";
  return u;
}

function splitUnitAndName(amountStr: string, rest: string): { amount: string; unit: string; name: string } {
  // Strip modifier words before the unit: "heaped tbsp", "level tsp", "rounded tbsp"
  const modifierMatch = rest.match(/^(heaped|heaping|level|rounded|generous|scant)\s+(.+)$/i);
  const stripped = modifierMatch ? modifierMatch[2] : rest;

  for (const { re, unit } of UNIT_PREFIXES) {
    const m = stripped.match(re);
    if (m) {
      const after = stripped.slice(m[0].length).trim().replace(/^of\s+/i, "");
      return { amount: amountStr, unit, name: after || rest };
    }
  }
  /**
   * Embedded countable units: "garlic cloves finely chopped", "celery sticks diced"
   * (unit follows the food word; optional prep after). Prefix-only patterns miss these.
   */
  const embedded = rest.match(
    /^(.+?)\s+(cloves?|sticks?|stalks?|sprigs?|rashers?|slices?|breasts?|thighs?|drumsticks?|wings?|fillets?|chops?|steaks?|legs?)\b(?:[,\s]+(.+))?$/i,
  );
  if (embedded) {
    const canonical = normalizeCountableUnit(embedded[2]);
    const name = [embedded[1].trim(), embedded[3]?.trim()].filter(Boolean).join(" ").trim();
    return { amount: amountStr, unit: canonical, name };
  }
  const leafT = rest.match(/^(.+?)\s+leaves\s*$/i);
  if (leafT) {
    return { amount: amountStr, unit: "leaf", name: leafT[1].trim() };
  }

  // Whole produce items: "1 red pepper, diced" → unit: "medium"
  // When no explicit unit is found but the ingredient name matches a countable whole food,
  // assign "medium" so the estimator uses ~110g instead of 80g default.
  if (amountStr && isCountableWholeItem(rest)) {
    return { amount: amountStr, unit: "medium", name: rest };
  }

  return { amount: amountStr, unit: "", name: rest };
}
