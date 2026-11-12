// Monthly Wikipedia page views for each trend, per language edition.
//
// Reach beyond the UK, US and France: the Ngram curves only cover en-GB,
// en-US and fr, so this adds how much each trend is read about in other
// languages, from July 2015 (when the page view data starts) to last month.
//
// A language is not a country. Spanish covers Spain and Latin America,
// Portuguese is mostly Brazil, Arabic spans about 20 countries. Treat each
// curve as "interest among readers of this language".
//
// Usage: node scripts/pageviews.mjs
// Reads data/trends.json when it exists (rows with a `term`, and optionally
// a `wikipedia` article title), otherwise data/pageview-seed.json.
// Writes data/pageviews.json. No API key needed. Data is CC0.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const LANGS = {
  de: 'German',
  es: 'Spanish',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  sv: 'Swedish',
  pl: 'Polish',
  ru: 'Russian',
  tr: 'Turkish',
  ar: 'Arabic',
  hi: 'Hindi',
  id: 'Indonesian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
};
const START = '2015070100';
const UA = 'fashion-trends-research-script/0.1';
const PAUSE_MS = 1500; // the API rate limits anonymous scripts hard, so go slowly

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 404) return null;
    if (res.ok) return res.json();
    // On a 429 wait as long as the API asks, plus a little more each time.
    const wait = Number(res.headers.get('retry-after')) || 5;
    await sleep((wait + 5 * attempt) * 1000);
  }
  throw new Error(`Gave up on ${url}`);
}

function loadTrends() {
  if (existsSync('data/trends.json')) {
    const rows = JSON.parse(readFileSync('data/trends.json', 'utf8'));
    const seen = new Map();
    for (const r of rows) {
      if (r.term && !seen.has(r.term)) {
        seen.set(r.term, { term: r.term, article: r.wikipedia || r.term });
      }
    }
    return { source: 'data/trends.json', trends: [...seen.values()] };
  }
  const seed = JSON.parse(readFileSync('data/pageview-seed.json', 'utf8'));
  return { source: 'data/pageview-seed.json', trends: seed.trends };
}

// Resolve an English title (following redirects) and list the same article
// in the other languages we care about.
async function resolve(article) {
  const url =
    'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2' +
    '&redirects=1&prop=langlinks|pageprops&ppprop=disambiguation&lllimit=500&titles=' +
    encodeURIComponent(article);
  const data = await getJson(url);
  const page = data?.query?.pages?.[0];
  if (!page || page.missing) return null;
  const titles = {};
  for (const ll of page.langlinks || []) {
    if (LANGS[ll.lang]) titles[ll.lang] = ll.title;
  }
  return {
    title: page.title,
    disambiguation: Boolean(page.pageprops && 'disambiguation' in page.pageprops),
    titles,
  };
}

async function monthlyViews(lang, title, end) {
  const url =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/${lang}.wikipedia` +
    `/all-access/user/${encodeURIComponent(title.replace(/ /g, '_'))}/monthly/${START}/${end}`;
  const data = await getJson(url);
  const out = {};
  for (const item of data?.items || []) {
    out[`${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}`] = item.views;
  }
  return out;
}

function lastFullMonthEnd() {
  const d = new Date();
  d.setUTCDate(0); // last day of the previous month
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}${m}${day}00`;
}

const { source, trends } = loadTrends();
const end = lastFullMonthEnd();
// Rerunning picks up where the last run stopped: trends already in the
// output file are kept and not fetched again.
const previous = existsSync('data/pageviews.json')
  ? JSON.parse(readFileSync('data/pageviews.json', 'utf8'))
  : null;
const result = previous?.to === `${end.slice(0, 4)}-${end.slice(4, 6)}` ? previous.trends : {};
const skipped = [];
// All human page views per language edition per month. Wikipedia traffic
// has fallen since 2016 in most languages, so divide a trend's views by
// these before reading anything into a curve.
const totals = previous?.to === `${end.slice(0, 4)}-${end.slice(4, 6)}` ? previous.language_totals || {} : {};

async function languageTotals(lang) {
  const url =
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/aggregate/${lang}.wikipedia` +
    `/all-access/user/monthly/${START}/${end}`;
  const data = await getJson(url);
  const out = {};
  for (const item of data?.items || []) {
    out[`${item.timestamp.slice(0, 4)}-${item.timestamp.slice(4, 6)}`] = item.views;
  }
  return out;
}

function save() {
  mkdirSync('data', { recursive: true });
  writeFileSync(
    'data/pageviews.json',
    JSON.stringify(
      {
        source: 'Wikimedia Pageviews API, monthly, human readers only (CC0)',
        trend_list: source,
        from: '2015-07',
        to: `${end.slice(0, 4)}-${end.slice(4, 6)}`,
        languages: LANGS,
        caveat:
          'A language is not a country, and raw views favour big languages. Divide by language_totals for a share, and smooth it: one news story can spike a month in every language at once.',
        language_totals: totals,
        trends: result,
        skipped,
      },
      null,
      1,
    ) + '\n',
  );
}

for (const { term, article } of trends) {
  if (result[term]) continue;
  const page = await resolve(article);
  await sleep(PAUSE_MS);
  if (!page) {
    skipped.push({ term, article, why: 'no English article' });
    continue;
  }
  if (page.disambiguation) {
    skipped.push({ term, article, why: 'disambiguation page' });
    continue;
  }
  const languages = {};
  for (const [lang, title] of Object.entries(page.titles)) {
    const views = await monthlyViews(lang, title, end);
    await sleep(PAUSE_MS);
    if (Object.keys(views).length) languages[lang] = { title, views };
  }
  result[term] = { english_article: page.title, languages };
  console.log(`${term}: ${Object.keys(languages).length} languages`);
  save();
}

for (const lang of Object.keys(LANGS)) {
  if (totals[lang]) continue;
  totals[lang] = await languageTotals(lang);
  await sleep(PAUSE_MS);
}

save();
console.log(`\nWrote data/pageviews.json: ${Object.keys(result).length} trends, ${skipped.length} skipped`);
if (skipped.length) console.table(skipped);
