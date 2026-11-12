// Shared helpers for the arrivals pilot: the trend list, a cached fetch and small utilities.
// Plain Node (18+), no dependencies.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const RAW = join(ROOT, 'data', 'raw', 'arrivals'); // gitignored cache of every response
export const PARTS = join(ROOT, 'data', 'arrivals'); // committed per-method parts
const UA = 'fashion-arrivals-pilot/0.1 (research script)';

// The ten pilot trends.
//   wiki           English Wikipedia titles to read. Language links are followed from the first
//                  one only, or from `hub` when English has no article of its own.
//   en             English spellings for Ngram, used as the origin baseline.
//   origin_corpus  Ngram corpus of the place it started (null when Ngram has no such corpus).
//   from           earliest year worth searching, so older senses of a word are ignored.
export const TRENDS = [
  { id: 'miniskirt', term: 'miniskirt', wiki: ['Miniskirt'], en: ['miniskirt', 'mini skirt'], origin_corpus: 'en-GB', from: 1958 },
  { id: 'punk-fashion', term: 'punk fashion', wiki: ['Punk fashion'], en: ['punk rock', 'punk fashion'], origin_corpus: 'en-GB', from: 1970 },
  { id: 'new-look', term: 'New Look (Dior)', wiki: ['Dior'], hub: { lang: 'fr', title: 'New Look' }, en: ['New Look'], origin_corpus: 'fr', from: 1944 },
  { id: 'bell-bottoms', term: 'bell-bottoms', wiki: ['Bell-bottoms'], en: ['bell bottoms', 'bell-bottoms'], origin_corpus: 'en-US', from: 1958 },
  { id: 'shoulder-pads', term: 'shoulder pads', wiki: ['Shoulder pad (fashion)'], en: ['shoulder pads'], origin_corpus: 'en-US', from: 1925 },
  { id: 'hip-hop-fashion', term: 'hip hop fashion', wiki: ['Hip-hop fashion'], en: ['hip hop'], origin_corpus: 'en-US', from: 1975 },
  { id: 'grunge-fashion', term: 'grunge fashion', wiki: ['Grunge fashion'], en: ['grunge'], origin_corpus: 'en-US', from: 1985 },
  { id: 'skinny-jeans', term: 'skinny jeans', wiki: ['Slim-fit pants'], en: ['skinny jeans'], origin_corpus: 'en-US', from: 1995 },
  { id: 'harajuku', term: 'Harajuku street style', wiki: ['Japanese street fashion', 'Harajuku'], en: ['Harajuku'], origin_corpus: null, from: 1975 },
  { id: 'athleisure', term: 'athleisure', wiki: ['Athleisure'], en: ['athleisure'], origin_corpus: 'en-US', from: 2005 },
];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// GET with an on-disk cache, a polite pause and retries on 429 and 5xx.
export async function get(url, { pause = 400, as = 'json', headers = {} } = {}) {
  const file = join(RAW, 'http', createHash('sha1').update(url).digest('hex') + '.txt');
  let body;
  try {
    body = await readFile(file, 'utf8');
  } catch {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, { headers: { 'user-agent': UA, ...headers } });
      if (res.ok) {
        body = await res.text();
        break;
      }
      if (attempt >= 4 || (res.status !== 429 && res.status < 500)) throw new Error(`${res.status} ${url}`);
      await sleep(1000 * (Number(res.headers.get('retry-after')) || 5 * (attempt + 1)));
    }
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, body);
    await sleep(pause);
  }
  return as === 'json' ? JSON.parse(body) : body;
}

export async function readJson(file, fallback) {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export async function writeJson(file, value) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value, null, 2) + '\n');
}

// Collapse whitespace and typographic quotes so a quoted sentence can be matched against its article.
export const squash = (s) =>
  s.normalize('NFKC').replace(/[‘’‚′]/g, "'").replace(/[“”„«»]/g, '"').replace(/\s+/g, ' ').trim();
