#!/usr/bin/env node
// Builds parts/wiki-1990s-2020s.json from the hand-written extraction in wiki-1990s-2020s.spec.txt
// and the article text cached by fetch-wikipedia.mjs. Quotes are copied from the cached text, so
// rerun fetch-wikipedia.mjs first on a fresh checkout.
//
// Spec format, one entry per line ("//" starts a comment line):
//   # <raw slug>                       start an article, e.g. "# 1990s-in-fashion"
//   @ <defaults> | <anchor>            the sentence containing <anchor> is the quote for the rows below
//   <term>; <category>[; <tokens>]     a row; tokens override the defaults
//   ~ <term>; <start-end> > <start-end>[ | <anchor>]   a revival, quoting the current sentence or its own anchor
// Tokens: women|men|unisex, a year or year range, UK|US|FR|IT|global, sub=<name with _ for spaces> or sub=-.
// Gender and years carry over between @ lines in an article; region and subculture reset to global and null.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const rawDir = join(here, "..", "raw", "wikipedia");
const specPath = join(here, "wiki-1990s-2020s.spec.txt");
const outPath = join(here, "..", "parts", "wiki-1990s-2020s.json");

const categories = new Set(["garment", "silhouette", "colour", "pattern", "fabric", "accessory", "footwear", "hair", "makeup", "subculture"]);
const genders = new Set(["women", "men", "unisex"]);
const regions = new Set(["UK", "US", "FR", "IT", "global"]);
const abbreviations = new Set(["dr", "mr", "mrs", "ms", "st", "jr", "sr", "vs", "no", "mt", "inc", "co", "ltd", "e.g", "i.e", "u.s", "u.k", "ft", "approx"]);

function sentences(paragraph) {
  const out = [];
  let start = 0;
  for (const m of paragraph.matchAll(/[.!?]["”’)\]]*\s+/g)) {
    const end = m.index + m[0].length;
    const next = paragraph[end];
    if (!next || !/[A-Z0-9"“‘(]/.test(next)) continue;
    const word = paragraph.slice(start, m.index + 1).match(/(\S+)\.$/)?.[1]?.toLowerCase();
    if (word && (abbreviations.has(word) || /^[a-z]$/.test(word))) continue;
    out.push([start, m.index + m[0].trimEnd().length]);
    start = end;
  }
  out.push([start, paragraph.trimEnd().length]);
  return out.map(([s, e]) => paragraph.slice(s, e));
}

function quoteFor(text, anchor, where) {
  const found = new Set();
  for (const paragraph of text.split("\n")) {
    if (!paragraph.includes(anchor)) continue;
    const matches = sentences(paragraph).filter((s) => s.includes(anchor));
    if (matches.length === 0) found.add(paragraph.trim());
    for (const sentence of matches) found.add(sentence);
  }
  if (found.size === 0) throw new Error(`${where}: anchor not found: ${anchor}`);
  if (found.size > 1) throw new Error(`${where}: anchor matches ${found.size} sentences: ${anchor}`);
  return [...found][0];
}

function applyTokens(target, tokens, where) {
  for (const token of tokens) {
    let m;
    if (genders.has(token)) target.gender = token;
    else if (regions.has(token)) target.region = token;
    else if ((m = token.match(/^(\d{4})(?:-(\d{4}))?$/))) {
      target.start = Number(m[1]);
      target.end = Number(m[2] ?? m[1]);
    } else if (token.startsWith("sub=")) target.subculture = token === "sub=-" ? null : token.slice(4).replaceAll("_", " ");
    else throw new Error(`${where}: unknown token "${token}"`);
  }
}

const range = (s, where) => {
  const m = s.trim().match(/^(\d{4})(?:-(\d{4}))?$/);
  if (!m) throw new Error(`${where}: bad range "${s}"`);
  return { start: Number(m[1]), end: Number(m[2] ?? m[1]) };
};

const spec = (await readFile(specPath, "utf8")).split("\n");
const articles = [];
const rows = [];
const revivals = [];
let article, text, defaults, quote;

for (const [i, rawLine] of spec.entries()) {
  const line = rawLine.trim();
  const where = `spec line ${i + 1}`;
  if (!line || line.startsWith("//")) continue;
  if (line.startsWith("# ")) {
    const slug = line.slice(2).trim();
    const meta = JSON.parse(await readFile(join(rawDir, `${slug}.json`), "utf8"));
    text = await readFile(join(rawDir, `${slug}.txt`), "utf8");
    article = meta.title;
    articles.push({ title: meta.title, url: meta.url });
    defaults = { gender: "unisex", start: null, end: null };
    quote = null;
  } else if (line.startsWith("@ ")) {
    const [tokenPart, ...anchorParts] = line.slice(2).split("|");
    const tokens = tokenPart.trim().split(/\s+/).filter(Boolean);
    defaults = { gender: defaults.gender, start: defaults.start, end: defaults.end, region: "global", subculture: null };
    applyTokens(defaults, tokens, where);
    quote = quoteFor(text, anchorParts.join("|").trim(), where);
  } else if (line.startsWith("~ ")) {
    const [body, ...anchorParts] = line.slice(2).split("|");
    const [term, ranges] = body.split(";").map((s) => s.trim());
    const [original, revival] = ranges.split(">").map((s) => range(s, where));
    const q = anchorParts.length ? quoteFor(text, anchorParts.join("|").trim(), where) : quote;
    revivals.push({ term, original, revival, article, quote: q });
  } else {
    const [term, category, ...rest] = line.split(";").map((s) => s.trim());
    if (!categories.has(category)) throw new Error(`${where}: bad category "${category}"`);
    const row = { term: term.toLowerCase(), category, ...defaults };
    applyTokens(row, rest.join(" ").split(/\s+/).filter(Boolean), where);
    if (!Number.isInteger(row.start) || !Number.isInteger(row.end) || row.start > row.end) throw new Error(`${where}: bad years for ${term}`);
    rows.push({
      term: row.term,
      category: row.category,
      gender: row.gender,
      start: row.start,
      end: row.end,
      region: row.region,
      subculture: row.subculture,
      article,
      quote,
    });
  }
}

await writeFile(outPath, JSON.stringify({ articles, rows, revivals }, null, 2) + "\n");
const perArticle = Object.groupBy(rows, (r) => r.article);
for (const [title, list] of Object.entries(perArticle)) console.log(`${String(list.length).padStart(4)} rows  ${title}`);
console.log(`${rows.length} rows, ${revivals.length} revivals -> ${outPath.split("/datasets/")[1]}`);
