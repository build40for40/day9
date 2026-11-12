#!/usr/bin/env node
// Fetches Google Books Ngram curves for every trend's ngram phrases and writes parts/ngram.json.
// Each trend's series is the sum of its phrases, case-insensitive, in occurrences per million words.
// Responses are cached in raw/ngram/<corpus>/, so a rerun only fetches phrases it hasn't seen.
// Run: node scripts/fetch-ngram.mjs
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const trendsPath = join(root, "parts", "trends.json");
const outPath = join(root, "parts", "ngram.json");
const cacheDir = join(root, "raw", "ngram");

const CORPORA = ["en-GB", "en-US"];
const FROM = 1920;
const TO = 2022;
const YEARS = TO - FROM + 1;
const BATCH = 10;
const MIN_GAP_MS = 1100;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (phrase) => phrase.toLowerCase().replace(/\s+/g, "");
const sig4 = (x) => (x === 0 ? 0 : Number(x.toPrecision(4)));

async function loadCache(corpus) {
  const dir = join(cacheDir, corpus);
  await mkdir(dir, { recursive: true });
  const index = new Map();
  for (const file of (await readdir(dir)).filter((f) => f.endsWith(".json")).sort()) {
    const { phrases, response } = JSON.parse(await readFile(join(dir, file), "utf8"));
    for (const [phrase, series] of matchResponse(phrases, response)) index.set(phrase, series);
  }
  return index;
}

function matchResponse(phrases, response) {
  const byKey = new Map();
  for (const row of response) {
    if (row.parent) continue;
    const name = row.ngram.replace(/ \(All\)$/, "");
    if (row.timeseries?.length === YEARS) byKey.set(key(name), row.timeseries);
  }
  return phrases.map((p) => [p, byKey.get(key(p)) ?? null]);
}

let lastRequest = 0;
async function fetchBatch(corpus, phrases) {
  const params = new URLSearchParams({
    content: phrases.join(","),
    year_start: String(FROM),
    year_end: String(TO),
    corpus,
    smoothing: "0",
    case_insensitive: "true",
  });
  const url = `https://books.google.com/ngrams/json?${params}`;
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequest + MIN_GAP_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": "40for40-fashion-dataset/1.0" } });
    } catch (err) {
      res = { ok: false, status: `network ${err.message}` };
    }
    if (res.ok) return res.json();
    const retryable = typeof res.status !== "number" || res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= 6) throw new Error(`${corpus} ${phrases.join(",")}: HTTP ${res.status}`);
    const backoff = 5000 * 2 ** attempt;
    console.warn(`  ${res.status}, retrying in ${backoff / 1000}s`);
    await sleep(backoff);
  }
}

async function fetchCorpus(corpus, phrases) {
  const index = await loadCache(corpus);
  const todo = phrases.filter((p) => !index.has(p));
  console.log(`${corpus}: ${phrases.length - todo.length} cached, ${todo.length} to fetch`);
  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const response = await fetchBatch(corpus, batch);
    const id = createHash("sha1").update(batch.join("\n")).digest("hex").slice(0, 16);
    await writeFile(join(cacheDir, corpus, `${id}.json`), JSON.stringify({ phrases: batch, response }));
    for (const [phrase, series] of matchResponse(batch, response)) index.set(phrase, series);
    console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  }
  return index;
}

const { trends } = JSON.parse(await readFile(trendsPath, "utf8"));
for (const t of trends) {
  const bad = t.ngram.filter((p) => /[,+*/:()[\]]/.test(p) || p.trim().split(/\s+/).length > 5);
  if (bad.length) throw new Error(`${t.id}: phrases Ngram can't take: ${bad.join(" | ")}`);
}
const phrases = [...new Set(trends.flatMap((t) => t.ngram))];

const indexes = {};
for (const corpus of CORPORA) indexes[corpus] = await fetchCorpus(corpus, phrases);

const out = {};
for (const t of trends) {
  const entry = {};
  const found = new Set();
  for (const corpus of CORPORA) {
    const hits = t.ngram.filter((p) => indexes[corpus].get(p));
    hits.forEach((p) => found.add(p));
    entry[corpus] = hits.length
      ? Array.from({ length: YEARS }, (_, y) => sig4(hits.reduce((sum, p) => sum + indexes[corpus].get(p)[y], 0) * 1e6))
      : null;
  }
  entry.phrases = t.ngram.filter((p) => found.has(p));
  out[t.id] = entry;
}

const doc = {
  source: "Google Books Ngram Viewer (books.google.com/ngrams), case-insensitive, no smoothing. Each trend sums the frequencies of its phrases, in occurrences per million words.",
  licence: "CC BY 3.0 (Google Books Ngram)",
  corpora: CORPORA,
  from: FROM,
  to: TO,
  trends: out,
};
const json = JSON.stringify(doc, null, 2).replace(/\[\n\s+([\d.e+-]+(?:,\n\s+[\d.e+-]+)*)\n\s+\]/g, (_, nums) => `[${nums.split(/,\n\s+/).join(", ")}]`);
await writeFile(outPath, json + "\n");

const values = Object.values(out);
for (const corpus of CORPORA) console.log(`${corpus}: ${values.filter((v) => v[corpus]).length}/${trends.length} trends with data`);
const none = trends.filter((t) => !out[t.id]["en-GB"] && !out[t.id]["en-US"]);
console.log(`No data in either corpus: ${none.length}`);
for (const t of none) console.log(`  ${t.id}: ${t.ngram.join(" | ")}`);
const missing = trends.flatMap((t) => t.ngram.filter((p) => !out[t.id].phrases.includes(p)).map((p) => `${t.id}: ${p}`));
console.log(`Phrases with no data: ${missing.length}`);
for (const m of missing) console.log(`  ${m}`);
