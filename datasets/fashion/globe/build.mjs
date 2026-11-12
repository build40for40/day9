// Builds the Trend Atlas globe page from the fashion dataset.
//
// Reads public/fashion.json, globe/arrivals-pilot.json
// (sourced arrival years for eight trends, from the day9 repo's
// arrivals-pilot branch) and globe/origins.json (sourced birthplaces, rival
// claims and roots from the origins research, built by globe/origins/), downloads one small V&A photo per trend into
// raw/globe/ (gitignored), and writes one self-contained HTML file to
// raw/globe/trend-atlas.html, ready to publish as an artifact. The site
// serves ../story instead; see the note near the end of this file.
//
// Usage, from the repo root: node datasets/fashion/globe/build.mjs
// Node with no dependencies. Deterministic once the photos are cached.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const HERE = 'datasets/fashion/globe';
const RAW = 'datasets/fashion/raw/globe';
const ben = JSON.parse(readFileSync('public/fashion.json', 'utf8'));
const pilot = JSON.parse(readFileSync(`${HERE}/arrivals-pilot.json`, 'utf8'));
const origins = JSON.parse(readFileSync(`${HERE}/origins.json`, 'utf8'));
const gazetteer = JSON.parse(readFileSync(`${HERE}/origins/places.json`, 'utf8')).places;
const researched = JSON.parse(readFileSync(`${HERE}/origins/pilot.json`, 'utf8')).trends;
mkdirSync(`${RAW}/vam`, { recursive: true });

// 1. Trends: a birthplace, the places each one reached, and when.
const REG = { UK: 'uk', US: 'us', FR: 'fr', IT: 'it' };
const CORE = new Set(Object.values(REG));
const PMAP = { miniskirt: 'miniskirt', 'punk fashion': 'punk', 'New Look (Dior)': 'new-look', 'bell-bottoms': 'bell-bottoms', 'hip hop fashion': 'hip-hop', 'grunge fashion': 'grunge', athleisure: 'athleisure', 'Harajuku street style': 'harajuku' };
const T = {};
for (const t of ben.trends) {
  const ps = {}, g = [];
  for (const p of t.periods) {
    const s = Math.max(1920, p.start), e = Math.min(2026, p.end);
    if (e < s) continue;
    if (p.region === 'global') g.push([s, e]); else (ps[REG[p.region]] ||= []).push([s, e]);
  }
  for (const k in ps) ps[k].sort((a, b) => a[0] - b[0]);
  g.sort((a, b) => a[0] - b[0]);
  const first = Object.entries(ps).map(([k, v]) => [k, v[0][0]]).sort((a, b) => a[1] - b[1]);
  const x = { id: t.id, n: t.name, c: t.category, d: t.description, ps, g, de: {}, o: [], y: null, first };
  const s0 = t.sources[0];
  if (s0) { x.q = s0.quote.length > 220 ? s0.quote.slice(0, 217).replace(/\s+\S*$/, '') + '…' : s0.quote; x.u = s0.url; }
  // A named country only counts as the birthplace if the trend is recorded there before it is recorded as worldwide.
  if (first.length && !(g.length && g[0][0] < first[0][1])) {
    x.y = first[0][1];
    x.o = first.filter((f) => f[1] === x.y).map((f) => f[0]);
    const waveEnd = Math.max(...x.o.map((k) => ps[k][0][1]));
    for (const [k, y] of first) if (!x.o.includes(k)) x.de[k] = { y, late: y > waveEnd + 5 ? 1 : 0 };
  }
  T[t.id] = x;
}

