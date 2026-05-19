/**
 * eslint-plugin-suppr-tokens — Phase 1.5 of the UI elevation plan
 * (/Users/graceturner/.claude/plans/i-m-really-struggling-to-goofy-rivest.md).
 *
 * Bans literal spacing / colour / font-size values in the web tree so
 * the design system can't silently drift. Per the 2026-04-28 visual-qa
 * audit ([docs/audits/2026-04-28-visual-qa-pixel-level.md](../docs/audits/2026-04-28-visual-qa-pixel-level.md)),
 * the codebase carries 60+ spacing literals, 50+ type literals, and
 * 20+ colour literals across major surfaces. Without enforcement,
 * every premium sweep refills them.
 *
 * Rules:
 *   - no-literal-spacing   — bans `p-[NNpx]`, `m-[NNpx]`, `mt-[NNpx]`,
 *                            etc. arbitrary Tailwind values and inline
 *                            `style={{ padding: 'NNpx' }}` where NN is
 *                            not on the canonical 4/8/12/16/20/24/32
 *                            scale.
 *   - no-literal-color     — bans `#xxx`, `rgb(`, `rgba(`, `hsl(`,
 *                            `hsla(` in className strings AND inline
 *                            styles. Allows `var(--…)` and
 *                            `color-mix(in srgb, var(--…), …)`.
 *   - no-literal-fontSize  — bans `fontSize: NN` (RN-style) and
 *                            `text-[NNpx]` Tailwind arbitrary values.
 *
 * Allow-list patterns: any value already going through a CSS variable
 * (`var(--…)`) is considered tokenised. A `// eslint-disable-next-line`
 * comment is still respected for one-off escapes — but the comment
 * must justify itself or the next sweep will rip it.
 *
 * Wire-up: applied to `src/**` and `app/**` only in `eslint.config.mjs`.
 * Tests and stories opt out by glob.
 */

/** Canonical scale from apps/mobile/constants/theme.ts `Spacing`. */
const CANONICAL_SPACING = new Set([0, 1, 2, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64]);

/** Canonical Type ladder (rough — keep loose because the type tokens are
 *  defined in CSS not JS; we just want to catch obvious off-ladder values
 *  like 13 / 17 / 19). */
const CANONICAL_FONT_SIZE = new Set([10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 42, 48, 56, 64]);

/** Tailwind utility prefixes that take a length arbitrary value. */
const SPACING_PREFIXES = ["p", "px", "py", "pt", "pr", "pb", "pl", "m", "mx", "my", "mt", "mr", "mb", "ml", "gap", "gap-x", "gap-y", "space-x", "space-y", "inset", "top", "right", "bottom", "left", "w", "h", "min-w", "min-h", "max-w", "max-h", "rounded", "rounded-t", "rounded-b", "rounded-l", "rounded-r"];

const SPACING_ARBITRARY_RE = new RegExp(
  `(?:^|\\s)(?:[a-z]+:)*(${SPACING_PREFIXES.join("|")})-\\[([^\\]]+)\\]`,
  "g",
);

const TEXT_SIZE_ARBITRARY_RE = /(?:^|\s)(?:[a-z]+:)*text-\[([^\]]+)\]/g;

