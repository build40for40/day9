import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..", "..");
const partsDir = join(root, "parts");
const outFile = join(repo, "public", "nerds-of-fashion", "fashion.json");

const YEARS = { from: 1920, to: 2026 };
const MAX_EXAMPLES = 6;
const MIN_RUNWAY_LOOKS = 100;
const REGIONS = {
  UK: "United Kingdom",
  US: "United States",
  FR: "France",
  IT: "Italy",
  global: "Not tied to one place",
};

const warnings = [];
const warn = (message) => warnings.push(message);

async function readPart(name) {
  try {
    return JSON.parse(await readFile(join(partsDir, `${name}.json`), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    warn(`parts/${name}.json is missing`);
    return null;
  }
}

const [trendsPart, revivalsPart, ngram, vam, met, runway, pantone, originRows] = await Promise.all(
  ["trends", "revivals", "ngram", "vam", "met", "runway", "pantone", "origins"].map(readPart),
);
const mappings = JSON.parse(await readFile(join(root, "mappings.json"), "utf8")).trends;

// Sourced origins, rival claims and roots: parts/origins.json, written by
// globe/origins/assemble.mjs (see the README). Added to each trend, nothing else changes.
const KIND_ORDER = { origin: 0, rival: 1, root: 2 };
const originsFor = (id) =>
  (originRows ?? [])
    .filter((r) => r.trend_id === id)
    .map(({ kind, place, lat, lon, year, year_precision, who, confidence, source_url, source_sentence }) => ({
      kind, place, lat, lon, year, yearPrecision: year_precision, who, confidence, url: source_url, quote: source_sentence,
    }))
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);

const byString = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const decadeOf = (year) => Math.floor(year / 10) * 10;
const inYears = (year) => Number.isInteger(year) && year >= YEARS.from && year <= YEARS.to;

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(byString)
      .map((key) => [key, sortKeysDeep(value[key])]),
  );
}

function addTo(counts, key, n = 1) {
  counts[key] = (counts[key] ?? 0) + n;
}

function sumByYear(seriesList) {
  const out = {};
  for (const series of seriesList)
    for (const [year, n] of Object.entries(series ?? {})) if (inYears(Number(year))) addTo(out, year, n);
  return out;
}

function byDecade(byYear) {
  const out = {};
  for (const [year, n] of Object.entries(byYear)) addTo(out, decadeOf(Number(year)), n);
  return out;
}

const trends = trendsPart?.trends ?? [];
const trendIds = new Set(trends.map((t) => t.id));
for (const id of Object.keys(mappings)) if (!trendIds.has(id)) warn(`mappings.json: unknown trend "${id}"`);

const vamObjects = (vam?.objects ?? []).filter((o) => inYears(o.year));
const vamTypes = new Set(vamObjects.map((o) => o.type));
const metTypes = new Set(Object.keys(met?.countsByTypeYear ?? {}));
const runwayTags = new Set(Object.keys(runway?.shareByTagYear ?? {}));
const runwayYears = new Set(
  Object.entries(runway?.looksByYear ?? {})
    .filter(([, looks]) => looks >= MIN_RUNWAY_LOOKS)
    .map(([year]) => year),
);

function vamRule(rule, trendId) {
  if (typeof rule === "string") rule = { type: [rule] };
  for (const type of rule.type ?? []) if (vam && !vamTypes.has(type)) warn(`${trendId}: no V&A type "${type}"`);
  const title = rule.title && new RegExp(rule.title, "i");
  const designer = rule.designer && new RegExp(rule.designer, "i");
  return (o) =>
    (!rule.type || rule.type.includes(o.type)) &&
    (!rule.material || o.materials.some((m) => rule.material.includes(m.toLowerCase()))) &&
    (!rule.colour || o.colours.some((c) => rule.colour.includes(c))) &&
    (!title || title.test(o.title ?? "")) &&
    (!designer || designer.test(o.designer ?? "")) &&
    (rule.from === undefined || o.year >= rule.from) &&
    (rule.to === undefined || o.year <= rule.to);
}

function vamMatches(trendId, rules) {
  const tests = rules.map((rule) => vamRule(rule, trendId));
  const matched = vamObjects.filter((o) => tests.some((test) => test(o)));
  if (rules.length && vam && !matched.length) warn(`${trendId}: V&A rules match nothing`);
  return matched;
}

