// Method 3: digitised newspaper archives that answer full-text searches with no key.
// For each trend and archive, count matching articles (or issues) per year and take the
// first cluster of mentions as the year the trend arrived in that country.
// Output: data/arrivals/newspapers.json.
//
// Reachable on 12 Nov 2026: Delpher (NL, to 1995), Nasjonalbiblioteket (NO, to today),
// Deutsche Digitale Bibliothek (DE, thin after 1950), eluxemburgensia (LU), DIGAR (EE).
// Not reachable without a key or a browser: see the dead ends in AGENTS.md.
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PARTS, TRENDS, get, readJson, writeJson } from './arrivals-lib.mjs';

const quote = (t) => (/\s|-/.test(t) ? `"${t}"` : t);
const tag = (xml, name) => xml.match(new RegExp(`<${name}>([^<]*)`))?.[1] ?? null;

const ARCHIVES = [
  {
    id: 'delpher',
    name: 'Delpher (Koninklijke Bibliotheek)',
    place: 'Netherlands',
    lang: 'nl',
    unit: 'articles',
    until: 1995,
    url(terms, y, n = 0) {
      const cql = `(${terms.map(quote).join(' or ')}) and date within "01-01-${y} 31-12-${y}"`;
      return `https://jsru.kb.nl/sru/sru?version=1.2&operation=searchRetrieve&x-collection=DDD_artikel&maximumRecords=${n}&query=${encodeURIComponent(cql)}`;
    },
    async count(terms, y) {
      return Number(tag(await get(this.url(terms, y), { as: 'text', pause: 60 }), 'srw:numberOfRecords'));
    },
    async example(terms, y) {
      const xml = await get(this.url(terms, y, 1), { as: 'text', pause: 60 });
      const title = tag(xml, 'dc:title');
      return title ? `Example: "${title}" (${tag(xml, 'dc:date')?.slice(0, 10).replaceAll('/', '-')}, ${tag(xml, 'dc:identifier')})` : '';
    },
    link: (terms) => `https://www.delpher.nl/nl/kranten/results?query=${encodeURIComponent(terms.map(quote).join(' OR '))}`,
  },
  {
    id: 'nb',
    name: 'Nasjonalbiblioteket',
    place: 'Norway',
    lang: 'nb',
    unit: 'newspaper issues',
    until: 2023,
    async count(terms, y) {
      const url = `https://api.nb.no/catalog/v1/items?q=${encodeURIComponent(terms.map(quote).join(' OR '))}&searchInFreeText=true&filter=mediatype:aviser&filter=date:%5B${y}0101%20TO%20${y}1231%5D&size=1`;
      return (await get(url, { pause: 60 })).page?.totalElements ?? 0;
    },
    link: (terms) => `https://www.nb.no/search?q=${encodeURIComponent(terms.map(quote).join(' OR '))}&mediatype=aviser`,
  },
  {
    id: 'ddb',
    name: 'Deutsche Digitale Bibliothek, Zeitungsportal',
    place: 'Germany',
    lang: 'de',
    unit: 'newspaper pages',
    until: 1994,
    thin: true, // only a few thousand pages a year after 1950, mostly East German titles
    async count(terms, y) {
      const url = `https://api.deutsche-digitale-bibliothek.de/search/index/newspaper-issues/select?rows=0&q=${encodeURIComponent(`plainpagefulltext:(${terms.map((t) => `"${t}"`).join(' OR ')})`)}&fq=${encodeURIComponent(`publication_date:[${y}-01-01T00:00:00Z TO ${y}-12-31T23:59:59Z]`)}`;
      return (await get(url, { pause: 60 })).response.numFound;
    },
    link: (terms) => `https://www.deutsche-digitale-bibliothek.de/search/newspaper?query=${encodeURIComponent(terms.map((t) => `"${t}"`).join(' OR '))}`,
  },
  {
    id: 'digar',
    name: 'DIGAR Eesti artiklid (National Library of Estonia)',
    place: 'Estonia',
    lang: 'et',
    unit: 'articles',
    until: 2023,
    async count(terms, y) {
      const url = `https://dea.digar.ee/?a=q&r=1&results=1&f=XML&dafyq=${y}&datyq=${y}&txq=${encodeURIComponent(terms.map(quote).join(' OR '))}`;
      return Number(tag(await get(url, { as: 'text', pause: 700 }), 'TotalNumberOfSearchResults') ?? 0);
    },
    link: (terms) => `https://dea.digar.ee/?a=q&txq=${encodeURIComponent(terms.map(quote).join(' OR '))}`,
  },
  {
    id: 'elux',
    name: 'eluxemburgensia (Bibliothèque nationale du Luxembourg)',
    place: 'Luxembourg',
    lang: 'lu', // terms.json keeps French and German spellings together under "lu"
    unit: 'articles',
    until: 2020,
    // One request per term returns every matching article with its date.
    async years(terms) {
      const byId = new Map();
      for (const t of terms) {
        for (let start = 0, total = 1; start < total; start += 1000) {
          const res = await get(`https://viewer.eluxemburgensia.lu/api/viewer2/search?rows=1000&start=${start}&query=${encodeURIComponent(`"${t}"`)}`, { pause: 300 });
          total = res.data.numFound;
          if (total > 12000) throw new Error(`"${t}" is too common to page through (${total} hits)`);
          for (const a of res.data.articles) if (a.documentType === 'newspaper') byId.set(a.id, Number(a.date.slice(0, 4)));
        }
      }
      const counts = {};
      for (const y of byId.values()) counts[y] = (counts[y] ?? 0) + 1;
      return counts;
    },
    link: (terms) => `https://viewer.eluxemburgensia.lu/search?query=${encodeURIComponent(`"${terms[0]}"`)}`,
  },
];