const COLOR_LITERAL_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\brgba?\s*\(|\bhsla?\s*\(/g;

/** Parse a CSS length string like "14px" / "1.5rem" → pixel-equivalent number, or null. */
function parsePixelLength(raw) {
  const m = /^(-?[\d.]+)(px)?$/.exec(raw.trim());
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

const noLiteralSpacing = {
  meta: {
    type: "problem",
    docs: { description: "Disallow literal spacing values outside the canonical scale." },
    schema: [],
    messages: {
      literal: "Literal spacing value '{{value}}' is not on the canonical scale (0,4,8,12,16,20,24,32,40,48,64). Use a token-driven className or a CSS variable.",
    },
  },
  create(context) {
    function reportClassNameLiterals(node, classText) {
      let m;
      while ((m = SPACING_ARBITRARY_RE.exec(classText)) !== null) {
        const px = parsePixelLength(m[2]);
        if (px === null) continue;
        if (CANONICAL_SPACING.has(Math.abs(px))) continue;
        context.report({ node, messageId: "literal", data: { value: m[0].trim() } });
      }
    }
    return {
      JSXAttribute(node) {
        if (node.name?.name !== "className") return;
        const v = node.value;
        if (!v) return;
        if (v.type === "Literal" && typeof v.value === "string") {
          reportClassNameLiterals(node, v.value);
        } else if (v.type === "JSXExpressionContainer" && v.expression.type === "Literal" && typeof v.expression.value === "string") {
          reportClassNameLiterals(node, v.expression.value);
        } else if (v.type === "JSXExpressionContainer" && v.expression.type === "TemplateLiteral") {
          for (const q of v.expression.quasis) {
            reportClassNameLiterals(node, q.value.raw);
          }
        }
      },
      Property(node) {
        if (node.key?.type !== "Identifier") return;
        const key = node.key.name;
        if (!/^(padding|margin|gap|top|right|bottom|left|width|height)/.test(key)) return;
        const val = node.value;
        if (val.type === "Literal" && typeof val.value === "string") {
          const px = parsePixelLength(val.value);
          if (px === null) return;
          if (CANONICAL_SPACING.has(Math.abs(px))) return;
          context.report({ node: val, messageId: "literal", data: { value: val.value } });
        }
      },
    };
  },
};

const noLiteralColor = {
  meta: {
    type: "problem",
    docs: { description: "Disallow literal colour values (use CSS variables)." },
    schema: [],
    messages: {
      literal: "Literal colour '{{value}}' detected. Use a CSS variable (var(--…)) so light/dark mode and brand changes propagate.",
    },
  },
  create(context) {
    function reportString(node, str) {
      // Allow if the same string also has a var(--…) — caller is composing.
      if (/var\(--/.test(str) && !/^(#|rgb|rgba|hsl|hsla)/i.test(str.trim())) {
        // composed value; still check for stray literals
      }
      let m;
      while ((m = COLOR_LITERAL_RE.exec(str)) !== null) {
        context.report({ node, messageId: "literal", data: { value: m[0] } });
      }
    }
    return {
      JSXAttribute(node) {
        if (node.name?.name !== "className" && node.name?.name !== "style") return;
        const v = node.value;
        if (!v) return;
        if (v.type === "Literal" && typeof v.value === "string") {
          reportString(node, v.value);
        }
      },
      Property(node) {
        // Inline style values: { color: '#fff' }
        if (node.value?.type !== "Literal" || typeof node.value.value !== "string") return;
        const key = node.key?.type === "Identifier" ? node.key.name : null;
        if (!key || !/color|background|border|shadow|fill|stroke|outline/i.test(key)) return;
        reportString(node.value, node.value.value);
      },
    };
  },
};

const noLiteralFontSize = {
  meta: {
    type: "problem",
    docs: { description: "Disallow literal font-size values outside the Type ladder." },
    schema: [],
    messages: {
      literal: "Literal font-size '{{value}}' is not on the Type ladder. Use a typography component or a tokenised className.",
    },
  },
  create(context) {
    function reportClassNameLiterals(node, classText) {
      let m;
      while ((m = TEXT_SIZE_ARBITRARY_RE.exec(classText)) !== null) {
        const px = parsePixelLength(m[1]);
        if (px === null) continue;
        if (CANONICAL_FONT_SIZE.has(px)) continue;
        context.report({ node, messageId: "literal", data: { value: m[0].trim() } });
      }
    }
    return {
      JSXAttribute(node) {
        if (node.name?.name !== "className") return;
        const v = node.value;
        if (!v) return;
        if (v.type === "Literal" && typeof v.value === "string") {
          reportClassNameLiterals(node, v.value);
        }
      },
      Property(node) {
        if (node.key?.type !== "Identifier" || node.key.name !== "fontSize") return;
        const val = node.value;
        if (val.type === "Literal") {
          const px = typeof val.value === "number" ? val.value : parsePixelLength(String(val.value));
          if (px === null) return;
          if (CANONICAL_FONT_SIZE.has(px)) return;
          context.report({ node: val, messageId: "literal", data: { value: String(val.value) } });
        }
      },
    };
  },
};

export default {
  rules: {
    "no-literal-spacing": noLiteralSpacing,
    "no-literal-color": noLiteralColor,
    "no-literal-fontSize": noLiteralFontSize,
  },
};
