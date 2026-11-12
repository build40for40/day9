// Step 5: turn the checked and hand reviewed claims into globe/origins.json (and its copy, the
// dataset part parts/origins.json) and globe/rejected.json.
//
// Reads origins/checked.json (from check.mjs), origins/review.json (the hand review: a verdict
// and reason for every claim that passed the rules, with optional corrections) and
// origins/places.json (latitude and longitude for each place name, typed in by hand).
// Refuses to finish if a claim has no verdict or a kept place has no coordinates.
//
// Usage, from the repo root: node datasets/fashion/globe/origins/assemble.mjs
import { writeFileSync } from 'node:fs';
import { HERE, PILOT, readJson } from './lib.mjs';

const OUT = 'datasets/fashion/globe';
const checked = readJson(`${HERE}/checked.json`, []);
const review = readJson(`${HERE}/review.json`, {}).verdicts || {};
const places = readJson(`${HERE}/places.json`, {}).places || {};
const order = Object.fromEntries(PILOT.map((t, i) => [t.id, i]));
const KIND = { origin: 0, rival: 1, root: 2 };

// Confidence is a rule, not a feeling: high = an exact year and no hedging in the quote,
// low = hedged, or no better than a century, or no date at all, medium = the rest.
// The hand review can only lower it.
const RANK = ['high', 'medium', 'low'];
function confidence(r, v) {
  const rule = r.hedged || r.year == null || r.year_precision === 'century' ? 'low' : r.year_precision === 'year' ? 'high' : 'medium';
  return v.confidence && RANK.indexOf(v.confidence) > RANK.indexOf(rule) ? v.confidence : rule;
}

const rows = [], rejected = [], problems = [];
for (const c of checked) {
  if (c.fail) { rejected.push({ trend_id: c.trend_id, kind: c.kind, place: c.place, year: c.year, stage: 'rule', reason: c.fail, source_url: c.source_url, source_sentence: c.source_sentence }); continue; }
  const v = review[c.key];
  if (!v) { problems.push(`no verdict for ${c.key}`); continue; }
  if (v.verdict === 'reject') { rejected.push({ trend_id: c.trend_id, kind: c.kind, place: c.place, year: c.year, stage: 'hand review', reason: v.reason, source_url: c.source_url, source_sentence: c.source_sentence }); continue; }
  // The review may correct how a real quote was filed (kind, place, year, who), never the quote.
  const r = { ...c, ...Object.fromEntries(['kind', 'place', 'year', 'year_precision', 'who', 'hedged'].filter((k) => k in v).map((k) => [k, v[k]])) };
  const p = places[r.place];
  if (!p) { problems.push(`no coordinates for "${r.place}" (${c.key})`); continue; }
  rows.push({ trend_id: r.trend_id, kind: r.kind, place: r.place, lat: p.lat, lon: p.lon, year: r.year, year_precision: r.year == null ? null : r.year_precision, who: r.who,
    confidence: confidence(r, v), source_url: r.source_url, source_sentence: r.source_sentence });
}
// One origin per trend, and a rival needs an origin to rival.
for (const id of new Set(rows.map((r) => r.trend_id))) {
  const mine = rows.filter((r) => r.trend_id === id), o = mine.filter((r) => r.kind === 'origin').length;
  if (o > 1) problems.push(`${id} has ${o} origins`);
  if (!o && mine.some((r) => r.kind === 'rival')) problems.push(`${id} has a rival but no origin`);
}
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
rows.sort((a, b) => order[a.trend_id] - order[b.trend_id] || KIND[a.kind] - KIND[b.kind]);
writeFileSync(`${OUT}/origins.json`, JSON.stringify(rows, null, 2) + '\n');
// The same rows as a dataset part, so scripts/assemble.mjs can fold them into fashion.json.
writeFileSync('datasets/fashion/parts/origins.json', JSON.stringify(rows, null, 2) + '\n');
writeFileSync(`${OUT}/rejected.json`, JSON.stringify(rejected, null, 2) + '\n');

const has = (k) => new Set(rows.filter((r) => r.kind === k).map((r) => r.trend_id)).size;
const read = PILOT.filter((t) => t.title).length;
console.log(`Trends researched:       ${PILOT.length} (${read} with an article to read)`);
console.log(`Claims kept:             ${rows.length} of ${checked.length} extracted`);
console.log(`  rejected by a rule:    ${rejected.filter((r) => r.stage === 'rule').length}`);
console.log(`  rejected by hand:      ${rejected.filter((r) => r.stage === 'hand review').length}`);
console.log(`Trends with an origin:   ${has('origin')}`);
console.log(`Trends with a rival:     ${has('rival')}`);
console.log(`Trends with a root:      ${has('root')}`);
console.log(`Trends with nothing:     ${PILOT.filter((t) => !rows.some((r) => r.trend_id === t.id)).map((t) => t.id).join(', ')}`);