// 1b. Sourced origins: what each trend's own Wikipedia article says about where it
// started (origin), who else claims it (rival) and what it was borrowed from (root).
// A sourced origin beats the country rule above, which stays as the fallback.
const XPLACES = {}; // places beyond the fixed list that become dots with a wardrobe
const RANK = { high: 0, medium: 1, low: 2 };
const nodeFor = (r) => {
  const g = gazetteer[r.place];
  if (g.in) return g.in;
  const k = 'x-' + r.place.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  XPLACES[k] = [r.place, [r.lon, r.lat]];
  return k;
};
// One claim as the page wants it: name, [lon, lat], year, precision, who, confidence, quote, link.
const claim = (r) => {
  const g = gazetteer[r.place];
  return { n: r.place, c: [r.lon, r.lat], y: r.year, p: r.year_precision ? r.year_precision[0] : null, w: r.who, cf: r.confidence, q: r.source_sentence, u: r.source_url, west: g.in || g.west ? 1 : 0 };
};
const clamp = (y) => Math.min(2026, Math.max(1920, y));
const tally = { agrees: 0, overruled: 0, fresh: 0, rootOnly: 0 };
for (const id of new Set(origins.map((r) => r.trend_id))) {
  const t = T[id], mine = origins.filter((r) => r.trend_id === id);
  const o = mine.find((r) => r.kind === 'origin');
  const recorded = Math.min(...t.first.map((f) => f[1]), ...(t.g.length ? [t.g[0][0]] : []), 2026);
  // Journeys to every named country except `k`, when the old rule's birthplace no longer holds.
  const rejourney = (k) => {
    const own = t.ps[k];
    t.de = {};
    for (const [c, y] of t.first) if (c !== k) t.de[c] = { y, late: own && y > own[0][1] + 5 ? 1 : 0, ...(y < t.y ? { early: 1 } : {}) };
  };
  if (o) {
    const k = nodeFor(o);
    t.b = claim(o);
    if (t.o.includes(k)) {
      tally.agrees++;
      for (const other of t.o) if (other !== k) t.de[other] = { y: t.y, late: 0 };
    } else {
      tally[t.o.length ? 'overruled' : 'fresh']++;
      // Its year on the timeline: the sourced year if there is one (the timeline starts in 1920), else the earliest record anywhere.
      t.y = o.year != null ? Math.min(clamp(o.year), t.ps[k] ? t.ps[k][0][0] : Infinity) : recorded;
      rejourney(k);
    }
    t.o = [k];
  }
  t.v = mine.filter((r) => r.kind === 'rival').map(claim);
  t.r = mine.filter((r) => r.kind === 'root').sort((a, b) => RANK[a.confidence] - RANK[b.confidence]).map(claim);
  // A root and no birthplace at all: the root is the only anchor we have, so it stands in.
  if (!t.o.length && t.r.length) {
    const k = nodeFor(mine.find((r) => r.kind === 'root' && r.place === t.r[0].n));
    t.o = [k]; t.ro = 1; t.y = recorded; tally.rootOnly++;
    rejourney(k);
  }
}
for (const t of Object.values(T)) delete t.first;
// The pilot: sourced arrival years for places beyond Ben's four countries.
const PLACE = { 'United Kingdom': 'uk', London: 'uk', Paris: 'fr', France: 'fr', 'United States': 'us', 'New York City': 'us', Seattle: 'us', Tokyo: 'jp', Japan: 'jp',
  'Mexico City': 'mex', Germany: 'de', Melbourne: 'mel', Australia: 'mel', Italy: 'it', 'Soviet Union': 'su', Tanzania: 'tz', 'Vatican City': 'va',
  'South Korea': 'kr', Netherlands: 'nl', Norway: 'no', Estonia: 'ee', Luxembourg: 'lu', Romania: 'ro', Sweden: 'se' };
const ARCHIVE = { delpher: 'Dutch newspapers', nb: 'Norwegian newspapers', ddb: 'German newspapers', digar: 'Estonian newspapers', elux: 'Luxembourg newspapers' };
const rank = { high: 0, medium: 1, low: 2 };
T.harajuku = { id: 'harajuku', n: 'Harajuku street style', c: 'subculture', d: 'More layers, more colour, more everything, from one Tokyo district.', ps: {}, g: [], de: {}, o: [], y: null };
for (const r of pilot) {
  if (r.method === 'ngram' || !r.origin_place || !PMAP[r.term]) continue;
  const t = T[PMAP[r.term]], p = PLACE[r.place];
  if (!t.o.length) { t.o = [PLACE[r.origin_place]]; t.y = r.origin_year; t.q = r.origin_sentence.slice(0, 220); t.u = r.origin_source; }
  if (t.o.includes(p) || r.arrival_year < t.y) continue;
  if (CORE.has(p) && t.ps[p]) continue;
  let ev;
  if (r.method.startsWith('newspapers:')) {
    const c = Object.fromEntries(/by year: ([^.]*)/.exec(r.source_sentence)[1].split(',').map((s) => s.trim().split(': ').map(Number)));
    const prev = c[r.arrival_year - 1];
    ev = ARCHIVE[r.method.split(':')[1]] + ': ' + (prev === undefined ? '' : prev.toLocaleString('en-GB') + ' mentions in ' + (r.arrival_year - 1) + ', ') + c[r.arrival_year].toLocaleString('en-GB') + ' in ' + r.arrival_year + '.';
  } else {
    ev = (r.source_sentence_en || r.source_sentence).trim();
    if (ev.length > 220) ev = ev.slice(0, 217).replace(/\s+\S*$/, '') + '…';
    ev = 'Wikipedia: “' + ev + '”';
  }
  const a = { y: r.arrival_year, c: r.confidence, ev, url: r.source, dec: r.year_precision === 'decade' ? 1 : 0 };
  const had = t.de[p];
  if (!had || (had.c && (rank[a.c] < rank[had.c] || (rank[a.c] === rank[had.c] && a.y < had.y)))) t.de[p] = a;
}
const list = Object.values(T).filter((t) => t.o.length);
const ex = {};
for (const t of ben.trends) if (t.examples.length && T[t.id].o.length) ex[t.id] = [...t.examples].sort((a, b) => a.year - b.year)[0];

