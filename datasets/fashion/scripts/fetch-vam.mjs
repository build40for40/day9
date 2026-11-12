// Pulls 20th and 21st century womenswear from the V&A Collections API into parts/vam.json.
// Usage: node fetch-vam.mjs [--offline]   (--offline builds from raw/vam/ without any requests)
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const rawDir = join(root, 'raw', 'vam');
const outFile = join(root, 'parts', 'vam.json');

const API = 'https://api.vam.ac.uk/v2';
const FETCHED = '2026-11-12';
const FIRST_YEAR = 1920;
const LAST_YEAR = 2029;
const CONCURRENCY = 4;
const OFFLINE = process.argv.includes('--offline');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readCache(file) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return undefined;
  }
}

async function writeCache(file, data) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(`${file}.tmp`, JSON.stringify(data));
  await rename(`${file}.tmp`, file);
}

async function getJson(url, cacheFile) {
  const cached = await readCache(cacheFile);
  if (cached !== undefined) return cached;
  if (OFFLINE) throw new Error(`not cached: ${url}`);
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': '40for40-fashion-dataset' } });
    } catch (err) {
      if (attempt >= 6) throw err;
      await sleep(1000 * 2 ** attempt);
      continue;
    }
    if (res.ok) {
      const data = await res.json();
      await writeCache(cacheFile, data);
      return data;
    }
    if (res.status === 404) {
      await writeCache(cacheFile, null);
      return null;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 6) {
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt);
      continue;
    }
    throw new Error(`${res.status} ${url}`);
  }
}

async function searchDecade(from) {
  const to = from + 9;
  const records = [];
  for (let page = 1; ; page++) {
    const params = new URLSearchParams({
      id_category: 'THES49044',
      id_collection: 'THES48601',
      year_made_from: String(from),
      year_made_to: String(to),
      page_size: '100',
      page: String(page),
    });
    const data = await getJson(
      `${API}/objects/search?${params}`,
      join(rawDir, 'search', `${from}-p${page}.json`),
    );
    records.push(...data.records);
    if (page >= data.info.pages) break;
  }
  return records;
}

async function mapPool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  let done = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      if (++done % 250 === 0) console.error(`  ${done}/${items.length}`);
    }
  });
  await Promise.all(workers);
  return results;
}

const REGION_BY_PLACE = {
  UK: [
    'England', 'London', 'Scotland', 'Wales', 'Northern Ireland', 'Great Britain', 'Britain',
    'United Kingdom', 'UK', 'Manchester', 'Birmingham', 'Liverpool', 'Leeds', 'Bristol', 'Bath',
    'Brighton', 'Nottingham', 'Leicester', 'Macclesfield', 'Coventry', 'Glasgow', 'Edinburgh',
    'Belfast', 'Oxford', 'Cambridge', 'Yorkshire', 'Lancashire', 'Northampton', 'Northamptonshire',
    'Norfolk', 'Suffolk', 'Essex', 'Kent', 'Surrey', 'Sussex', 'Devon', 'Cornwall', 'Derbyshire',
    'Cheshire', 'Hampshire', 'Somerset', 'Wiltshire', 'Gloucestershire', 'Middlesex', 'Hawick',
    'Galashiels', 'Paisley', 'Honiton', 'Luton', 'Bedfordshire', 'Street', 'Stockport',
    'Shetland', 'Fair Isle', 'Harris', 'Isle of Man', 'Bradford', 'Halifax', 'Huddersfield',
    'Sheffield', 'Newcastle', 'Newcastle upon Tyne', 'Cardiff', 'Dundee', 'Aberdeen', 'Leek',
    'Kidderminster', 'Wigan', 'Bolton', 'Oldham', 'Preston', 'Stoke-on-Trent', 'Kendal',
    'Swansea', 'Derby', 'Pontypridd', 'Spitalfields', 'Blackpool', 'Walsall', 'Pinner', 'Lewes',
    'Letchworth', 'Cumbria', 'Cotswolds', 'Chelsea', 'Buckinghamshire', 'Bromley', 'Braintree',
    'Ashbourne',
  ],
  FR: [
    'France', 'Paris', 'Lyon', 'Lyons', 'Calais', 'Marseille', 'Nice', 'Cannes', 'Saint-Tropez',
    'Biarritz', 'Deauville', 'Roubaix', 'Lille', 'Grenoble', 'Romans', 'Romans-sur-Isère', 'Millau',
  ],
  US: [
    'United States', 'USA', 'U.S.A.', 'America', 'New York', 'New York City', 'Los Angeles',
    'California', 'Hollywood', 'Chicago', 'Boston', 'Philadelphia', 'San Francisco', 'Dallas',
    'Texas', 'Florida', 'Miami', 'North Carolina', 'Massachusetts', 'New Jersey', 'Pennsylvania',
    'Illinois', 'Ohio', 'Michigan', 'Missouri', 'St Louis', 'St. Louis', 'Seattle', 'Washington',
    'Georgia', 'Tennessee', 'Connecticut', 'Virginia', 'Minnesota', 'Wisconsin', 'Oregon',
    'United States of America', 'Hawaii',
  ],
  IT: [
    'Italy', 'Milan', 'Milano', 'Rome', 'Roma', 'Florence', 'Firenze', 'Venice', 'Como', 'Naples',
    'Turin', 'Torino', 'Bologna', 'Vigevano', 'Prato', 'Biella', 'Capri', 'Parabiago',
  ],
};
const regionLookup = new Map();
for (const [region, places] of Object.entries(REGION_BY_PLACE)) {
  for (const place of places) regionLookup.set(place.toLowerCase(), region);
}