function metCounts(trendId, names) {
  for (const name of names) if (met && !metTypes.has(name)) warn(`${trendId}: no Met object name "${name}"`);
  return sumByYear(names.map((name) => met?.countsByTypeYear?.[name]));
}

function runwayShares(trendId, tags) {
  for (const tag of tags) if (runway && !runwayTags.has(tag)) warn(`${trendId}: no runway tag "${tag}"`);
  const out = {};
  for (const tag of tags)
    for (const [year, share] of Object.entries(runway?.shareByTagYear?.[tag] ?? {}))
      if (runwayYears.has(year) && inYears(Number(year))) out[year] = Math.max(out[year] ?? 0, share);
  return out;
}

function mergedSpans(periods) {
  const spans = periods
    .map((p) => ({ start: Math.max(p.start, YEARS.from), end: p.end }))
    .filter((p) => p.end >= p.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);
  const out = [];
  for (const span of spans) {
    const last = out.at(-1);
    if (last && span.start <= last.end + 1) last.end = Math.max(last.end, span.end);
    else out.push({ ...span });
  }
  return out;
}

const byYearThenId = (a, b) => a.year - b.year || byString(a.id, b.id);

function pickExamples(objects, periods) {
  const candidates = objects.filter((o) => o.image).sort(byYearThenId);
  const spans = mergedSpans(periods);
  const buckets = spans.map((s) => candidates.filter((o) => o.year >= s.start && o.year <= s.end));
  const quotas = buckets.map(() => 0);
  let left = MAX_EXAMPLES;
  while (left > 0 && buckets.some((b, i) => quotas[i] < b.length)) {
    buckets.forEach((bucket, i) => {
      if (left > 0 && quotas[i] < bucket.length) {
        quotas[i]++;
        left--;
      }
    });
  }
  const picked = new Map();
  buckets.forEach((bucket, i) => {
    for (let k = 0; k < quotas[i]; k++) {
      const o = bucket[Math.floor(((k + 0.5) * bucket.length) / quotas[i])];
      picked.set(o.id, o);
    }
  });
  const distance = (o) => Math.min(...spans.map((s) => Math.max(s.start - o.year, o.year - s.end, 0)));
  const rest = candidates
    .filter((o) => !picked.has(o.id))
    .sort((a, b) => distance(a) - distance(b) || byYearThenId(a, b));
  for (const o of rest) {
    if (picked.size >= MAX_EXAMPLES) break;
    picked.set(o.id, o);
  }
  return [...picked.values()].sort(byYearThenId).map(({ id, title, year, designer, place, image, url }) => ({
    id,
    title,
    year,
    designer: designer ?? null,
    place: place ?? null,
    image,
    url,
  }));
}

function ngramFor(id) {
  const entry = ngram?.trends?.[id];
  if (!entry) return null;
  const series = Object.fromEntries((ngram.corpora ?? []).map((corpus) => [corpus, entry[corpus] ?? null]));
  return Object.values(series).some((s) => s) ? series : null;
}

const ngramLength = ngram ? ngram.to - ngram.from + 1 : 0;
for (const [id, entry] of Object.entries(ngram?.trends ?? {}))
  for (const corpus of ngram.corpora)
    if (entry[corpus] && entry[corpus].length !== ngramLength) warn(`ngram ${id} ${corpus}: wrong length`);

const outTrends = trends
  .map((t) => {
    const mapping = mappings[t.id] ?? {};
    const vamHits = vamMatches(t.id, mapping.vam ?? []);
    const counts = {};
    const vamByYear = {};
    for (const o of vamHits) addTo(vamByYear, o.year);
    if (Object.keys(vamByYear).length) counts.vam = vamByYear;
    const metByYear = metCounts(t.id, mapping.met ?? []);
    if (Object.keys(metByYear).length) counts.met = metByYear;
    const runwayByYear = runwayShares(t.id, mapping.runway ?? []);
    if (Object.keys(runwayByYear).length) counts.runway = runwayByYear;
    return {
      id: t.id,
      name: t.name,
      aliases: t.aliases,
      category: t.category,
      gender: t.gender,
      regions: [...t.regions].sort(byString),
      periods: [...t.periods].sort((a, b) => a.start - b.start || a.end - b.end || byString(a.region, b.region)),
      subculture: t.subculture,
      description: t.description,
      sources: t.sources.map(({ article, url, quote }) => ({ article, url, quote })),
      origins: originsFor(t.id),
      ngram: ngramFor(t.id),
      counts,
      examples: pickExamples(vamHits, t.periods),
    };
  })
  .sort((a, b) => byString(a.id, b.id));

