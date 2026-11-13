// Builds "Who Wore It First?": one short origin story per look, told in stops on a globe.
//
// Reads public/fashion.json (periods and origins) and
// globe/arrivals-pilot.json (sourced arrival years for a few looks), and writes:
//   raw/story/who-wore-it-first.html              the page as a Claude artifact (gitignored)
//   public/who-wore-it-first.html the same page with a document shell, served by the site
//
// Usage, from the repo root: node datasets/fashion/story/build.mjs
// Node with no dependencies. The first run downloads V&A photos into raw/globe/vam/.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const HERE = 'datasets/fashion/story';
const RAW = 'datasets/fashion/raw/story';
const PHOTOS = 'datasets/fashion/raw/globe/vam';
const SITE = 'public/who-wore-it-first.html';
mkdirSync(RAW, { recursive: true });
mkdirSync(PHOTOS, { recursive: true });
const ben = JSON.parse(readFileSync('public/fashion.json', 'utf8'));
const pilot = JSON.parse(readFileSync('datasets/fashion/globe/arrivals-pilot.json', 'utf8'));

// The stops, in the order the story is told:
//   root        what the look was borrowed from (origins of kind "root")
//   born        where it started: a sourced origin, else the first country the dataset records
//               it in (only when that is no later than its first worldwide period), marked a guess
//   rival       anyone else who claims it
//   went        other countries in the first wave, plus sourced arrivals from the pilot
//   everywhere  its first worldwide period
//   back        later waves
const CORE = { UK: ['United Kingdom', -0.13, 51.51], US: ['United States', -74.0, 40.71], FR: ['France', 2.35, 48.86], IT: ['Italy', 9.19, 45.46] };
const PLACE = { 'United Kingdom': [-0.13, 51.51], London: [-0.13, 51.51], Paris: [2.35, 48.86], France: [2.35, 48.86], 'United States': [-74.0, 40.71], 'New York City': [-74.0, 40.71],
  Seattle: [-122.33, 47.61], Tokyo: [139.69, 35.69], Japan: [139.69, 35.69], 'Mexico City': [-99.13, 19.43], Germany: [10.4, 51.1], Melbourne: [144.96, -37.81], Australia: [144.96, -37.81],
  Italy: [11.25, 43.77], 'Soviet Union': [37.62, 55.75], Tanzania: [35.7, -6.2], 'Vatican City': [12.45, 41.9], 'South Korea': [126.98, 37.57], Netherlands: [5.3, 52.2], Norway: [9.5, 61.0],
  Estonia: [25.5, 58.7], Luxembourg: [6.13, 49.6], Romania: [25.0, 45.9], Sweden: [16.0, 60.3] };
const PMAP = { miniskirt: 'miniskirt', 'punk fashion': 'punk', 'New Look (Dior)': 'new-look', 'bell-bottoms': 'bell-bottoms', 'hip hop fashion': 'hip-hop', 'grunge fashion': 'grunge', athleisure: 'athleisure' };
const ARCHIVE = { delpher: 'Dutch newspapers', nb: 'Norwegian newspapers', ddb: 'German newspapers', digar: 'Estonian newspapers', elux: 'Luxembourg newspapers' };
const rank = { high: 0, medium: 1, low: 2 };
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');
const when = (o) => o.year == null ? '' : o.year < 0 ? ` around ${-o.year} BC` : o.yearPrecision === 'century' ? ` in the ${ord(Math.floor(o.year / 100) + 1)} century` : o.yearPrecision === 'decade' ? ` in the ${Math.floor(o.year / 10) * 10}s` : ` in ${o.year}`;
const list = (a) => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const clip = (s, n = 230) => (s.length > n ? s.slice(0, n - 3).replace(/\s+\S*$/, '') + '…' : s);
const the = (n) => (/^(United|Netherlands|Soviet|Scottish Highlands|Scottish Lowlands|Scottish Borders|Indus Valley|South Pacific|Pyrenees|Rhine|Andes|Philippines|Caribbean|Middle East|Ottoman|Roman|British Raj|Bronx|Basque)/.test(n) ? 'the ' + n : n);
const homeOf = ([lon, lat]) => (lon > -8 && lon < 2 && lat > 49.5 && lat < 61 ? 'UK' : lon > 6.5 && lon < 18.5 && lat > 36 && lat < 47 ? 'IT' : lon > -5 && lon < 8.3 && lat > 42 && lat < 51.2 ? 'FR' : lon > -125 && lon < -66 && lat > 24 && lat < 50 ? 'US' : null);

