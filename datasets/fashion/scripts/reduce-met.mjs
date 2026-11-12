import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const csvPath = join(root, "raw", "met", "MetObjects.csv");
const outPath = join(root, "parts", "met.json");
const CSV_URL = "https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv";

const MIN_YEAR = 1920;
const MAX_YEAR = 2026;
const MIN_TYPE_COUNT = 5;
const TOP_TYPES = 150;

if (!existsSync(csvPath)) {
  mkdirSync(dirname(csvPath), { recursive: true });
  console.error(`downloading ${CSV_URL}`);
  execFileSync("curl", ["-sSL", "--retry", "5", "--retry-delay", "5", "-o", csvPath, CSV_URL], { stdio: "inherit" });
}

async function* csvRows(path) {
  let field = "";
  let row = [];
  let inQuotes = false;
  let pendingQuote = false;
  let first = true;
  for await (let chunk of createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 })) {
    if (first) {
      chunk = chunk.replace(/^﻿/, "");
      first = false;
    }
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk[i];
      if (pendingQuote) {
        pendingQuote = false;
        if (c === '"') {
          field += '"';
          continue;
        }
        inQuotes = false;
      }
      if (inQuotes) {
        if (c === '"') pendingQuote = true;
        else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field.endsWith("\r") ? field.slice(0, -1) : field);
        yield row;
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  if (field || row.length) {
    row.push(field);
    yield row;
  }
}

const REGIONS = {
  american: "US",
  french: "FR",
  british: "UK",
  english: "UK",
  scottish: "UK",
  welsh: "UK",
  italian: "IT",
};

function regionOf(culture) {
  const c = culture.trim().toLowerCase().replace(/^(probably|possibly)\s+/, "");
  return REGIONS[c] ?? "global";
}

const words = (list) => new RegExp(`\\b(${list.join("|")})\\b`, "i");
const MEN_MARKERS = words(["man'?s", "men'?s", "boy'?s", "boys'", "gentleman'?s", "gentlemen'?s"]);
const WOMEN_MARKERS = words(["woman'?s", "women'?s", "girl'?s", "girls'", "lady'?s", "ladies'?"]);
const MENSWEAR_NAMES = words(["necktie", "bow tie", "tuxedo", "bathing trunks", "swim trunks", "cuff ?links", "boxer shorts"]);
const WOMENSWEAR_NAMES = words([
  "dress", "evening dress", "cocktail dress", "wedding dress", "ball gown", "gown", "nightgown", "robe de style",
  "skirt", "blouse", "overblouse", "brassiere", "bra", "bodice", "corset", "corselet", "girdle", "slip",
  "petticoat", "camisole", "chemise", "negligee", "peignoir", "garter belt", "stockings", "pantyhose", "tights",
  "bustle", "teddy", "culottes", "caftan", "kaftan", "sari", "bikini", "handbag", "purse", "evening bag",
  "evening purse", "pumps", "evening pumps", "mules", "cloche", "pillbox hat", "tiara", "fascinator", "veil",
  "maternity",
]);
const NOT_WOMENSWEAR = words(["dress shirt", "dress shoes", "dressing gown", "dress coat"]);

function genderOf(objectName, title) {
  const text = `${objectName} ${title}`;
  const men = MEN_MARKERS.test(text);
  const women = WOMEN_MARKERS.test(text);
  if (men !== women) return men ? "men" : "women";
  if (men && women) return "unknown";
  if (MENSWEAR_NAMES.test(objectName)) return "men";
  if (WOMENSWEAR_NAMES.test(objectName) && !NOT_WOMENSWEAR.test(objectName)) return "women";
  return "unknown";
}

function bump(obj, key, year) {
  const byYear = (obj[key] ??= {});
  byYear[year] = (byYear[year] ?? 0) + 1;
}

const records = [];
let header;
let scanned = 0;
let skippedNoName = 0;
let skippedYear = 0;
let withLink = 0;