// 2. One V&A photo per trend, shrunk to 220px and embedded, because the
// artifact page cannot load images from other sites.
const thumbs = {};
for (const [id, e] of Object.entries(ex)) {
  const f = `${RAW}/vam/${id}.jpg`;
  if (!existsSync(f)) {
    const r = await fetch(e.image.replace('/full/!800,/', '/full/!220,/'), { headers: { 'User-Agent': 'fashion-trends-research-script/0.1' } });
    if (!r.ok || !(r.headers.get('content-type') || '').startsWith('image/jpeg')) { console.warn('no photo for', id, r.status); continue; }
    writeFileSync(f, Buffer.from(await r.arrayBuffer()));
    await new Promise((s) => setTimeout(s, 250));
  }
  const b = readFileSync(f);
  if (b.length > 40000 || b[0] !== 0xff || b[1] !== 0xd8) { console.warn('bad photo for', id); continue; }
  thumbs[id] = { s: 'data:image/jpeg;base64,' + b.toString('base64'), t: e.title, y: e.year, u: e.url, by: e.designer };
}

// 3. The page: shell + script, with the coastlines, trends and photos inlined.
const inline = (v) => JSON.stringify(v).replace(/<\//g, '<\\/');
let page = readFileSync(`${HERE}/page.html`, 'utf8') + readFileSync(`${HERE}/page.js`, 'utf8');
for (const [k, v] of [['LAND', JSON.parse(readFileSync(`${HERE}/land-110m.json`, 'utf8'))], ['DATA', list], ['THUMBS', thumbs], ['XPLACES', XPLACES]]) {
  if (!page.includes(`/*${k}*/null`)) throw new Error(`placeholder ${k} missing`);
  page = page.replace(`/*${k}*/null`, () => inline(v));
}
writeFileSync(`${RAW}/trend-atlas.html`, page);

// The site no longer serves this page: "Who Wore It First?" (../story) replaced it, and
// public/atlas.html now just redirects there. Pass --site to write the
// full atlas over that redirect again.
const SITE = 'public/atlas.html';
if (process.argv.includes('--site')) {
  const cut = page.indexOf('<div class="wrap">');
  writeFileSync(
    SITE,
    '<!doctype html>\n<html lang="en-GB">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<meta name="description" content="Where fashion trends were born, what they were borrowed from and where they went. Day 9 of 40 for 40.">\n' +
      '<link rel="icon" type="image/svg+xml" href="/favicon.svg">\n' +
      '<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n' +
      page.slice(0, cut) + '</head>\n<body>\n' + page.slice(cut) + '\n</body>\n</html>\n',
  );
}

// Coverage, so the page's claims can be checked against the data.
const total = ben.trends.length;
const pct = (n) => `${n} (${Math.round((n / total) * 100)}%)`;
const solid = (t) => Object.values(t.de).filter((d) => !d.late && !d.early && d.c !== 'low').length;
console.log(`Dataset trends:                 ${total}`);
console.log(`With a birthplace (on globe):   ${pct(list.filter((t) => ben.trends.some((b) => b.id === t.id)).length)}`);
console.log(`  ...and at least one journey:  ${pct(list.filter((t) => Object.keys(t.de).length).length)}`);
console.log(`  ...and a well dated journey:  ${pct(list.filter((t) => solid(t) >= 1).length)}`);
console.log(`  ...and three or more of them: ${pct(list.filter((t) => solid(t) >= 3).length)}`);
console.log(`No named country at all:        ${pct(ben.trends.filter((b) => b.periods.every((p) => p.region === 'global')).length)}`);
// The origins research: how much of the globe now rests on a sourced sentence.
const inData = list.filter((t) => ben.trends.some((b) => b.id === t.id));
const kinds = (k) => new Set(origins.filter((r) => r.kind === k).map((r) => r.trend_id)).size;
const beyond = new Set(origins.filter((r) => !gazetteer[r.place].in).map((r) => r.place)).size;
console.log(`Origins research, trends read:  ${researched.length} (${researched.filter((r) => r.title).length} have an article of their own)`);
console.log(`  sourced rows:                 ${origins.length} (${origins.filter((r) => r.confidence !== 'low').length} medium or high confidence)`);
console.log(`  gained a sourced origin:      ${kinds('origin')}`);
console.log(`  gained a rival claim:         ${kinds('rival')}`);
console.log(`  gained a root:                ${kinds('root')}`);
console.log(`Birthplace from a source:       ${pct(inData.filter((t) => t.b).length)}`);
console.log(`  ...same country as the rule:  ${tally.agrees}`);
console.log(`  ...overrules the rule:        ${tally.overruled}`);
console.log(`  ...new on the globe:          ${tally.fresh}`);
console.log(`Birthplace from the old rule:   ${pct(inData.filter((t) => !t.b && !t.ro).length)}`);
console.log(`On the globe by a root alone:   ${pct(tally.rootOnly)}`);
console.log(`Sent home beyond the West:      ${pct(inData.filter((t) => t.r && t.r.length && !t.ro && (!t.b || t.b.west)).length)}`);
console.log(`Sourced places outside the four countries: ${beyond}`);
console.log(`Photos embedded:                ${Object.keys(thumbs).length}`);
console.log(`Wrote ${RAW}/trend-atlas.html (${(page.length / 1024).toFixed(0)} KB)${process.argv.includes('--site') ? ` and ${SITE}` : ''}`);