// Hand-written captions for looks where the quote is real but "Born in X" would misread it:
// the place is where the look was first worn, launched, named or revived, not where it began.
// fold: its "borrowed from" claim is really a later chapter, so it joins this stop's receipts.
const REWORD = {
  'polo-shirt': { born: 'First worn at the 1926 US Open by René Lacoste, who designed it.' },
  fedora: { born: 'Named after Fédora, a play by Victorien Sardou that reached the United States in 1889.' },
  'desert-boots': { born: 'Launched at the 1949 Chicago Shoe Fair by Clarks.' },
  kaftan: { born: 'Born in West Asia, thousands of years ago. The West met it in the 1890s, on a Russian coronation dress.', fold: true },
  'bucket-hat': { born: 'Born in Ireland around 1900, on farmers and fishermen. The modern one comes from a US Army hat issued in Vietnam.', fold: true },
  'low-rise-jeans': { born: 'Brought back in 1993 by Alexander McQueen, whose bumster trousers started the revival.' },
  'chelsea-boots': { born: 'Named for Chelsea in London, where they came roaring back in the 1950s and 1960s.' },
};

const arrivals = {};
for (const r of pilot) {
  const id = PMAP[r.term];
  if (!id || r.method === 'ngram' || !PLACE[r.place] || (id === 'miniskirt' && (r.place === 'France' || r.place === 'Australia'))) continue;
  let text;
  if (r.method.startsWith('newspapers:')) {
    const c = Object.fromEntries(/by year: ([^.]*)/.exec(r.source_sentence)[1].split(',').map((s) => s.trim().split(': ').map(Number)));
    const prev = c[r.arrival_year - 1];
    text = ARCHIVE[r.method.split(':')[1]] + ': ' + (prev === undefined ? '' : prev.toLocaleString('en-GB') + ' mentions in ' + (r.arrival_year - 1) + ', ') + c[r.arrival_year].toLocaleString('en-GB') + ' in ' + r.arrival_year + '.';
  } else text = 'Wikipedia: “' + clip((r.source_sentence_en || r.source_sentence).trim()) + '”';
  const a = { place: r.place, at: PLACE[r.place], year: r.arrival_year, c: r.confidence, text, url: r.source };
  const had = (arrivals[id] ||= {})[r.place];
  if (!had || rank[a.c] < rank[had.c] || (rank[a.c] === rank[had.c] && a.year < had.year)) arrivals[id][r.place] = a;
}

