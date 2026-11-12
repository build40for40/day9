// Method 4: Wikidata, for birthplace and inception year only.
// Output: data/arrivals/wikidata.json, one entry per trend with whatever Wikidata holds.
import { join } from 'node:path';
import { PARTS, TRENDS, get, writeJson } from './arrivals-lib.mjs';

const wd = (params) => `https://www.wikidata.org/w/api.php?format=json&${new URLSearchParams(params)}`;
const PROPS = { P571: 'inception', P495: 'country_of_origin', P740: 'location_of_formation', P61: 'discoverer_or_inventor', P170: 'creator', P2348: 'time_period', P580: 'start_time' };

const out = [];
for (const trend of TRENDS) {
  // The entity for the trend itself: the hub edition's article when English has none of its own.
  const page = trend.hub ?? { lang: 'en', title: trend.wiki[0] };
  const res = await get(wd({ action: 'wbgetentities', sites: `${page.lang}wiki`, titles: page.title, props: 'claims|labels', languages: 'en', normalize: 1 }));
  const entity = Object.values(res.entities ?? {})[0];
  const row = { trend: trend.id, qid: entity?.id ?? null, label: entity?.labels?.en?.value ?? null };
  const ids = new Set();
  for (const [pid, name] of Object.entries(PROPS)) {
    row[name] = (entity?.claims?.[pid] ?? []).map((c) => {
      const v = c.mainsnak.datavalue?.value;
      if (v?.time) return Number(v.time.slice(1, 5));
      if (v?.id) ids.add(v.id);
      return v?.id ?? null;
    });
  }
  if (ids.size) {
    const labels = await get(wd({ action: 'wbgetentities', ids: [...ids].join('|'), props: 'labels', languages: 'en' }));
    for (const name of Object.values(PROPS)) row[name] = row[name].map((v) => labels.entities[v]?.labels?.en?.value ?? v);
  }
  out.push(row);
  console.log(`${trend.id}: ${row.qid} inception=${row.inception} origin=${row.country_of_origin} formed=${row.location_of_formation}`);
}
await writeJson(join(PARTS, 'wikidata.json'), out);
