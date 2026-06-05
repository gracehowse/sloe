/**
 * Figma Plugin API script — apply shipped Sloe resting-card chrome.
 * Paste body into use_figma `code` with frameId + isDark params, or
 * inline the FRAME_IDS loop below.
 *
 * Spec: borderless #F6F5F2 slabs, cardSoft lift (light), hairline (dark),
 * white page (light). Skip Image nodes, IMAGE fills, meals list wrappers, CTAs.
 */
function applySloeCardChrome(frameId, isDark) {
  const root = figma.getNodeById(frameId);
  if (!root || root.type !== "FRAME") {
    throw new Error("Frame not found: " + frameId);
  }

  const CARD = { r: 246 / 255, g: 245 / 255, b: 242 / 255 };
  const CARD_DARK = { r: 42 / 255, g: 39 / 255, b: 48 / 255 };
  const PAGE = isDark
    ? { r: 25 / 255, g: 24 / 255, b: 28 / 255 }
    : { r: 1, g: 1, b: 1 };
  const BORDER = { r: 232 / 255, g: 226 / 255, b: 236 / 255 };
  const JULIENNE = { r: 247 / 255, g: 247 / 255, b: 247 / 255 };
  const LINEN = { r: 247 / 255, g: 243 / 255, b: 236 / 255 };
  const TRACK = { r: 239 / 255, g: 239 / 255, b: 239 / 255 };
  // Mirrors the shipped `--elev-card-soft` / `Elevation.cardSoft` EXACTLY so the
  // Figma slab lift matches the app. Strengthened 0.10/14/y4 → 0.16/18/y6 on
  // 2026-06-04 (the #F6F5F2 card sits only ~10 lum below the #FFFFFF page, so the
  // shadow must carry all the separation; the 10% lift read too weak on-device).
  const CARD_SOFT = {
    type: "DROP_SHADOW",
    color: { r: 34 / 255, g: 27 / 255, b: 38 / 255, a: 0.16 },
    offset: { x: 0, y: 6 },
    radius: 18,
    spread: 0,
    visible: true,
    blendMode: "NORMAL",
  };

  function near(c, t, eps = 0.025) {
    if (!c || c.a === 0) return false;
    return (
      Math.abs(c.r - t.r) < eps &&
      Math.abs(c.g - t.g) < eps &&
      Math.abs(c.b - t.b) < eps
    );
  }

  function isBorderStroke(s) {
    if (!s || s.type !== "SOLID" || !s.visible) return false;
    const c = s.color;
    return near(c, BORDER) || near(c, { r: 0.9, g: 0.88, b: 0.92 });
  }

  function hasImageFill(node) {
    if (!("fills" in node) || !Array.isArray(node.fills)) return false;
    return node.fills.some((f) => f && f.type === "IMAGE" && f.visible !== false);
  }

  function isPhotoNode(node) {
    const n = node.name || "";
    return n.startsWith("Image (") || n.includes("photo") && n.includes("hero");
  }

  function isCardFill(fills) {
    if (!fills || !fills.length) return false;
    const f = fills.find((x) => x && x.type === "SOLID" && x.visible !== false);
    if (!f) return false;
    const c = f.color;
    return (
      near(c, CARD) ||
      near(c, JULIENNE) ||
      near(c, LINEN) ||
      near(c, { r: 0.965, g: 0.96, b: 0.95 })
    );
  }

  function setSolidFill(node, color) {
    node.fills = [{ type: "SOLID", color: { ...color, a: 1 } }];
  }

  function clearStrokes(node) {
    if (!("strokes" in node)) return;
    node.strokes = [];
    node.strokeWeight = 0;
  }

  function isMealsListWrapper(node, path) {
    const nm = (node.name || "").toLowerCase();
    if (nm.includes("log dinner")) return false;
    if (path.includes("Today's Meals") && node.type === "FRAME" && node.children) {
      const onlyLayout = node.children.every(
        (c) => c.type === "FRAME" && (c.name || "").toLowerCase().includes("meal"),
      );
      if (onlyLayout && isCardFill(node.fills)) return true;
    }
    return false;
  }

  function isContentCard(node, path) {
    const nm = (node.name || "").toLowerCase();
    if (isPhotoNode(node) || hasImageFill(node)) return false;
    if (isMealsListWrapper(node, path)) return false;
    if (nm.includes("log dinner") || nm.includes("dashed")) return false;
    if (nm.includes("chip") || nm.includes("pill") || nm.includes("tab bar")) return false;
    if (nm.includes("week") && nm.includes("strip")) return false;

    if (
      path.includes("Hero") ||
      path.includes("Calorie hero") ||
      (path.includes("Macro") && node.width < 280 && node.height < 220)
    ) {
      return isCardFill(node.fills) || node.type === "FRAME";
    }
    if (
      (path.includes("Today's Meals") || path.includes("Meals")) &&
      (nm.includes("meal") || nm.includes("breakfast") || nm.includes("lunch") || nm.includes("dinner")) &&
      node.width > 200 &&
      node.height > 60 &&
      node.height < 200
    ) {
      return true;
    }
    if (path.includes("What to eat") || path.includes("north star") || path.includes("recipe")) {
      if (node.type === "FRAME" && !hasImageFill(node)) {
        return isCardFill(node.fills) || (node.strokes && node.strokes.length > 0);
      }
      return false;
    }
    if (path.includes("first meal") || nm.includes("log your first")) return true;
    if (path.includes("Weekly Insight") && node.type === "FRAME" && isCardFill(node.fills))
      return true;

    return false;
  }

  root.fills = [{ type: "SOLID", color: { ...PAGE, a: 1 } }];

  let stats = {
    fills: 0,
    strokesCleared: 0,
    shadows: 0,
    wrappersCleared: 0,
    thumbs: 0,
    toggles: 0,
  };
  const mutated = [];

  function walk(node, path) {
    const p = path ? path + ">" + node.name : node.name;

    if (isPhotoNode(node)) return;

    if (isMealsListWrapper(node, p)) {
      if ("fills" in node && node.fills && node.fills.length) {
        node.fills = [];
        stats.wrappersCleared++;
        mutated.push(node.id);
      }
      if ("effects" in node) node.effects = [];
      clearStrokes(node);
    }

    const nm = (node.name || "").toLowerCase();
    if (nm.includes("remaining") && nm.includes("consumed") && node.type === "FRAME") {
      clearStrokes(node);
      setSolidFill(node, TRACK);
      stats.toggles++;
      mutated.push(node.id);
    }

    if (
      (nm.includes("thumb") || (nm.includes("image") && node.width < 90)) &&
      "strokes" in node &&
      node.strokes &&
      node.strokes.length
    ) {
      clearStrokes(node);
      stats.thumbs++;
      mutated.push(node.id);
    }

    if (isContentCard(node, p)) {
      setSolidFill(node, isDark ? CARD_DARK : CARD);
      stats.fills++;

      if ("strokes" in node && node.strokes && node.strokes.length) {
        const hadBorder = node.strokes.some(isBorderStroke);
        clearStrokes(node);
        if (hadBorder) stats.strokesCleared++;
      }

      if (!isDark && "effects" in node) {
        node.effects = [CARD_SOFT];
        stats.shadows++;
      } else if (isDark && "effects" in node) {
        node.effects = [];
        if ("strokes" in node) {
          node.strokes = [
            { type: "SOLID", color: { ...BORDER, a: 1 }, visible: true },
          ];
          node.strokeWeight = 1;
        }
      }
      mutated.push(node.id);
    } else if (
      "strokes" in node &&
      node.strokes &&
      node.strokes.some(isBorderStroke) &&
      !nm.includes("log dinner")
    ) {
      const isNorthOuter =
        (p.includes("What to eat") || p.includes("north star")) &&
        node.type === "FRAME";
      if (isNorthOuter) {
        clearStrokes(node);
        stats.strokesCleared++;
        mutated.push(node.id);
      }
    }

    if ("children" in node) {
      for (const child of node.children) walk(child, p);
    }
  }

  walk(root, "");
  return { frameId, isDark, stats, mutatedIds: mutated.slice(0, 80) };
}
