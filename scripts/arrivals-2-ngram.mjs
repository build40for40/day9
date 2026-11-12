// Method 2: Google Books Ngram in other language corpora.
// For each trend and corpus, find the first sustained rise of the local term, then compare it
// with the rise of the English (or French) term in the origin corpus. Books run years late
// everywhere, so the useful number is the lag between the two rises, not the raw year.
// Output: data/arrivals/ngram.json.
//
// Gotcha: an unknown corpus name silently returns the English corpus. Hebrew is `iw`, not `he`.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PARTS, TRENDS, get, readJson, writeJson } from './arrivals-lib.mjs';

const START = 1900;
const END = 2022;
export const CORPORA = [
  { corpus: 'en-GB', lang: 'en', place: 'British English books' },
  { corpus: 'en-US', lang: 'en', place: 'American English books' },
  { corpus: 'fr', lang: 'fr', place: 'French-language books' },
  { corpus: 'de', lang: 'de', place: 'German-language books' },
  { corpus: 'es', lang: 'es', place: 'Spanish-language books' },
  { corpus: 'it', lang: 'it', place: 'Italian-language books' },
  { corpus: 'ru', lang: 'ru', place: 'Russian-language books' },
  { corpus: 'zh', lang: 'zh', place: 'Chinese-language books' },
  { corpus: 'iw', lang: 'he', place: 'Hebrew-language books' },
];

// All spellings of a term in one corpus, added together into one yearly series.
async function series(terms, corpus) {
  const url = `https://books.google.com/ngrams/json?content=${encodeURIComponent(terms.join(','))}&year_start=${START}&year_end=${END}&corpus=${corpus}&smoothing=0&case_insensitive=true`;
  const data = await get(url, { pause: 1200 });
  // With case_insensitive on, each term comes back as "<term> (All)" plus its spellings.
  const all = data.filter((d) => d.type !== 'EXPANSION');
  if (!all.length) return null;
  return all[0].timeseries.map((_, i) => all.reduce((sum, d) => sum + d.timeseries[i], 0));
}

const WINDOW = 15; // years after `from` in which the first wave has to show up

// First sustained rise: the first of three years running at or above a tenth of the busiest
// year in the window. The window matters: many terms peak decades later (books run late),
// and measuring against that late peak hides the first wave. Null when the term is too rare,
// or when it is already there in the first two years searched.
export function rise(values, from) {
  const first = from - START;
  const window = values.slice(first, first + WINDOW + 1);
  const peak = Math.max(...window);
  if (!(peak > 2e-9) || window.filter((v) => v > 0).length < 5) return null;
  for (let i = first; i <= first + WINDOW; i++) {
    if (values[i] >= peak / 10 && values[i + 1] >= peak / 10 && values[i + 2] >= peak / 10) {
      return i - first < 2 ? null : { rise_year: START + i, peak_year: START + first + window.indexOf(peak) };
    }
  }
  return null;
}

async function best(terms, corpus, from) {
  const values = await series(terms, corpus);
  return values ? rise(values, from) : null;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const terms = await readJson(join(PARTS, 'terms.json'), {});
  const out = [];
  for (const trend of TRENDS) {
    const origin = trend.origin_corpus ? await best(trend.en, trend.origin_corpus, trend.from) : null;
    for (const { corpus, lang, place } of CORPORA) {
      if (corpus === trend.origin_corpus) continue;
      const local = lang === 'en' ? trend.en : terms[trend.id]?.[lang] ?? [];
      const found = local.length ? await best(local, corpus, trend.from) : null;
      out.push({
        trend: trend.id,
        corpus,
        place,
        terms_tried: local,
        rise_year: found?.rise_year ?? null,
        peak_year: found?.peak_year ?? null,
        origin_corpus: trend.origin_corpus,
        origin_terms: trend.origin_corpus ? trend.en : null,
        origin_rise_year: origin?.rise_year ?? null,
        lag_years: found && origin ? found.rise_year - origin.rise_year : null,
      });
    }
    const mine = out.filter((r) => r.trend === trend.id);
    console.log(`${trend.id}: origin rise ${origin?.rise_year ?? 'none'} (${trend.origin_corpus}); ` + mine.map((r) => `${r.corpus} ${r.rise_year ?? '-'}`).join(', '));
  }
  await writeJson(join(PARTS, 'ngram.json'), out);
}