for await (const row of csvRows(csvPath)) {
  if (!header) {
    header = Object.fromEntries(row.map((h, i) => [h.trim(), i]));
    continue;
  }
  scanned++;
  if (row[header["Department"]] !== "Costume Institute") continue;
  const year = Number.parseInt(row[header["Object Begin Date"]], 10);
  if (!Number.isInteger(year) || year < MIN_YEAR) continue;
  if (year > MAX_YEAR) {
    skippedYear++;
    continue;
  }
  const objectName = row[header["Object Name"]].trim().replace(/\s+/g, " ").toLowerCase();
  if (!objectName) {
    skippedNoName++;
    continue;
  }
  const title = row[header["Title"]] ?? "";
  if ((row[header["Link Resource"]] ?? "").trim()) withLink++;
  records.push({
    objectName,
    year,
    region: regionOf(row[header["Culture"]] ?? ""),
    gender: genderOf(objectName, title),
  });
}

const totals = new Map();
for (const r of records) totals.set(r.objectName, (totals.get(r.objectName) ?? 0) + 1);
const kept = records.filter((r) => totals.get(r.objectName) >= MIN_TYPE_COUNT);
const droppedRows = records.length - kept.length;
const droppedTypes = [...totals.values()].filter((n) => n < MIN_TYPE_COUNT).length;

const countsByTypeYear = {};
const countsByTypeYearRegion = {};
const countsByTypeYearGender = {};
for (const r of kept) {
  bump(countsByTypeYear, r.objectName, r.year);
  bump((countsByTypeYearRegion[r.objectName] ??= {}), r.region, r.year);
  bump((countsByTypeYearGender[r.objectName] ??= {}), r.gender, r.year);
}

const sortKeys = (obj) => Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
const topTypes = [...totals.entries()]
  .filter(([, n]) => n >= MIN_TYPE_COUNT)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .slice(0, TOP_TYPES)
  .map(([objectName, total]) => ({ objectName, total }));

const out = {
  source: "The Metropolitan Museum of Art Open Access, Costume Institute (MetObjects.csv, github.com/metmuseum/openaccess)",
  sourceUrl: CSV_URL,
  fetched: "2026-11-12",
  licence: "CC0",
  notes: [
    `Department "Costume Institute", Object Begin Date ${MIN_YEAR} to ${MAX_YEAR}; year is Object Begin Date.`,
    "Region from Culture, ignoring a leading probably/possibly: American US, French FR, British/English/Scottish/Welsh UK, Italian IT; anything else, mixed (\"American or European\") or blank is global.",
    "Gender inferred from Object Name and Title: man's/men's/boy's or woman's/women's/girl's when present (none are, after 1920), else obvious menswear names (necktie, bow tie, tuxedo, bathing trunks) or womenswear names (dress, skirt, blouse, brassiere, pumps...); otherwise unknown. Most rows are womenswear but stay unknown.",
    `Object names seen fewer than ${MIN_TYPE_COUNT} times are dropped. No image URLs are stored.`,
  ],
  rows: kept.length,
  countsByTypeYear: sortKeys(countsByTypeYear),
  countsByTypeYearRegion: sortKeys(countsByTypeYearRegion),
  countsByTypeYearGender: sortKeys(countsByTypeYearGender),
  topTypes,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");

const tally = (key) => {
  const t = {};
  for (const r of kept) t[r[key]] = (t[r[key]] ?? 0) + 1;
  return t;
};
const decades = {};
for (const r of kept) {
  const d = `${Math.floor(r.year / 10) * 10}s`;
  decades[d] = (decades[d] ?? 0) + 1;
}

console.log(`scanned ${scanned} rows`);
console.log(`matched ${records.length} Costume Institute rows from ${MIN_YEAR} (skipped ${skippedNoName} with no object name, ${skippedYear} dated after ${MAX_YEAR})`);
console.log(`dropped ${droppedRows} rows across ${droppedTypes} object names seen fewer than ${MIN_TYPE_COUNT} times`);
console.log(`kept ${kept.length} rows, ${Object.keys(countsByTypeYear).length} object names, ${withLink} matched rows had a Link Resource`);
console.log("by decade", sortKeys(decades));
console.log("by region", tally("region"));
console.log("by gender", tally("gender"));
console.log("wrote parts/met.json");
