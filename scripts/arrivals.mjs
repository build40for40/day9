// Reruns the arrivals pilot and builds data/arrivals.json: for ten trends, where each one
// started and the year it reached other places, with the source sentence on every row.
//
//   node scripts/arrivals.mjs            run every step (cached responses are reused), then assemble
//   node scripts/arrivals.mjs --assemble only rebuild data/arrivals.json from data/arrivals/*.json
//
// Steps: 1 Wikipedia in every language + Claude extraction, 2 Google Books Ngram,
// 3 newspaper archives, 4 Wikidata. Nothing here invents a year: a pair with no source is left out.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { PARTS, ROOT, TRENDS, readJson, writeJson } from './arrivals-lib.mjs';

if (!process.argv.includes('--assemble')) {
  for (const step of ['4-wikidata', '1-wikipedia-fetch', '1-wikipedia-extract', '2-ngram', '3-newspapers']) {
    console.log(`\n== ${step}`);
    const run = spawnSync(process.execPath, [join(ROOT, 'scripts', `arrivals-${step}.mjs`)], { stdio: 'inherit' });
    if (run.status !== 0) process.exit(run.status ?? 1);
  }
}

const wikipedia = await readJson(join(PARTS, 'wikipedia.json'), []);
const ngram = await readJson(join(PARTS, 'ngram.json'), []);
const newspapers = await readJson(join(PARTS, 'newspapers.json'), []);
const wikidata = await readJson(join(PARTS, 'wikidata.json'), []);
// Hand review: Wikipedia rows whose quote is real but does not date an arrival. Each has a reason.
const rejected = await readJson(join(PARTS, 'rejected.json'), []);

const mode = (list) => [...list].sort((a, b) => list.filter((v) => v === b).length - list.filter((v) => v === a).length)[0];

// Origin: Wikidata if it has both a place and a year (it never did in the pilot). Otherwise
// Wikipedia, in this order: an exact year in the English article, the exact year most editions
// agree on, a decade in the English article, the decade most editions agree on.
function originOf(trend) {
  const wd = wikidata.find((w) => w.trend === trend.id);
  const wdPlace = wd?.location_of_formation?.[0] ?? wd?.country_of_origin?.[0];
  if (wdPlace && wd?.inception?.[0]) {
    return { place: wdPlace, year: wd.inception[0], precision: 'year', source: `https://www.wikidata.org/wiki/${wd.qid}`, sentence: `Wikidata ${wd.qid}: inception ${wd.inception[0]}, origin ${wdPlace}` };
  }
  const rows = wikipedia.filter((r) => r.trend === trend.id && r.kind === 'origin').sort((a, b) => a.year - b.year);
  const exact = rows.filter((r) => r.year_precision === 'year');
  const decade = rows.filter((r) => r.year_precision === 'decade');
  const agreed = (list) => list.find((r) => r.year === mode(list.map((x) => x.year)));
  const pick = exact.find((r) => r.lang === 'en') ?? agreed(exact) ?? decade.find((r) => r.lang === 'en') ?? agreed(decade);
  return pick ? { place: pick.place, year: pick.year, precision: pick.year_precision, source: pick.source, sentence: pick.quote } : null;
}

// A city of origin and its own country are one place on the globe.
const COUNTRY_OF = { London: 'United Kingdom', Paris: 'France', 'New York City': 'United States', Seattle: 'United States', Tokyo: 'Japan' };
const REACH = 15; // a first arrival has to fall within this many years of the origin
// Bans and moral panics prove the trend was there by that year, not that it arrived that year.
const REACTION = /\b(ban|banned|bans|condemn\w*|law|fine[sd]?|arrest\w*|campaign|turned away)\b/i;

