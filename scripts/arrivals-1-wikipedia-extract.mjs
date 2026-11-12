// Method 1, step B: have Claude pull dated country and city sentences out of each saved
// article, then keep only the rows whose quote really is in the article.
// Input:  data/raw/arrivals/wiki/<trend>/<lang>.txt (from arrivals-1-wikipedia-fetch.mjs)
// Output: data/raw/arrivals/extract/<trend>/<lang>.json (Claude's raw answer, cached)
//         data/arrivals/wikipedia.json (checked rows, committed)
//
// Needs ANTHROPIC_API_KEY for articles that have no cached answer yet. Without a key it
// only re-checks the answers already on disk. Model: ARRIVALS_MODEL or claude-sonnet-5-5.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { PARTS, RAW, ROOT, TRENDS, readJson, squash, writeJson } from './arrivals-lib.mjs';

const MODEL = process.env.ARRIVALS_MODEL || 'claude-sonnet-5-5';
const KEY = process.env.ANTHROPIC_API_KEY;
const prompt = await readFile(join(ROOT, 'scripts', 'arrivals-1-prompt.md'), 'utf8');

async function askClaude(term, article) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      system: prompt.replace('{{TERM}}', term),
      messages: [{ role: 'user', content: `<article>\n${article}\n</article>` }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = (await res.json()).content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

// A row survives only if its quote is in the article word for word and carries its own year.
function check(item, articleSquashed) {
  if (!item || typeof item.quote !== 'string' || !Number.isInteger(item.year) || !item.place) return 'malformed';
  if (!articleSquashed.includes(squash(item.quote))) return 'quote not in article';
  const digits = item.year_precision === 'decade' ? String(item.year).slice(0, 3) : String(item.year);
  // Decades may be written 60s, 60-е, 60er, 六十年代 and so on, so only the decade digit pair is required.
  const needle = item.year_precision === 'decade' ? digits.slice(1) : digits;
  if (!squash(item.quote).includes(needle)) return 'year not in quote';
  if (!['city', 'country'].includes(item.place_type)) return 'bad place_type';
  return null;
}

const index = await readJson(join(PARTS, 'wiki-index.json'), []);
const rows = [];
const stats = { articles: 0, missing: 0, kept: 0, dropped: {} };
for (const entry of index.filter((e) => e.kept)) {
  const trend = TRENDS.find((t) => t.id === entry.trend);
  const article = await readFile(join(RAW, 'wiki', entry.trend, entry.file), 'utf8');
  const file = join(RAW, 'extract', entry.trend, entry.file.replace(/\.txt$/, '.json'));
  let answer = await readJson(file, null);
  if (!answer && KEY) {
    try {
      answer = await askClaude(trend.term, article);
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(answer, null, 2) + '\n');
    } catch (err) {
      console.error(`${entry.trend}/${entry.lang}: ${err.message}`);
    }
  }
  if (!answer) { stats.missing++; continue; }
  stats.articles++;
  const text = squash(article);
  const source = `https://${entry.lang}.wikipedia.org/wiki/${encodeURIComponent(entry.title.replaceAll(' ', '_'))}`;
  for (const item of [answer.origin && { ...answer.origin, kind: 'origin' }, ...(answer.arrivals ?? []).map((a) => ({ ...a, kind: 'arrival' }))].filter(Boolean)) {
    const problem = check(item, text);
    if (problem) { stats.dropped[problem] = (stats.dropped[problem] ?? 0) + 1; continue; }
    stats.kept++;
    rows.push({ trend: entry.trend, kind: item.kind, place: item.place, place_type: item.place_type, year: item.year, year_precision: item.year_precision === 'decade' ? 'decade' : 'year', event: item.event ?? null, lang: entry.lang, article: entry.title, source, quote: item.quote.trim(), quote_en: item.quote_en ?? null });
  }
}
await writeJson(join(PARTS, 'wikipedia.json'), rows);
console.log(`${stats.articles} articles read, ${stats.missing} without an answer${KEY ? '' : ' (no ANTHROPIC_API_KEY set)'}; ${stats.kept} rows kept, dropped: ${JSON.stringify(stats.dropped)}`);