const SPAN = 30; // years searched after `from`
const WAVE = 15; // the first wave has to show inside this many years; later peaks are ignored

// First cluster: the first year whose count reaches the threshold with the next year reaching
// it too. The threshold is 5% of the busiest year of the first wave, at least 3, and at least
// twice the background level (the median of the first three years), because short words such
// as "punk" and "grunge" pick up OCR noise and older meanings long before the trend exists.
export function firstCluster(counts, from, to) {
  const c = (y) => counts[y] ?? 0;
  const years = [];
  for (let y = from; y <= to; y++) years.push(y);
  const wave = Math.max(0, ...years.filter((y) => y <= from + WAVE).map(c));
  const peak = wave >= 10 ? wave : Math.max(0, ...years.map(c));
  const background = [c(from), c(from + 1), c(from + 2)].sort((a, b) => a - b)[1];
  const threshold = Math.max(3, Math.ceil(peak * 0.05), background * 2);
  const year = peak >= 10 ? years.find((y) => y < to && c(y) >= threshold && c(y + 1) >= threshold) : null;
  return { peak, threshold, background, year: year ?? null, censored: year !== undefined && year <= from + 1 };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const terms = await readJson(join(PARTS, 'terms.json'), {});
  const broad = new Set(terms._broad ?? []);
  const out = [];
  for (const trend of TRENDS) {
    for (const archive of ARCHIVES) {
      const local = terms[trend.id]?.[archive.lang] ?? [];
      const to = Math.min(archive.until, trend.from + SPAN);
      const row = { trend: trend.id, archive: archive.id, archive_name: archive.name, place: archive.place, unit: archive.unit, terms: local, from: trend.from, to, arrival_year: null, why_not: null };
      out.push(row);
      if (!local.length) { row.why_not = 'no local term'; continue; }
      if (to - trend.from < 5) { row.why_not = `archive stops in ${archive.until}`; continue; }
      let counts = {};
      try {
        if (archive.years) counts = await archive.years(local);
        else for (let y = trend.from; y <= to; y++) counts[y] = await archive.count(local, y);
      } catch (err) {
        row.why_not = `request failed: ${err.message.slice(0, 60)}`;
        continue;
      }
      const { peak, background, year, censored } = firstCluster(counts, trend.from, to);
      row.counts = Object.fromEntries(Object.entries(counts).filter(([y]) => y >= trend.from && y <= to));
      row.peak = peak;
      if (!year) { row.why_not = peak ? `no cluster (busiest year has ${peak}, background ${background})` : 'no mentions'; continue; }
      if (censored) { row.why_not = 'already common in the first year searched'; continue; }
      row.arrival_year = year;
      const c = (y) => counts[y] ?? 0;
      // Trust: a sharp, large jump on an unambiguous word is high; thin archives and broad words cap at medium.
      const sharp = c(year - 1) + c(year - 2) <= (c(year) + c(year + 1)) / 4;
      row.background = background;
      row.confidence = peak >= 100 && sharp && !background && !broad.has(trend.id) && !archive.thin ? 'high' : peak >= 50 && (sharp || peak >= 100) && !archive.thin ? 'medium' : 'low';
      row.source = archive.link(local);
      const example = archive.example ? await archive.example(local, year) : '';
      row.source_sentence = `${archive.name}: ${archive.unit} matching ${local.map(quote).join(' OR ')} by year: ${[year - 2, year - 1, year, year + 1, year + 2].filter((y) => y >= trend.from && y <= to).map((y) => `${y}: ${c(y)}`).join(', ')}. ${example}`.trim();
    }
    console.log(`${trend.id}: ` + out.filter((r) => r.trend === trend.id).map((r) => `${r.place} ${r.arrival_year ?? `- (${r.why_not})`}`).join('; '));
  }
  await writeJson(join(PARTS, 'newspapers.json'), out);
}
