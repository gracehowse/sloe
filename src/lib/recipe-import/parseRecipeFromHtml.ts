/**
 * Extract Recipe-shaped data from HTML via JSON-LD (schema.org Recipe).
 * Best-effort: many sites omit or misstructure fields.
 */

export interface ParsedRecipeDraft {
  title: string;
  description: string | null;
  ingredients: string[];
  instructions: string[];
  servings: number | null;
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  imageUrl: string | null;
}

function parseIsoDurationToMinutes(iso: string | null | undefined): number | null {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i);
  if (!m) return null;
  const h = m[1] ? Number.parseInt(m[1], 10) : 0;
  const min = m[2] ? Number.parseInt(m[2], 10) : 0;
  const s = m[3] ? Number.parseInt(m[3], 10) : 0;
  const total = h * 60 + min + Math.round(s / 60);
  return total > 0 ? total : null;
}

function asStringArrayRecipeYield(yieldVal: unknown): number | null {
  if (yieldVal == null) return null;
  if (typeof yieldVal === "number" && Number.isFinite(yieldVal)) {
    return Math.max(1, Math.round(yieldVal));
  }
  if (typeof yieldVal === "string") {
    const n = Number.parseFloat(yieldVal.replace(/[^\d.]/g, ""));
    if (Number.isFinite(n) && n > 0) return Math.max(1, Math.round(n));
  }
  return null;
}

function normalizeIngredientText(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length ? t : null;
  }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    const text = o.text;
    if (typeof text === "string" && text.trim()) return text.trim();
    const name = o.name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

function collectInstructionStrings(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === "string") {
    return raw
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Array.isArray(raw)) {
    const out: string[] = [];
    for (const item of raw) {
      if (typeof item === "string") {
        const t = item.trim();
        if (t) out.push(t);
      } else if (typeof item === "object" && item !== null) {
        const o = item as Record<string, unknown>;
        if (String(o["@type"] ?? "").toLowerCase() === "howtostep") {
          const t = o.text;
          if (typeof t === "string" && t.trim()) out.push(t.trim());
        } else if (Array.isArray(o.itemListElement)) {
          out.push(...collectInstructionStrings(o.itemListElement));
        }
      }
    }
    return out;
  }
  if (typeof raw === "object" && raw !== null) {
    const o = raw as Record<string, unknown>;
    if (o["@type"] === "ItemList" && Array.isArray(o.itemListElement)) {
      return collectInstructionStrings(o.itemListElement);
    }
    if (o["@type"] === "HowTo" && o.step) {
      return collectInstructionStrings(o.step);
    }
  }
  return [];
}

function extractRecipeObjects(node: unknown): Record<string, unknown>[] {
  if (node == null) return [];
  if (Array.isArray(node)) {
    return node.flatMap(extractRecipeObjects);
  }
  if (typeof node !== "object") return [];
  const o = node as Record<string, unknown>;
  const types = o["@type"];
  const typeList = Array.isArray(types) ? types : [types];
  const isRecipe = typeList.some((t) => {
    if (typeof t !== "string") return false;
    const tt = t.trim().toLowerCase();
    return tt === "recipe" || tt.endsWith("/recipe") || tt.endsWith("#recipe");
  });
  if (isRecipe) {
    return [o];
  }
  if (o["@graph"]) {
    return extractRecipeObjects(o["@graph"]);
  }
  return [];
}

function firstImageUrl(image: unknown): string | null {
  if (image == null) return null;
  if (typeof image === "string") return image.trim() || null;
  if (Array.isArray(image)) {
    for (const x of image) {
      const u = firstImageUrl(x);
      if (u) return u;
    }
    return null;
  }
  if (typeof image === "object" && image !== null) {
    const o = image as Record<string, unknown>;
    if (typeof o.url === "string") return o.url.trim() || null;
  }
  return null;
}

export function parseRecipeFromHtml(html: string): ParsedRecipeDraft | null {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of scripts) {
    const jsonText = m[1]?.trim();
    if (!jsonText) continue;
    let data: unknown;
    try {
      data = JSON.parse(jsonText);
    } catch {
      continue;
    }
    const recipes = extractRecipeObjects(data);
    for (const r of recipes) {
      const name = r.name;
      const title = typeof name === "string" && name.trim() ? name.trim() : null;
      if (!title) continue;

      const desc = r.description;
      const description =
        typeof desc === "string" && desc.trim() ? desc.trim().replace(/\s+/g, " ") : null;

      const ingRaw = r.recipeIngredient;
      const ingredients: string[] = [];
      if (Array.isArray(ingRaw)) {
        for (const x of ingRaw) {
          const line = normalizeIngredientText(x);
          if (line) ingredients.push(line);
        }
      }

      let instructions: string[] = [];
      const ri = r.recipeInstructions;
      if (typeof ri === "string") {
        instructions = collectInstructionStrings(ri);
      } else {
        instructions = collectInstructionStrings(ri);
      }

      const servings = asStringArrayRecipeYield(r.recipeYield);
      const prepTimeMin = parseIsoDurationToMinutes(r.prepTime as string | undefined);
      const cookTimeMin = parseIsoDurationToMinutes(r.cookTime as string | undefined);
      const imageUrl = firstImageUrl(r.image);

      return {
        title,
        description,
        ingredients,
        instructions,
        servings,
        prepTimeMin,
        cookTimeMin,
        imageUrl,
      };
    }
  }
  return null;
}