const stories = [];
for (const t of ben.trends) {
  const named = {}, glob = [];
  for (const p of t.periods) {
    const s = Math.max(1920, p.start), e = Math.min(2026, p.end);
    if (e < s) continue;
    if (p.region === 'global') glob.push([s, e]); else (named[p.region] ||= []).push([s, e]);
  }
  for (const k in named) named[k].sort((a, b) => a[0] - b[0]);
  glob.sort((a, b) => a[0] - b[0]);
  const first = Object.entries(named).map(([k, v]) => [k, v[0][0], v[0][1]]).sort((a, b) => a[1] - b[1]);
  const og = [...(t.origins || [])].sort((a, b) => rank[a.confidence] - rank[b.confidence]);
  const origins = og.filter((o) => o.kind === 'origin');
  const fix = REWORD[t.id] || {};
  // A "root" that is the birthplace itself, or that is dated after the look was born, is a later
  // chapter of the story and not where it was borrowed from. Its quote joins the born stop instead.
  const later = (o) => fix.fold || (origins[0] && (o.place === origins[0].place || (o.year != null && origins[0].year != null && o.year > origins[0].year)));
  const allRoots = og.filter((o) => o.kind === 'root');
  const roots = allRoots.filter((o) => !later(o)), folded = allRoots.filter(later);
  const rivals = [...og.filter((o) => o.kind === 'rival'), ...origins.slice(1)];
  const receipt = (o) => ({ l: o.place, t: 'Wikipedia: “' + clip(o.quote) + '”', u: o.url, s: o.confidence === 'low' ? 1 : 0 });
  const stops = [];
  let born = null, home = null, bornYear = null, guess = false;
  if (origins[0]) {
    const o = origins[0];
    born = { n: o.place, at: [o.lon, o.lat] }; home = homeOf(born.at); bornYear = o.year;
    stops.push({ k: 'born', cap: fix.born || `Born in ${the(o.place)}${when(o)}.` + (o.who ? ` Credit goes to ${o.who}.` : ''), pts: [[o.lon, o.lat, o.place + (o.year > 0 && o.yearPrecision === 'year' ? ' ' + o.year : ''), o.confidence === 'low' ? 1 : 0]], rc: [receipt(o), ...folded.map(receipt)] });
  } else if (first.length && !(glob.length && glob[0][0] < first[0][1])) {
    const [k, y] = first[0], c = CORE[k];
    born = { n: c[0], at: [c[1], c[2]] }; home = k; bornYear = y; guess = true;
    const src = t.sources[0];
    stops.push({ k: 'born', cap: `First written up in ${the(c[0])} around ${y}. That's our best guess, not a birth certificate.`, pts: [[c[1], c[2], c[0] + ' ' + y, 1]],
      rc: [{ l: c[0], t: 'A guess: the first country our dataset records it in.' + (src ? ' Wikipedia: “' + clip(src.quote, 180) + '”' : ''), u: src ? src.url : null, s: 1 }] });
  }
  if (roots.length) {
    const seen = new Set(), places = roots.filter((o) => !seen.has(o.place) && seen.add(o.place)).sort((x, y) => (x.year ?? 9999) - (y.year ?? 9999));
    const dates = places.map(when), same = dates.every((d) => d === dates[0]);
    stops.unshift({ k: 'root', cap: `Borrowed from ${list(places.map((o, i) => the(o.place) + (same ? '' : dates[i])))}${same ? dates[0] : ''}.`,
      pts: roots.map((o) => [o.lon, o.lat, o.place, o.confidence === 'low' ? 1 : 0]), rc: roots.map(receipt) });
    // The line from each root reaches the birthplace on the "born" stop, not before it.
    const b = stops.find((x) => x.k === 'born');
    if (b) b.arcs = roots.map((o) => [o.lon, o.lat, born.at[0], born.at[1], o.confidence === 'low' ? 1 : 0]);
  }
  if (!born && !roots.length) continue;
  if (rivals.length) {
    const items = rivals.map((o) => (o.who ? `${o.who} in ${the(o.place)}` : the(o.place)));
    stops.push({ k: 'rival', cap: rivals.length === 1 ? `Or was it ${the(rivals[0].place)}? ` + (rivals[0].who ? `${rivals[0].who} gets the credit there.` : 'That claim is on record too.') : `Not everyone agrees. Also claimed by ${list(items.slice(0, 3))}${items.length > 3 ? ' and more' : ''}.`,
      pts: rivals.map((o) => [o.lon, o.lat, o.place + '?', 1]), ring: 1, rc: rivals.map(receipt) });
  }
  // Where it went: other countries in the first wave, plus sourced arrivals from the pilot.
  const old = !guess && (bornYear == null || bornYear < 1915);
  const went = [];
  const waveEnd = guess ? first[0][2] : null;
  for (const [k, y] of first) {
    if (guess ? k === first[0][0] || y > waveEnd + 5 : old ? glob.length && y > glob[0][0] : k === home || y < bornYear || y > bornYear + 25) continue;
    went.push({ n: CORE[k][0], at: [CORE[k][1], CORE[k][2]], y, s: 1, rc: null });
  }
  if (born) for (const a of Object.values(arrivals[t.id] || {})) {
    if (homeOf(a.at) === home || went.some((w) => w.n === a.place) || (bornYear && a.year < bornYear)) continue;
    went.push({ n: a.place, at: a.at, y: a.year, s: a.c === 'low' ? 1 : 0, rc: { l: a.place + ' ' + a.year, t: a.text, u: a.url, s: a.c === 'low' ? 1 : 0 } });
  }
  went.sort((a, b) => a.y - b.y);
  if (went.length) {
    const items = went.map((w) => `${the(w.n)} ${old ? 'around ' : ''}${w.y}`);
    const firsts = went.filter((w) => w.y === went[0].y).map((w) => the(w.n));
    const long = `Then it travelled to ${went.length} places between ${went[0].y} and ${went[went.length - 1].y}. ${list(firsts.slice(0, 3)).replace(/^t/, 'T')} got it first.`;
    const src = t.sources[0];
    stops.push({ k: 'went', cap: went.length > 4 ? long : (old ? 'Fashion caught up with it: ' : 'Then it travelled: ') + list(items) + '.', all: went.length > 4 ? went.map((w) => `${w.n} ${w.y}`) : undefined,
      pts: went.map((w) => [w.at[0], w.at[1], w.n + ' ' + w.y, w.s]), arcs: born ? went.map((w) => [born.at[0], born.at[1], w.at[0], w.at[1], w.s]) : [],
      rc: [...went.filter((w) => w.rc).map((w) => w.rc), ...(went.some((w) => !w.rc) ? [{ l: 'Dates for ' + list([...new Set(went.filter((w) => !w.rc).map((w) => w.n))]), t: 'From decade by decade fashion histories, so read each year as "around then".' + (src ? ' Wikipedia: “' + clip(src.quote, 160) + '”' : ''), u: src ? src.url : null, s: 1 }] : [])] });
  }
  const g0 = glob.find(([s]) => old || bornYear == null || s >= bornYear);
  if (g0) stops.splice(went.length && went[0].y > g0[0] ? stops.length - 1 : stops.length, 0, { k: 'everywhere', cap: `By ${g0[0]} it was everywhere.`, pts: [], rc: [{ l: 'Worldwide', t: 'The dataset records it as in fashion with no single place attached from around ' + g0[0] + '.', u: null, s: 1 }] });
  const firstEnd = Math.min(...[...Object.values(named).map((v) => v[0][1]), ...(glob[0] ? [glob[0][1]] : [])]);
  const backs = [...new Set([...Object.values(named).flatMap((v) => v.slice(1)), ...glob.slice(1)].map(([s]) => s).filter((s) => s > Math.max(firstEnd, g0 ? g0[0] : 0) + 3))].sort((a, b) => a - b);
  const merged = backs.filter((y, i) => i === 0 || y - backs[i - 1] > 4);
  if (merged.length) {
    const rv = ben.revivals.find((r) => r.trend === t.id);
    stops.push({ k: 'back', cap: merged.length === 1 ? `It came back around ${merged[0]}.` : `It keeps coming back: ${list(merged.slice(-5).map(String))}.`, pts: [],
      rc: [rv ? { l: 'Comeback', t: 'Wikipedia: “' + clip(rv.quote) + '”', u: 'https://en.wikipedia.org/wiki/' + encodeURIComponent(rv.article.replace(/ /g, '_')), s: 0 } : { l: 'Comebacks', t: 'Each year is the start of a later wave in the dataset.', u: null, s: 1 }] });
  }
  const s = { id: t.id, n: t.name, c: t.category, d: t.description, stops, home: roots.length ? list([...new Set(roots.map((o) => the(o.place)))]) : the(born.n), full: stops.length >= 4 ? 1 : 0 };
  // One V&A photo, shrunk to 220px and embedded, because an artifact cannot load images from other sites.
  if (t.examples.length) {
    const e = [...t.examples].sort((a, b) => a.year - b.year)[0], jpg = `${PHOTOS}/${t.id}.jpg`;
    if (!existsSync(jpg)) {
      const r = await fetch(e.image.replace('/full/!800,/', '/full/!220,/'), { headers: { 'User-Agent': 'fashion-trends-research-script/0.1' } });
      if (r.ok && (r.headers.get('content-type') || '').startsWith('image/jpeg')) { writeFileSync(jpg, Buffer.from(await r.arrayBuffer())); await new Promise((done) => setTimeout(done, 250)); }
      else console.warn('no photo for', t.id, r.status);
    }
    if (existsSync(jpg)) {
      const b = readFileSync(jpg);
      if (b.length < 40000 && b[0] === 0xff && b[1] === 0xd8) s.img = { s: 'data:image/jpeg;base64,' + b.toString('base64'), t: e.title, y: e.year, u: e.url };
    }
  }
  stories.push(s);
}
stories.sort((a, b) => a.n.localeCompare(b.n));