const revivals = (revivalsPart?.revivals ?? [])
  .map(({ trend, subject, original, revival, article, quote }) => ({
    trend,
    subject,
    original: { start: original.start, end: original.end },
    revival: { start: revival.start, end: revival.end },
    article,
    quote,
  }))
  .sort(
    (a, b) =>
      (a.trend === null) - (b.trend === null) ||
      byString(a.trend ?? "", b.trend ?? "") ||
      a.original.start - b.original.start ||
      a.revival.start - b.revival.start ||
      byString(a.subject, b.subject) ||
      byString(a.article, b.article),
  );
for (const r of revivals) if (r.trend !== null && !trendIds.has(r.trend)) warn(`revival points at unknown trend ${r.trend}`);

const vamAllByYear = {};
for (const o of vamObjects) addTo(vamAllByYear, o.year);
const metAllByYear = sumByYear(Object.values(met?.countsByTypeYear ?? {}));
const runwayLooksByYear = Object.fromEntries(
  Object.entries(runway?.looksByYear ?? {}).filter(([year]) => runwayYears.has(year) && inYears(Number(year))),
);

const vamColours = {};
for (const o of vamObjects) for (const colour of o.colours) addTo((vamColours[colour] ??= {}), decadeOf(o.year));

const yearRange = (years) => {
  const list = years.map(Number).filter(Number.isFinite);
  return list.length ? `${Math.min(...list)} to ${Math.max(...list)}` : "no years";
};
const trendYears = trends.flatMap((t) => t.periods.flatMap((p) => [p.end]));
const pantoneYears = (pantone?.colours ?? []).map((c) => c.year);

const sources = [
  trendsPart && {
    id: "wikipedia",
    name: "Wikipedia fashion history articles",
    url: "https://en.wikipedia.org/wiki/1920s_in_Western_fashion",
    licence: "CC BY-SA 4.0",
    credit: "Wikipedia contributors, the decade in fashion and subculture articles",
    covers: `${YEARS.from} to ${Math.max(...trendYears)}: trend names, dates, regions, quotes and revivals`,
  },
  originRows && {
    id: "wikipedia-origins",
    name: "Wikipedia articles on individual garments and styles",
    url: "https://en.wikipedia.org/wiki/Category:History_of_clothing_(Western_fashion)",
    licence: "CC BY-SA 4.0",
    credit: "Wikipedia contributors, each trend's own article (linked on every row)",
    covers: `${new Set(originRows.map((r) => r.trend_id)).size} trends: where each started, rival claims and what it was borrowed from, each with the sentence that says so`,
  },
  ngram && {
    id: "ngram",
    name: "Google Books Ngram Viewer",
    url: "https://books.google.com/ngrams",
    licence: ngram.licence,
    credit: "Google Books Ngram Viewer, http://books.google.com/ngrams",
    covers: `${ngram.from} to ${ngram.to}: how often each trend's phrases appear in British and American English books, per million words`,
  },
  vam && {
    id: "vam",
    name: "Victoria and Albert Museum, Womenswear collection",
    url: "https://collections.vam.ac.uk",
    licence: "Data free to reuse; images non-commercial use with credit",
    credit: "© Victoria and Albert Museum, London",
    covers: `${yearRange(vamObjects.map((o) => o.year))}: ${vamObjects.length} womenswear objects with type, designer, place, materials and colours`,
  },
  met && {
    id: "met",
    name: "The Metropolitan Museum of Art, Costume Institute",
    url: "https://github.com/metmuseum/openaccess",
    licence: met.licence,
    credit: "The Metropolitan Museum of Art Open Access",
    covers: `${yearRange(Object.keys(metAllByYear))}: ${met.rows} Costume Institute objects counted by object name and year`,
  },
  runway && {
    id: "runway",
    name: "Vogue Runway looks",
    url: runway.source,
    licence: "None stated, so only derived counts are kept",
    credit: "Vogue Runway via the ROSCOSMOS Vogue Runway dataset on Hugging Face, auto tags from AWS Rekognition",
    covers: `${yearRange(Object.keys(runwayLooksByYear))}: share of catwalk looks carrying each auto tag, per collection year`,
  },
  pantone && {
    id: "pantone",
    name: "Pantone Color of the Year",
    url: pantone.source,
    licence: pantone.licence,
    credit: "Pantone Color of the Year, as listed on Wikipedia",
    covers: `${yearRange(pantoneYears)}: one colour a year, two in some years`,
  },
].filter(Boolean);

