// Method 1, step A: for each pilot trend, save the English Wikipedia article and every
// other-language article for the same topic (via langlinks) as plain text.
// Output: data/raw/arrivals/wiki/<trend>/<lang>.txt and data/arrivals/wiki-index.json.
//
// Article text comes from index.php?action=render, not api.php: the API rate limits anonymous
// scripts to a handful of requests a minute, the rendered page does not. Only the ten
// langlinks lookups go through the API.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PARTS, RAW, TRENDS, get, writeJson } from './arrivals-lib.mjs';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', apos: "'" };

// Rendered article HTML to readable text: drop tables, references, styles and edit links,
// keep headings and paragraphs on their own lines.
export function htmlToText(html) {
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

async function article(lang, title) {
  const url = `https://${lang}.wikipedia.org/w/index.php?action=render&title=${encodeURIComponent(title.replaceAll(' ', '_'))}`;
  return htmlToText(await get(url, { as: 'text', pause: 150 }));
}

const MIN_CHARS = 1500; // shorter articles are stubs that only define the term
const index = [];
await rm(join(RAW, 'wiki'), { recursive: true, force: true });
for (const trend of TRENDS) {
  const dir = join(RAW, 'wiki', trend.id);
  await mkdir(dir, { recursive: true });
  // Each source is one edition's article plus, optionally, every edition it links to.
  const sources = trend.wiki.map((title, n) => ({ lang: 'en', title, links: !trend.hub && n === 0 }));
  if (trend.hub) sources.push({ ...trend.hub, links: true });
  const seen = new Set();
  for (const source of sources) {
    let articles = [{ lang: source.lang, title: source.title }];
    if (source.links) {
      const api = `https://${source.lang}.wikipedia.org/w/api.php?format=json&formatversion=2&redirects=1&action=query&prop=langlinks&lllimit=500&titles=${encodeURIComponent(source.title)}`;
      const page = (await get(api)).query.pages[0];
      articles = [{ lang: source.lang, title: page.title }, ...(page.langlinks ?? [])];
    }
    for (const { lang, title } of articles) {
      let text = '';
      try {
        text = await article(lang, title);
      } catch (err) {
        console.error(`  skipped ${lang}:${title} (${err.message})`);
      }
      const kept = text.length >= MIN_CHARS;
      let file = `${lang}.txt`;
      for (let n = 2; seen.has(file); n++) file = `${lang}-${n}.txt`;
      seen.add(file);
      if (kept) await writeFile(join(dir, file), `# ${lang}.wikipedia.org: ${title}\n\n${text}\n`);
      index.push({ trend: trend.id, lang, title, chars: text.length, kept, file: kept ? file : null });
    }
  }
  const mine = index.filter((r) => r.trend === trend.id);
  console.log(`${trend.id}: ${mine.length} language editions, ${mine.filter((r) => r.kept).length} long enough to read`);
}
await writeJson(join(PARTS, 'wiki-index.json'), index);
