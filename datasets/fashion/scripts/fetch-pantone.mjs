import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cacheFile = join(root, "raw", "pantone", "wikitext.json");
const outFile = join(root, "parts", "pantone.json");

const api =
  "https://en.wikipedia.org/w/api.php?action=parse&page=Pantone&prop=wikitext&format=json&formatversion=2";

async function fetchJson(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": "40for40-dataset/1.0" } });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`${res.status} from ${url}`);
    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }
  throw new Error(`gave up on ${url}`);
}

async function wikitext() {
  try {
    return JSON.parse(await readFile(cacheFile, "utf8")).parse.wikitext;
  } catch {
    const body = await fetchJson(api);
    await mkdir(dirname(cacheFile), { recursive: true });
    await writeFile(cacheFile, JSON.stringify(body));
    return body.parse.wikitext;
  }
}

const plainName = (raw) =>
  raw
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/'''?/g, "")
    .trim();

const swatch = /\{\{color swatch\|(#[0-9A-Fa-f]{6})\|'''(\d{4})'''<br\s*\/?>(.*?)<br\s*\/?>/gi;
const colours = [...(await wikitext()).matchAll(swatch)].map(([, hex, year, name]) => ({
  year: Number(year),
  name: plainName(name),
  hex: hex.toUpperCase(),
}));

if (colours.length < 29) throw new Error(`expected at least 29 colours, found ${colours.length}`);

const out = {
  source: "https://en.wikipedia.org/wiki/Pantone#Color_of_the_Year",
  licence: "CC BY-SA 4.0 (Wikipedia)",
  fetched: "2026-11-12",
  colours,
};

await mkdir(dirname(outFile), { recursive: true });
await writeFile(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(`${colours.length} colours, ${colours[0].year} to ${colours.at(-1).year}`);
