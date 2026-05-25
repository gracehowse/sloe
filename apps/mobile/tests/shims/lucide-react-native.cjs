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
    return React.createElement("View", { ...props, ref, accessibilityLabel: name });
  });
  Icon.displayName = name;
  return Icon;
}

/** Icons referenced anywhere under apps/mobile (auto-audit 2026-05-24). */
const ICON_NAMES = [
  "Activity",
  "AlertCircle",
  "AlignLeft",
  "Armchair",
  "ArrowDown",
  "ArrowLeft",
  "ArrowLeftRight",
  "ArrowRight",
  "ArrowUp",
  "ArrowUpDown",
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
  "Camera",
  "Candy",
  "Check",
  "CheckCircle2",
  "CheckSquare",
  "ChefHat",
  "ChevronDown",
  "ChevronLeft",
  "ChevronRight",
  "ChevronUp",
  "Circle",
  "CircleX",
  "Clipboard",
  "Clock",
  "CloudOff",
  "Code",
  "Coffee",
  "Cookie",
  "Copy",
  "Database",
  "Download",
  "Droplet",
  "Droplets",
  "Dumbbell",
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
  "ShieldCheck",
  "ShoppingCart",
  "Sliders",
  "Smartphone",
  "Snowflake",
  "Soup",
  "Sparkles",
  "Square",
  "Star",
  "Sun",
  "Tag",
  "Target",
  "Timer",
  "Trash2",
  "TrendingDown",
  "TrendingUp",
  "Trophy",
  "Upload",
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
