import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
// read OPENAI_API_KEY from apps/mobile/.env.local
const envPath = resolve(__dir, '../../../apps/mobile/.env.local');
const env = readFileSync(envPath, 'utf8');
const KEY = (env.match(/^OPENAI_API_KEY=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, '');
if (!KEY) { console.error('no OPENAI_API_KEY'); process.exit(1); }

// Canonical ingredient-image prompt template (docs/ux/redesign/_design-system.md §11.1)
const tmpl = (item) => `${item}, single subject, isolated on pure white background, studio lighting, hyperreal photographic style, slight natural shadow below, food photography quality, no background textures, sharp focus, high detail, aspect ratio 1:1`;

const items = [
  ['allergen-shellfish', 'two fresh raw whole prawns (shrimp)'],
  ['allergen-peanuts',   'a small pile of peanuts in their shells'],
  ['allergen-gluten',    'one slice of toasted bread'],
  ['allergen-eggs',      'two whole brown chicken eggs'],
  ['allergen-soy',       'a small pile of dried soybeans'],
  ['allergen-dairy',     'a glass of milk'],
];

async function gen(item) {
  // try gpt-image-1, fall back to dall-e-3
  for (const model of ['gpt-image-1', 'dall-e-3']) {
    const body = model === 'gpt-image-1'
      ? { model, prompt: tmpl(item), size: '1024x1024', n: 1 }
      : { model, prompt: tmpl(item), size: '1024x1024', n: 1, response_format: 'b64_json' };
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (!r.ok) { console.error(`  ${model} failed:`, j.error?.message || r.status); continue; }
    const b64 = j.data?.[0]?.b64_json;
    if (b64) return Buffer.from(b64, 'base64');
    console.error(`  ${model}: no b64`);
  }
  return null;
}

for (const [name, item] of items) {
  process.stdout.write(`generating ${name} (${item})... `);
  const buf = await gen(item);
  if (buf) { writeFileSync(resolve(__dir, `img/${name}.png`), buf); console.log('ok', buf.length, 'bytes'); }
  else console.log('FAILED');
}
