// Step 1: save each pilot trend's own English Wikipedia article as plain text.
// Output: raw/origins/<trend_id>.txt (gitignored) and origins/articles.json (the index).
//
// Text comes from index.php (action=raw to follow redirects, action=render for the page),
// not api.php, which rate limits anonymous scripts to a few requests a minute.
//
// Usage, from the repo root: node datasets/fashion/globe/origins/fetch.mjs [--force]
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { HERE, PILOT, RAW } from './lib.mjs';

const UA = 'fashion-trends-research-script/0.1';
const force = process.argv.includes('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', apos: "'" };
const page = (title, action) => `https://en.wikipedia.org/w/index.php?action=${action}&title=${encodeURIComponent(title.replaceAll(' ', '_'))}`;

async function get(url) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'user-agent': UA } });
    if (res.ok) { await sleep(200); return res.text(); }
    if (res.status === 404) return null;
    if (attempt >= 4) throw new Error(`${res.status} ${url}`);
    await sleep(5000 * (attempt + 1));
  }
}

// Rendered article HTML to readable text: drop tables, references, styles and edit links,
// keep headings and paragraphs on their own lines.
function htmlToText(html) {
  return html
    .replace(/<(style|script|table|figure|sup|noscript)\b[\s\S]*?<\/\1>/g, '')
    .replace(/<span class="mw-editsection">[\s\S]*?<\/span><\/span>/g, '')
    .replace(/<(ol|div) class="(references|reflist|navbox|mw-references-wrap)[\s\S]*$/, '')
    .replace(/<h([1-6])[^>]*>/g, '\n\n== ')
    .replace(/<\/(p|h[1-6]|li|dd|dt|blockquote)>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(\w+);/g, (m, name) => ENTITIES[name] ?? m)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

mkdirSync(RAW, { recursive: true });
const index = [];
for (const t of PILOT) {
  if (!t.title) { index.push({ trend_id: t.id, title: null, url: null, chars: 0, note: 'no article of its own' }); continue; }
  const file = `${RAW}/${t.id}.txt`;
  let title = t.title;
  for (let hop = 0; hop < 3; hop++) {
    const raw = await get(page(title, 'raw'));
    if (raw === null) { title = null; break; }
    const m = /^#REDIRECT\s*\[\[([^\]#|]+)/i.exec(raw);
    if (!m) break;
    title = m[1].trim();
  }
  if (!title) { console.error(`missing  ${t.id}: ${t.title}`); index.push({ trend_id: t.id, title: t.title, url: null, chars: 0, note: 'article not found' }); continue; }
  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(' ', '_')).replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')')}`;
  let text;
  if (!force && existsSync(file)) text = (await import('node:fs')).readFileSync(file, 'utf8');
  else { text = `# ${title}\n# ${url}\n\n${htmlToText(await get(page(title, 'render')))}\n`; writeFileSync(file, text); }
  index.push({ trend_id: t.id, title, url, chars: text.length, ...(title !== t.title ? { redirected_from: t.title } : {}) });
  console.log(`${t.id.padEnd(22)} ${title} (${text.length} chars)`);
}
writeFileSync(`${HERE}/articles.json`, JSON.stringify(index, null, 2) + '\n');
console.log(`${index.filter((r) => r.url).length} of ${PILOT.length} trends have an article`);
