#!/usr/bin/env node
// One-shot: replace Material Symbols icon-font ligature spans with inline
// lucide SVGs so the Stitch captures bring real line icons into Figma
// (no overlap, no ligature text). Idempotent on already-swapped files
// (it only matches material-symbols spans).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ICONS = path.resolve(__dir, '../../../node_modules/lucide-react/dist/esm/icons');

// Material Symbols ligature -> lucide icon file basename
const MAP = {
  chevron_right: 'chevron-right', chevron_left: 'chevron-left',
  check: 'check', check_circle: 'circle-check',
  add: 'plus', add_circle: 'circle-plus', remove: 'minus',
  menu: 'menu', more_horiz: 'ellipsis', close: 'x',
  bookmark: 'bookmark', person: 'user',
  menu_book: 'book-open', import_contacts: 'book-open', auto_stories: 'book-open',
  book_5: 'book',
  calendar_today: 'calendar', today: 'calendar-days', event_note: 'notebook-pen',
  event_busy: 'calendar-x', schedule: 'clock', timer: 'timer',
  analytics: 'chart-column', equalizer: 'bar-chart-3', insights: 'trending-up',
  trending_up: 'trending-up', pie_chart: 'pie-chart', monitor_heart: 'activity',
  swap_horiz: 'arrow-left-right', search: 'search',
  restaurant_menu: 'utensils', restaurant: 'utensils',
  shopping_basket: 'shopping-basket', inventory_2: 'package',
  settings: 'settings', tune: 'sliders-horizontal', mic: 'mic', link: 'link',
  chat_bubble: 'message-circle', auto_awesome: 'sparkles', stars: 'sparkles',
  water_drop: 'droplet', track_changes: 'target', straighten: 'ruler',
  psychology: 'brain', policy: 'shield-check', play_arrow: 'play',
  photo_camera: 'camera', palette: 'palette', notifications: 'bell',
  lock: 'lock', local_fire_department: 'flame', ios_share: 'share-2',
  grass: 'sprout', grain: 'wheat', format_list_bulleted: 'list',
  flag: 'flag', fitness_center: 'dumbbell', favorite: 'heart',
  explore: 'compass', edit_square: 'square-pen', edit: 'pencil',
  download: 'download', description: 'file-text', cloud_sync: 'cloud',
  center_focus_weak: 'scan', barcode_scanner: 'scan-barcode',
  arrow_upward: 'arrow-up', arrow_forward: 'arrow-right',
  arrow_downward: 'arrow-down', arrow_back: 'arrow-left',
};

// 'play' isn't in our verified list but exists in lucide; ensure mapped files resolve.
function loadNode(name, depth = 0) {
  if (depth > 4) throw new Error('alias loop ' + name);
  const file = path.join(ICONS, name + '.js');
  const src = fs.readFileSync(file, 'utf8');
  const re = src.match(/export \{ default \} from '\.\/([\w-]+)\.js'/);
  if (re) return loadNode(re[1], depth + 1);
  const m = src.match(/const __iconNode = (\[[\s\S]*?\]);/);
  if (!m) throw new Error('no __iconNode in ' + name);
  // eslint-disable-next-line no-eval
  const arr = eval('(' + m[1] + ')');
  return arr.map(([tag, attrs]) => {
    const a = Object.entries(attrs)
      .filter(([k]) => k !== 'key')
      .map(([k, v]) => `${k}="${v}"`)
      .join(' ');
    return `<${tag} ${a}/>`;
  }).join('');
}

// Pre-render all inner SVGs we need
const inner = {};
for (const [, lucide] of Object.entries(MAP)) {
  if (!inner[lucide]) inner[lucide] = loadNode(lucide);
}

const svgCss = `
        /* lucide line icons (replaces Material Symbols font for faithful Figma capture) */
        svg.sloe-ico{width:1em;height:1em;font-size:24px;display:inline-block;
          vertical-align:-0.15em;flex:none;stroke:currentColor;fill:none;
          stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
`;

// span -> svg. Preserve classes (size/colour) minus the font + fill helper classes.
// Attribute-order-agnostic: span may carry data-icon, style, etc.
const SPAN_RE = /<span\b([^>]*?\bmaterial-symbols-outlined\b[^>]*?)>\s*([a-z0-9_]+)\s*<\/span>/g;

const files = fs.readdirSync(__dir).filter(f => f.endsWith('.html'));
const report = {};
for (const f of files) {
  const fp = path.join(__dir, f);
  let html = fs.readFileSync(fp, 'utf8');
  const missing = new Set();
  let count = 0;
  html = html.replace(SPAN_RE, (m, attrs, name) => {
    const lucide = MAP[name];
    if (!lucide) { missing.add(name); return m; }
    const clsMatch = attrs.match(/class="([^"]*)"/);
    const orig = clsMatch ? clsMatch[1] : '';
    const cls = ('sloe-ico ' + orig)
      .replace(/\bmaterial-symbols-outlined\b/g, '')
      .replace(/\bfilled-icon\b/g, '')
      .replace(/\bfill\b/g, '')
      .replace(/\s+/g, ' ').trim();
    count++;
    return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${inner[lucide]}</svg>`;
  });
  // Inject CSS once (after the material-symbols rule or before </style>)
  if (!html.includes('svg.sloe-ico') && html.includes('</style>')) {
    html = html.replace('</style>', svgCss + '    </style>');
  }
  fs.writeFileSync(fp, html);
  report[f] = { replaced: count, missing: [...missing] };
}
console.log(JSON.stringify(report, null, 2));
