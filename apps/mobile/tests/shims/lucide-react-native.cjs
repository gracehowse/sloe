"use strict";

/**
 * Vitest shim for lucide-react-native — every icon export becomes a
 * no-op host component so render tests can mount surfaces that import
 * dozens of glyphs without pulling the real SVG runtime.
 *
 * Named ESM imports (`import { Plus } from "lucide-react-native"`) need
 * real properties on `module.exports`; a Proxy alone leaves them undefined
 * after Vite's CJS interop. We assign every icon used in apps/mobile
 * explicitly and keep the Proxy as a fallback for anything new.
 */
const React = require("react");

function iconStub(name) {
  const Icon = React.forwardRef(function LucideIconStub(props, ref) {
    // A caller-supplied `accessibilityLabel` wins; only fall back to the icon
    // NAME when the component didn't label the glyph itself. The earlier order
    // (`{ ...props, accessibilityLabel: name }`) clobbered the caller's label,
    // so a component that deliberately labels its icon for VoiceOver
    // (e.g. weekly-recap's empty-state `<CalendarDays accessibilityLabel="Calendar icon">`)
    // rendered with the icon NAME instead — tests querying the real label failed.
    const { accessibilityLabel, ...rest } = props || {};
    return React.createElement("View", {
      ...rest,
      ref,
      accessibilityLabel: accessibilityLabel ?? name,
    });
  });
  Icon.displayName = name;
  return Icon;
}

/** Icons referenced anywhere under apps/mobile (auto-audit 2026-06-09).
 *
 *  This list must stay a faithful mirror of every lucide icon NAMED-imported
 *  anywhere under apps/mobile. Named imports (`import { Sprout }`) read the
 *  module's own enumerable properties after Vite's CJS interop — the Proxy
 *  fallback in `handler.get` only fires for direct property *access*
 *  (`Lucide.Sprout`), NOT for destructured named imports, so an icon missing
 *  from this list resolves to `undefined` and any component that named-imports
 *  it throws `Element type is invalid` at render. The 2026-06-09 reconciliation
 *  added Award/CheckCheck/CheckCircle/ClipboardList/Cloud/EyeOff/LayoutList/
 *  SlidersHorizontal/Sprout/User after a programmatic diff caught them missing
 *  (Sprout = the Today fibre-tile glyph, which crashed
 *  `todayMacroTilesProgressBar.test.tsx`). Keep this in sync by re-running the
 *  named-import diff when adding new glyphs. */
const ICON_NAMES = [
  "Activity",
  "AlertCircle",
  "AlertTriangle",
  "AlignLeft",
  "Armchair",
  "ArrowDown",
  "ArrowLeft",
  "ArrowLeftRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowUpDown",
  "Award",
  "BarChart3",
  "Barcode",
  "Beaker",
  "Beef",
  "Bell",
  "BookOpen",
  "Bookmark",
  "BookmarkCheck",
  "Calculator",
  "Calendar",
  "CalendarDays",
  "CalendarPlus",
  "Camera",
  "Candy",
  "Check",
  "CheckCheck",
  "CheckCircle",
  "CheckCircle2",
  "CheckSquare",
  "ChefHat",
  "ChevronDown",
  "ChevronLeft",
  "ChevronRight",
  "ChevronUp",
  "Circle",
  "CircleAlert",
  "CircleCheck",
  "CirclePlus",
  "CircleX",
  "Clipboard",
  "ClipboardList",
  "Clock",
  "Cloud",
  "CloudOff",
  "Code",
  "Coffee",
  "Cookie",
  "Copy",
  "Copyright",
  "Database",
  "Download",
  "Droplet",
  "Droplets",
  "Dumbbell",
  "EyeOff",
  "FileSpreadsheet",
  "FileText",
  "Fish",
  "Flag",
  "Flame",
  "Footprints",
  "Gauge",
  "Globe2",
  "Heart",
  "HeartPulse",
  "HelpCircle",
  "History",
  "Image",
  "Images",
  "Info",
  "LayoutGrid",
  "LayoutList",
  "Leaf",
  "LineChart",
  "Link",
  "Link2",
  "List",
  "Lock",
  "LogIn",
  "LogOut",
  "Mail",
  "Mic",
  "MicOff",
  "Minus",
  "Moon",
  "MoreHorizontal",
  "MoreVertical",
  "Palette",
  "Pencil",
  "PencilLine",
  "Pizza",
  "Play",
  "Plus",
  "PlusCircle",
  "RefreshCw",
  "RotateCcw",
  "RotateCw",
  "Salad",
  "Scale",
  "ScanBarcode",
  "ScanLine",
  "Search",
  "SearchX",
  "Settings",
  "Settings2",
  "Share2",
  "Shield",
  "ShieldAlert",
  "ShieldCheck",
  "ShoppingCart",
  "Sliders",
  "SlidersHorizontal",
  "Smartphone",
  "Snowflake",
  "Soup",
  "Sparkles",
  "Sprout",
  "Square",
  "Star",
  "Sun",
  "Sunrise",
  "Tag",
  "Target",
  "Timer",
  "Trash2",
  "TrendingDown",
  "TrendingUp",
  "Trophy",
  "Upload",
  "User",
  "Users",
  "Utensils",
  "UtensilsCrossed",
  "Wheat",
  "Wine",
  "X",
  "Zap",
];

const explicit = {};
for (const name of ICON_NAMES) {
  explicit[name] = iconStub(name);
}

const handler = {
  get(target, prop) {
    if (prop === "__esModule") return true;
    if (prop === "default") return target;
    if (Object.prototype.hasOwnProperty.call(target, prop)) {
      return target[prop];
    }
    return iconStub(String(prop));
  },
};

const icons = new Proxy(explicit, handler);

module.exports = icons;
module.exports.__esModule = true;
module.exports.default = icons;

for (const name of ICON_NAMES) {
  module.exports[name] = explicit[name];
}