const cleanPlace = (place) => place.replace(/\s*(\((city|region)\)|\?)\s*$/i, '').trim();

function regionOf(places) {
  for (const place of places) {
    const region = regionLookup.get(cleanPlace(place).toLowerCase());
    if (region) return region;
  }
  return 'global';
}

const COLOUR_WORDS = {
  black: ['black', 'jet black', 'ebony'],
  white: ['white', 'snow white'],
  ivory: ['ivory', 'off-white', 'off white', 'ecru'],
  cream: ['cream', 'cream-coloured', 'cream coloured'],
  red: ['red', 'scarlet', 'crimson', 'vermilion', 'cherry'],
  burgundy: ['burgundy', 'maroon', 'claret', 'wine', 'oxblood', 'bordeaux'],
  pink: ['pink', 'fuchsia', 'cerise', 'magenta', 'shocking pink', 'salmon'],
  coral: ['coral', 'peach', 'apricot'],
  orange: ['orange', 'tangerine', 'rust'],
  yellow: ['yellow', 'lemon', 'primrose', 'canary'],
  mustard: ['mustard', 'ochre', 'saffron'],
  gold: ['gold', 'golden', 'gilt'],
  green: ['green', 'emerald', 'jade', 'bottle green', 'sage'],
  lime: ['lime', 'lime green', 'chartreuse'],
  olive: ['olive', 'olive green'],
  khaki: ['khaki'],
  turquoise: ['turquoise', 'aqua', 'aquamarine', 'teal', 'peacock blue'],
  blue: ['blue', 'sky blue', 'royal blue', 'cobalt', 'sapphire', 'cornflower', 'powder blue'],
  navy: ['navy', 'navy blue', 'midnight blue', 'dark blue'],
  purple: ['purple', 'violet', 'plum', 'aubergine', 'amethyst', 'magenta purple'],
  lilac: ['lilac', 'lavender', 'mauve', 'heliotrope'],
  brown: ['brown', 'chocolate', 'chestnut', 'tobacco', 'coffee', 'bronze'],
  tan: ['tan', 'caramel', 'camel'],
  beige: ['beige', 'fawn', 'taupe', 'oatmeal', 'nude', 'stone-coloured', 'biscuit'],
  grey: ['grey', 'gray', 'charcoal', 'slate', 'dove grey', 'pewter'],
  silver: ['silver', 'silvered'],
  metallic: ['metallic', 'lamé', 'lurex'],
  multicoloured: [
    'multicoloured', 'multi-coloured', 'multicolored', 'multi-colored', 'multicolour',
    'multi-colour', 'rainbow', 'polychrome',
  ],
};
const colourPatterns = Object.entries(COLOUR_WORDS)
  .flatMap(([colour, words]) => words.map((word) => [colour, word]))
  .sort((a, b) => b[1].length - a[1].length)
  .map(([colour, word]) => [colour, new RegExp(`(?<![\\w-])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w-])`, 'gi')]);

