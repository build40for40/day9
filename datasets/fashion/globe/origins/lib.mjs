// Shared bits for the origins pilot. Plain Node (18+), no dependencies.
// Run every script from the repo root.
import { readFileSync } from 'node:fs';

export const HERE = 'datasets/fashion/globe/origins';
export const RAW = 'datasets/fashion/raw/origins'; // gitignored cache of article text
export const PILOT = JSON.parse(readFileSync(`${HERE}/pilot.json`, 'utf8')).trends;

// Collapse whitespace and typographic quotes so a quoted sentence can be matched against its article.
export const squash = (s) =>
  s.normalize('NFKC').replace(/[‘’‚′]/g, "'").replace(/[“”„«»]/g, '"').replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ').trim();

export const readJson = (f, fallback) => { try { return JSON.parse(readFileSync(f, 'utf8')); } catch { return fallback; } };