const caveats = [
  "This is mostly high fashion as written up in books, encyclopaedias and museums, not what everyone wore.",
  "Museums collect couture, famous designers and whatever happened to survive, so their counts show what got collected, not how popular something was.",
  "Museum collections thin out after 2000, so a drop in recent museum counts is about collecting, not fashion.",
  "Books trail clothes: the Ngram curves often peak years after a look was in the shops, and some phrases also mean other things, so compare the shape of a curve, not its height.",
  "Ngram data ends in 2022, so the newest micro trends have no curve.",
  `Runway counts start in 1988, are thin before 2000, and leave out years with fewer than ${MIN_RUNWAY_LOOKS} looks. They are shares of looks with an automatic image tag, and tagging changed over the years too.`,
  "Museum dates pile up on round years, because objects dated to a decade get its first year. Group by decade before reading too much into a single year.",
  "The scope is Western fashion: the UK, the US, France and Italy, plus looks not tied to one place.",
  "A few trend periods and revival originals start before 1920. Clamp them to the timeline if needed.",
  "Revivals with a null trend are era-wide comebacks such as 1970s styles; the subject field says what came back.",
  "Origins are only what one Wikipedia sentence says, checked word for word and reviewed by hand. An empty origins list means nobody found a quotable sentence, not that the trend has no history. Low confidence means the sentence hedges or gives no date. Origin years can be long before 1920 and are negative for BC. Coordinates for regions and peoples are a convention, not a fact.",
];

for (const name of ["trends", "revivals", "ngram", "vam", "met", "runway", "pantone", "origins"])
  if (warnings.includes(`parts/${name}.json is missing`))
    caveats.push(`The ${name} part was missing when this file was built, so its data is empty here.`);

const fetched = [ngram, vam, met, runway, pantone].map((p) => p?.fetched).filter(Boolean).sort();

const out = sortKeysDeep({
  meta: {
    title: "100 years of Western fashion trends",
    generated: fetched.at(-1) ?? "2026-11-12",
    years: YEARS,
    regions: REGIONS,
    sources,
    caveats,
  },
  trends: outTrends,
  revivals,
  series: {
    ngramYears: { from: ngram?.from ?? 1920, to: ngram?.to ?? 2022 },
    vamByDecade: byDecade(vamAllByYear),
    metByDecade: byDecade(metAllByYear),
    runwayLooksByYear,
  },
  colours: {
    pantone: (pantone?.colours ?? [])
      .map(({ year, name, hex }) => ({ year, name, hex }))
      .sort((a, b) => a.year - b.year || byString(a.name, b.name)),
    vam: vamColours,
  },
});

const json = JSON.stringify(out);
await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, json);

const withCounts = (source) => outTrends.filter((t) => t.counts[source]).length;
for (const message of warnings) console.warn(`warning: ${message}`);
console.log(
  [
    `wrote ${relative(repo, outFile)}: ${(Buffer.byteLength(json) / 1024).toFixed(0)} KB, ${(gzipSync(json).length / 1024).toFixed(0)} KB gzipped`,
    `${outTrends.length} trends, ${revivals.length} revivals`,
    `ngram data: ${outTrends.filter((t) => t.ngram).length}`,
    `counts: vam ${withCounts("vam")}, met ${withCounts("met")}, runway ${withCounts("runway")}, any ${outTrends.filter((t) => Object.keys(t.counts).length).length}`,
    `origins: ${outTrends.filter((t) => t.origins.length).length} trends, ${outTrends.reduce((n, t) => n + t.origins.length, 0)} rows`,
    `examples: ${outTrends.filter((t) => t.examples.length).length} trends, ${outTrends.reduce((n, t) => n + t.examples.length, 0)} objects`,
  ].join("\n"),
);
