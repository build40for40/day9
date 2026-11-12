#!/usr/bin/env node
// Usage: node fetch-wikipedia.mjs "1990s in fashion" "Grunge fashion" ...
// Saves each article's plain text to raw/wikipedia/<slug>.txt and its metadata to <slug>.json.
// Cached articles are skipped unless --force is passed.
import { mkdir, writeFile, access } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "raw", "wikipedia");
const userAgent = "40for40-day9-dataset/1.0 (https://build40for40.com)";

const args = process.argv.slice(2);
const force = args.includes("--force");
const titles = args.filter((a) => a !== "--force");
if (titles.length === 0) {
  console.error('usage: node fetch-wikipedia.mjs [--force] "<title>" ...');
  process.exit(1);
}

export const slug = (title) =>
  title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const exists = (path) => access(path).then(() => true, () => false);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, attempt = 0) {
  const res = await fetch(url, { headers: { "User-Agent": userAgent } });
  if ((res.status === 429 || res.status >= 500) && attempt < 5) {
    const wait = Number(res.headers.get("retry-after")) * 1000 || 1000 * 2 ** attempt;
    await sleep(wait);
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

await mkdir(outDir, { recursive: true });

for (const title of titles) {
  const base = join(outDir, slug(title));
  if (!force && (await exists(`${base}.txt`))) {
    console.log(`cached  ${title}`);
    continue;
  }
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&prop=extracts|info&inprop=url" +
    "&explaintext=1&format=json&formatversion=2&redirects=1&titles=" +
    encodeURIComponent(title);
  const data = await fetchJson(url);
  const page = data.query?.pages?.[0];
  if (!page || page.missing) {
    console.error(`missing ${title}`);
    continue;
  }
  await writeFile(`${base}.txt`, page.extract);
  await writeFile(
    `${base}.json`,
    JSON.stringify(
      {
        requested: title,
        title: page.title,
        url: page.fullurl,
        revid: page.lastrevid,
        redirects: data.query.redirects ?? [],
        fetched: new Date().toISOString(),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`fetched ${title} -> ${page.title} (${page.extract.length} chars)`);
  await sleep(500);
}