// "camel hair", "gold thread" style material phrases are not colours of the garment.
const NOT_COLOUR = /\b(camel[- ]hair|silver[- ]gilt|white metal|wine glass|rust[- ]proof|nude[- ]coloured lining)\b/gi;

function coloursOf(...texts) {
  let text = texts.filter(Boolean).join(' . ').replace(NOT_COLOUR, ' ');
  const found = new Set();
  for (const [colour, pattern] of colourPatterns) {
    text = text.replace(pattern, () => {
      found.add(colour);
      return ' ';
    });
  }
  return Object.keys(COLOUR_WORDS).filter((c) => found.has(c));
}

const UNKNOWN_MAKER = /^(unknown|not known|anonymous)$/i;

function designerOf(summary, record) {
  const people = [...(record.artistMakerPerson ?? []), ...(record.artistMakerOrganisations ?? [])];
  const designer = people.find((p) => /designer/i.test(p.association?.text ?? ''));
  const name = designer?.name?.text || summary._primaryMaker?.name || people[0]?.name?.text || '';
  return name && !UNKNOWN_MAKER.test(name.trim()) ? name.trim() : null;
}

function yearOf(record) {
  const earliest = record.productionDates?.[0]?.date?.earliest;
  const year = earliest ? Number.parseInt(earliest.slice(0, 4), 10) : Number.NaN;
  return Number.isInteger(year) ? year : null;
}

function toObject(summary, record) {
  const year = yearOf(record);
  const place = cleanPlace(summary._primaryPlace || record.placesOfOrigin?.[0]?.place?.text || '') || null;
  const allPlaces = [place, ...(record.placesOfOrigin ?? []).map((p) => p.place?.text)].filter(Boolean);
  const title =
    summary._primaryTitle || record.titles?.[0]?.title || record.objectType || summary.objectType;
  const imageId = summary._primaryImageId || record.images?.[0] || null;
  return {
    id: summary.systemNumber,
    year,
    type: (record.objectType || summary.objectType || 'unknown').trim().toLowerCase(),
    title: title.trim(),
    designer: designerOf(summary, record),
    place,
    region: regionOf(allPlaces),
    materials: [...new Set((record.materials ?? []).map((m) => m.text.replace(/\s*\([^)]*\)\s*$/, '').trim().toLowerCase()).filter(Boolean))],
    colours: coloursOf(record.physicalDescription, summary._primaryTitle, record.titles?.[0]?.title),
    image: imageId ? `https://framemark.vam.ac.uk/collections/${imageId}/full/!800,/0/default.jpg` : null,
    url: `https://collections.vam.ac.uk/item/${summary.systemNumber}/`,
  };
}

const summaries = new Map();
for (let from = FIRST_YEAR; from <= LAST_YEAR; from += 10) {
  const records = await searchDecade(from);
  console.error(`${from}s: ${records.length} search records`);
  for (const r of records) if (!summaries.has(r.systemNumber)) summaries.set(r.systemNumber, r);
}
console.error(`${summaries.size} unique objects, fetching details`);

const list = [...summaries.values()];
const details = await mapPool(list, CONCURRENCY, (s) =>
  getJson(`${API}/museumobject/${s.systemNumber}`, join(rawDir, 'objects', `${s.systemNumber}.json`)),
);

const objects = [];
let missing = 0;
let outOfRange = 0;
list.forEach((summary, i) => {
  const record = details[i]?.record;
  if (!record) {
    missing++;
    return;
  }
  const object = toObject(summary, record);
  if (object.year === null || object.year < FIRST_YEAR || object.year > LAST_YEAR) {
    outOfRange++;
    return;
  }
  objects.push(object);
});
objects.sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));

const countsByTypeYear = {};
for (const { type, year } of objects) {
  countsByTypeYear[type] ??= {};
  countsByTypeYear[type][year] = (countsByTypeYear[type][year] ?? 0) + 1;
}

await writeFile(
  outFile,
  `${JSON.stringify(
    {
      source:
        'V&A Collections API (api.vam.ac.uk/v2), Womenswear (THES49044) in Textiles and Fashion (THES48601). Images © Victoria and Albert Museum, London, non-commercial use with credit.',
      fetched: FETCHED,
      objects,
      countsByTypeYear,
    },
    null,
    2,
  )}\n`,
);
console.error(`wrote ${objects.length} objects (${missing} missing details, ${outOfRange} outside ${FIRST_YEAR}-${LAST_YEAR})`);
