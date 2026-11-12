// Step 3: check every extracted claim against its cached article, by rule.
// Reads origins/extracted/<trend_id>.json (the answers to prompt.md) and raw/origins/<trend_id>.txt.
// Writes origins/checked.json: every claim with a stable key, plus `fail` (why a rule threw it
// out) or `flags` (things for the hand review to look at).
//
// Usage, from the repo root: node datasets/fashion/globe/origins/check.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { HERE, PILOT, RAW, readJson, squash } from './lib.mjs';

const articles = Object.fromEntries(readJson(`${HERE}/articles.json`, []).map((a) => [a.trend_id, a]));
const KINDS = new Set(['origin', 'rival', 'root']);
const TOO_WIDE = new Set(['europe', 'the west', 'the east', 'asia', 'the orient', 'africa', 'western europe', 'worldwide']);
const ORD = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first'];
const suffix = (n) => (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th');

// Does the quote state the year, decade or century it is filed under?
function yearInQuote(c, q) {
  const y = Math.abs(c.year);
  if (c.year_precision === 'year') return new RegExp(`(^|\\D)${y}(\\D|$)`).test(q);
  if (c.year_precision === 'decade') { const d = Math.floor(y / 10) * 10; return q.includes(`${d}s`) || q.includes(`${d}'s`) || (d % 100 !== 0 && new RegExp(`(^|\\W)'?${d % 100}'?s`).test(q)); }
  if (c.year_precision === 'century') { const n = Math.floor(y / 100) + (c.year < 0 ? 0 : 1); return q.toLowerCase().includes(`${n}${suffix(n)}`) || q.toLowerCase().includes(ORD[n] || '\u0000'); }
  return false;
}

const out = [];
for (const t of PILOT) {
  const f = `${HERE}/extracted/${t.id}.json`;
  if (!existsSync(f)) continue;
  const a = articles[t.id], text = squash(readFileSync(`${RAW}/${t.id}.txt`, 'utf8').replace(/^#.*\n#.*\n/, ''));
  const claims = readJson(f, {}).claims || [];
  const hasOrigin = claims.some((c) => c.kind === 'origin');
  const n = {};
  for (const c of claims) {
    const key = `${t.id}:${c.kind}:${(n[c.kind] = (n[c.kind] || 0) + 1)}`;
    const q = squash(c.quote || ''), flags = [];
    let fail = null;
    if (!KINDS.has(c.kind)) fail = 'unknown kind';
    else if (!q || !text.includes(q)) fail = 'quote is not in the article word for word';
    else if (q.length >= 400) fail = 'quote is 400 characters or longer';
    else if (!c.place || TOO_WIDE.has(c.place.toLowerCase())) fail = 'no place, or wider than a country';
    else if (c.year != null && !['year', 'decade', 'century'].includes(c.year_precision)) fail = 'year without a precision';
    else if (c.year != null && !yearInQuote(c, q)) fail = 'quote does not state the year';
    else if (c.kind === 'rival' && !hasOrigin) fail = 'rival claim with no origin to rival';
    if (!fail) {
      // Not fatal, because "Kashmiri shawls" is fair evidence for Kashmir. The hand review decides.
      const stem = c.place.toLowerCase().replace(/^(the|ancient) /, '').split(/[ ,]/)[0].slice(0, 5);
      if (!q.toLowerCase().includes(stem)) flags.push('place not named in quote');
      if (c.kind === 'origin' && c.year == null) flags.push('origin with no year');
    }
    out.push({ key, trend_id: t.id, kind: c.kind, place: c.place, place_type: c.place_type ?? null, year: c.year ?? null, year_precision: c.year == null ? null : c.year_precision,
      who: c.who ?? null, hedged: !!c.hedged, note: c.note ?? '', source_url: a.url, source_sentence: (c.quote || '').trim(), ...(fail ? { fail } : {}), ...(flags.length ? { flags } : {}) });
  }
}
writeFileSync(`${HERE}/checked.json`, JSON.stringify(out, null, 2) + '\n');
const ok = out.filter((r) => !r.fail);
console.log(`Claims extracted:        ${out.length}`);
console.log(`Thrown out by a rule:    ${out.length - ok.length}`);
for (const [why, k] of Object.entries(out.filter((r) => r.fail).reduce((m, r) => ((m[r.fail] = (m[r.fail] || 0) + 1), m), {}))) console.log(`  ${why}: ${k}`);
console.log(`Left for hand review:    ${ok.length} (${ok.filter((r) => r.flags).length} flagged)`);