const rows = [];
const skipped = [];
for (const trend of TRENDS) {
  const origin = originOf(trend);
  const base = {
    term: trend.term,
    origin_place: origin?.place ?? null,
    origin_year: origin?.year ?? null,
    origin_year_precision: origin?.precision ?? null,
    origin_source: origin?.source ?? null,
    origin_sentence: origin?.sentence ?? null,
  };

  // Method 1: one row per place, the earliest dated sentence across all editions.
  const seen = new Map();
  const start = origin?.year ?? trend.from;
  for (const r of wikipedia.filter((r) => r.trend === trend.id && r.kind === 'arrival').sort((a, b) => a.year - b.year || (a.year_precision === 'year' ? -1 : 1))) {
    if (r.place === origin?.place || r.place === COUNTRY_OF[origin?.place]) continue;
    if (rejected.some((x) => x.trend === r.trend && x.place === r.place && x.lang === r.lang)) { skipped.push(`${trend.id} ${r.place} ${r.year} (${r.lang}): rejected by hand review`); continue; }
    if (r.year < start) { skipped.push(`${trend.id} ${r.place} ${r.year} (${r.lang}): before the origin year`); continue; }
    if (r.year > start + REACH) { skipped.push(`${trend.id} ${r.place} ${r.year} (${r.lang}): more than ${REACH} years after the origin, not a first arrival`); continue; }
    if (seen.has(r.place)) { seen.get(r.place).also.push(`${r.lang}: ${r.year}`); continue; }
    const reaction = REACTION.test(r.event ?? '');
    const row = { ...base, place: r.place, place_type: r.place_type, arrival_year: r.year, year_precision: r.year_precision, method: 'wikipedia', confidence: r.year_precision === 'year' && !reaction ? 'medium' : 'low', source: r.source, source_sentence: r.quote, source_sentence_en: r.quote_en, event: r.event, ...(reaction ? { year_is: 'latest' } : {}), also: [] };
    seen.set(r.place, row);
    rows.push(row);
  }
  for (const row of seen.values()) if (!row.also.length) delete row.also;

  // Method 3: newspapers, one row per archive that shows a first cluster.
  for (const n of newspapers.filter((n) => n.trend === trend.id && n.arrival_year)) {
    if (origin && n.arrival_year < origin.year - 1) { skipped.push(`${trend.id} ${n.place} ${n.arrival_year}: newspapers earlier than the origin year`); continue; }
    rows.push({ ...base, place: n.place, place_type: 'country', arrival_year: n.arrival_year, year_precision: 'year', method: `newspapers:${n.archive}`, confidence: n.confidence, source: n.source, source_sentence: n.source_sentence });
  }

  // Method 2: Ngram. The arrival year is the origin year plus the lag between the two rises.
  for (const g of ngram.filter((g) => g.trend === trend.id && g.lag_years !== null)) {
    if (!origin) { skipped.push(`${trend.id} ${g.corpus}: no sourced origin year to add the lag to`); continue; }
    if (g.lag_years < -1) { skipped.push(`${trend.id} ${g.corpus}: rises ${-g.lag_years} years before the origin corpus`); continue; }
    const lag = Math.max(0, g.lag_years);
    rows.push({
      ...base, place: g.place, place_type: 'language', arrival_year: origin.year + lag, year_precision: 'year', method: 'ngram', confidence: 'low',
      source: `https://books.google.com/ngrams/graph?content=${encodeURIComponent(g.terms_tried.join(','))}&year_start=${trend.from}&year_end=2022&corpus=${g.corpus}&smoothing=0&case_insensitive=true`,
      source_sentence: `Google Books Ngram: ${g.terms_tried.join(' / ')} first rises in the ${g.corpus} corpus in ${g.rise_year}; ${g.origin_terms.join(' / ')} rises in ${g.origin_corpus} in ${g.origin_rise_year}. Lag ${g.lag_years} years, added to the origin year ${origin.year}.`,
      ngram_rise_year: g.rise_year, origin_rise_year: g.origin_rise_year, lag_years: g.lag_years,
    });
  }
}

// Two different methods agreeing on a country within two years is the best evidence there is.
for (const row of rows) {
  const backup = rows.find((o) => o !== row && o.term === row.term && o.place === row.place && o.method.split(':')[0] !== row.method.split(':')[0] && o.year_precision === 'year' && row.year_precision === 'year' && Math.abs(o.arrival_year - row.arrival_year) <= 2);
  if (backup) { row.confidence = 'high'; row.agrees_with = backup.method; }
}

await writeJson(join(ROOT, 'data', 'arrivals.json'), rows);

const pairs = new Set(rows.map((r) => `${r.term}|${r.place}`));
const by = (key) => Object.entries(rows.reduce((acc, r) => ({ ...acc, [key(r)]: (acc[key(r)] ?? 0) + 1 }), {})).map(([k, v]) => `${k} ${v}`).join(', ');
console.log(`\n${rows.length} rows, ${pairs.size} distinct trend and place pairs`);
console.log(`by method: ${by((r) => r.method.split(':')[0])}`);
console.log(`by confidence: ${by((r) => r.confidence)}`);
console.log(`by trend: ${by((r) => r.term)}`);
if (skipped.length) console.log(`left out:\n  ${skipped.join('\n  ')}`);
