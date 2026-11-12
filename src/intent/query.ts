export interface TrendRef {
  id: string;
  name: string;
  aliases: string[];
}

const stem = (word: string) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);

export const words = (text: string) => (text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").match(/[\p{L}\p{N}]+/gu) ?? []).map(stem);

export const clean = (text: string) => text.trim().replace(/\s+/g, " ");

const DECADE_WORDS: Record<string, number> = {
  twenties: 1920,
  thirties: 1930,
  forties: 1940,
  fifties: 1950,
  sixties: 1960,
  seventies: 1970,
  eighties: 1980,
  nineties: 1990,
  noughties: 2000,
  aughts: 2000,
};

// "the 20s" is read as the 1920s, since that's where the dataset starts. "2020s" says so in full.
export function parseWhen(query: string): { year: number | null; decade: number | null } {
  const text = query.toLowerCase();
  const stated = text.match(/\b(19\d\d|20[0-2]\d)(?!\d|'?s\b)/);
  const year = stated ? Number(stated[1]) : null;

  const full = text.match(/\b(19|20)(\d)0'?s\b/);
  const short = text.match(/(?:^|[^\d])'?(\d)0'?s\b/);
  const named = Object.keys(DECADE_WORDS).find((word) => new RegExp(`\\b${word}\\b`).test(text));
  const decade = full
    ? Number(`${full[1]}${full[2]}0`)
    : short
      ? Number(short[1]) >= 2
        ? 1900 + Number(short[1]) * 10
        : 2000 + Number(short[1]) * 10
      : named
        ? DECADE_WORDS[named]
        : year !== null
          ? Math.floor(year / 10) * 10
          : null;
  return { year, decade };
}

// Words that say nothing about which trend a search means.
const VAGUE = new Set(
  `about all and are back been being but can clothe clothing come coming did does during fashion fashionable for from get going had has have
  doe how into its just like look made make more most much new not now old one out over people popular really some start started
  style than that the their them then there they thi trend was wear wearing were what when where which who why will with wore worn
  would year you your`.split(/\s+/),
);

interface Indexed {
  trend: TrendRef;
  names: string[][];
  aliases: string[][];
  vocabulary: Set<string>;
}

const indexed = new WeakMap<readonly TrendRef[], Indexed[]>();

function prepare(index: readonly TrendRef[]) {
  let entries = indexed.get(index);
  if (!entries) {
    entries = index.map((trend) => {
      const names = [trend.name, ...trend.name.split(/\s+and\s+/)].map(words).filter((phrase) => phrase.length);
      const aliases = trend.aliases.map(words).filter((phrase) => phrase.length);
      return { trend, names, aliases, vocabulary: new Set([...names, ...aliases].flat()) };
    });
    indexed.set(index, entries);
  }
  return entries;
}

const contains = (haystack: string[], phrase: string[]) =>
  haystack.some((_, start) => phrase.every((word, offset) => haystack[start + offset] === word));

const longest = (haystack: string[], phrases: string[][]) => Math.max(0, ...phrases.filter((phrase) => contains(haystack, phrase)).map((phrase) => phrase.length));

export interface TrendLookup {
  // The one trend the search names outright, when no other trend matches as many words.
  named: TrendRef | null;
  // The trend with the longest name or alias found in the search, named or not.
  phrased: TrendRef | null;
  // Trends that share a name, alias or word with the search, best first.
  candidates: TrendRef[];
}

export function findTrends(query: string, index: readonly TrendRef[], limit = 6): TrendLookup {
  const typed = words(query);
  const telling = new Set(typed.filter((word) => word.length > 2 && !VAGUE.has(word)));
  const scored = prepare(index)
    .map(({ trend, names, aliases, vocabulary }) => {
      const name = longest(typed, names);
      const phrase = Math.max(name, longest(typed, aliases));
      const shared = [...telling].filter((word) => vocabulary.has(word)).length;
      return { trend, name, phrase, shared };
    })
    .filter((entry) => entry.phrase > 0 || entry.shared > 0)
    .toSorted((a, b) => b.phrase - a.phrase || b.name - a.name || b.shared - a.shared || a.trend.name.length - b.trend.name.length);

  const [best, next] = scored;
  const named = best && best.name > 0 && best.name === best.phrase && best.name > (next?.phrase ?? 0) ? best.trend : null;
  return { named, phrased: best?.phrase ? best.trend : null, candidates: scored.slice(0, limit).map((entry) => entry.trend) };
}