const inline = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');
let page = readFileSync(`${HERE}/page.html`, 'utf8');
for (const [k, v] of [['LAND', JSON.parse(readFileSync('datasets/fashion/globe/land-110m.json', 'utf8'))], ['DATA', stories]]) {
  if (!page.includes(`/*${k}*/null`)) throw new Error(`placeholder ${k} missing`);
  page = page.replace(`/*${k}*/null`, () => inline(v));
}
writeFileSync(`${RAW}/who-wore-it-first.html`, page);
// An artifact gets its document shell and a small reset from the host, so the site copy adds both.
const cut = page.indexOf('<div class="wrap">');
writeFileSync(
  SITE,
  '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
    '<meta name="description" content="Pick a look and a globe tells its origin story: what it was borrowed from, where it was born, who else claims it and where it went. Day 9 of 40 for 40.">\n' +
    '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n<style>body{margin:0}img{max-width:100%}</style>\n' +
    page.slice(0, cut) + '</head>\n<body>\n' + page.slice(cut) + '\n</body>\n</html>\n',
);

const n = (f) => stories.filter(f).length, has = (k) => (s) => s.stops.some((x) => x.k === k);
console.log(`Looks in the dataset:      ${ben.trends.length}`);
console.log(`Looks with a story:        ${stories.length}`);
console.log(`  ...of four stops or more: ${n((s) => s.full)}`);
console.log(`  borrowed from:           ${n(has('root'))}`);
console.log(`  born (sourced or guess): ${n(has('born'))}`);
console.log(`  disputed:                ${n(has('rival'))}`);
console.log(`  travelled:               ${n(has('went'))}`);
console.log(`  everywhere:              ${n(has('everywhere'))}`);
console.log(`  back again:              ${n(has('back'))}`);
console.log(`  with a photo:            ${n((s) => s.img)}`);
console.log(`Wrote ${RAW}/who-wore-it-first.html and ${SITE} (${(page.length / 1024).toFixed(0)} KB)`);
