// The Nerds of Fashion dataset: Ben's public/fashion.json, plus the
// derived numbers every view shares (presence by year, families, year colours, comeback gaps).

export const FIRST_YEAR = 1920;
export const NOW_YEAR = 2026;
export const BASE = "/nerds-of-fashion";

export type Region = "UK" | "US" | "FR" | "IT" | "global";
export type Category = "garment" | "silhouette" | "fabric" | "pattern" | "colour" | "subculture" | "accessory" | "footwear" | "hair" | "makeup";
export type Family = "clothes" | "scenes" | "kit" | "face";

export interface Period { start: number; end: number; region: Region }
export interface Example { id: string; title: string; designer?: string; place?: string; year: number; image: string; url: string }
// A sourced claim about where a trend started (origin), who else claims it (rival) or what it
// was borrowed from (root). Years can be long before 1920 and are negative for BC.
export interface Origin {
  kind: "origin" | "rival" | "root";
  place: string;
  lat: number;
  lon: number;
  year: number | null;
  yearPrecision: "year" | "decade" | "century" | null;
  who: string | null;
  confidence: "high" | "medium" | "low";
  quote: string;
  url: string;
}
export interface Trend {
  id: string;
  name: string;
  aliases: string[];
  category: Category;
  gender: "women" | "men" | "unisex";
  regions: Region[];
  periods: Period[];
  description: string;
  sources: { article: string; quote: string; url: string }[];
  ngram: Partial<Record<"en-GB" | "en-US", number[]>> | null;
  counts: { vam?: Record<string, number>; met?: Record<string, number>; runway?: Record<string, number> };
  examples: Example[];
  origins: Origin[];
}
export interface Revival {
  trend: string | null;
  subject: string;
  original: { start: number; end: number };
  revival: { start: number; end: number };
  article: string;
  quote: string;
}
export interface Source { id: string; name: string; credit: string; licence: string; url: string; covers: string }
export interface Dataset {
  meta: { caveats: string[]; generated: string; regions: Record<string, string>; sources: Source[] };
  trends: Trend[];
  revivals: Revival[];
  series: {
    ngramYears: { from: number; to: number };
    vamByDecade: Record<string, number>;
    metByDecade: Record<string, number>;
    runwayLooksByYear: Record<string, number>;
  };
  colours: { pantone: { year: number; hex: string; name: string }[]; vam: Record<string, Record<string, number>> };
}

/** One wait between a trend's waves, start to start, from Ben's forecast.json. */
export interface Wait { trend: string; subject: string; from: number; to: number; gap: number }

let loading: Promise<Nerds> | undefined;
export function loadNerds() {
  const json = <T>(file: string) =>
    fetch(`${BASE}/${file}`).then((response) => {
      if (!response.ok) throw new Error(`${file}: ${response.status}`);
      return response.json() as Promise<T>;
    });
  loading ??= Promise.all([
    json<Dataset>("fashion.json"),
    // The comeback numbers everywhere come from these waits. Without them we fall back to Wikipedia's named revivals.
    json<{ trends: Record<string, { waves: [number, number][] }> }>("forecast.json").catch(() => undefined),
  ]).then(([data, forecast]) => new Nerds(data, forecast?.trends));
  return loading;
}

export const FAMILIES: Record<Family, { label: string; token: string; categories: Category[] }> = {
  clothes: { label: "Clothes and shapes", token: "--color-nof-clothes", categories: ["garment", "silhouette", "fabric", "pattern", "colour"] },
  scenes: { label: "Scenes and subcultures", token: "--color-nof-scenes", categories: ["subculture"] },
  kit: { label: "Shoes and accessories", token: "--color-nof-kit", categories: ["accessory", "footwear"] },
  face: { label: "Hair and make-up", token: "--color-nof-face", categories: ["hair", "makeup"] },
};
export const familyOf = (category: Category) => (Object.keys(FAMILIES) as Family[]).find((family) => FAMILIES[family].categories.includes(category)) ?? "clothes";

// Colour words the V&A uses in its descriptions, as paint.
export const COLOUR_WORDS: Record<string, string> = {
  beige: "#d8c3a0", black: "#1c1b1f", blue: "#3f6fc4", brown: "#7a4e2d", burgundy: "#7d1f3a", coral: "#f2786a", cream: "#efe3c2",
  gold: "#d4a93a", green: "#3f8f4e", grey: "#8c8a90", ivory: "#f4eedb", khaki: "#a99a62", lilac: "#b9a2d8", lime: "#a9d23a",
  metallic: "#b8bcc6", multicoloured: "#d0609a", mustard: "#c9a227", navy: "#22325e", olive: "#6b6f2c", orange: "#e57b2a",
  pink: "#ec8fb4", purple: "#71409a", red: "#c4302b", silver: "#c9ccd3", tan: "#c19a6b", turquoise: "#36b5b0", white: "#f6f4ef", yellow: "#efcf3b",
};

export const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const decadeOf = (year: number) => Math.floor(year / 10) * 10;
export const years = (from = FIRST_YEAR, to = NOW_YEAR) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const channel = (shift: number) => Math.round(lerp((pa >> shift) & 255, (pb >> shift) & 255, t));
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, "0")}`;
}

export interface Milestone { key: string; age: number; year: number; label: string; line: string }
export const MILESTONES = [
  { key: "born", age: 0, label: "You arrive", line: "What everyone was wearing while you did nothing but sleep" },
  { key: "school", age: 5, label: "First day at school", line: "The year your parents dressed you, and the photos prove it" },
  { key: "teen", age: 13, label: "Teenage bedroom", line: "The look on your bedroom wall" },
  { key: "sixteen", age: 16, label: "Leaving school", line: "The year you turned 16 and thought you'd invented style" },
  { key: "uni", age: 19, label: "Uni or first job", line: "Your own money, your own terrible decisions" },
  { key: "thirty", age: 30, label: "Turning 30", line: "Roughly when you stopped following trends. Sorry, it's in the data" },
] as const;

export class Nerds {
  readonly byId: Map<string, Trend>;
  readonly yearColours: Map<number, string>;
  readonly decadeColours: Map<number, { word: string; hex: string; lift: number }>;
  private readonly presenceCache = new Map<string, Float32Array>();
  private readonly fameCache = new Map<string, number>();

  private readonly waitList: Wait[] | undefined;

  constructor(
    readonly data: Dataset,
    waves?: Record<string, { waves: [number, number][] }>,
  ) {
    this.byId = new Map(data.trends.map((trend) => [trend.id, trend]));
    this.waitList = waves
      ? Object.entries(waves).flatMap(([id, { waves: list }]) =>
          list.slice(1).map((wave, i) => ({ trend: id, subject: this.byId.get(id)?.name ?? id, from: list[i][0], to: wave[0], gap: wave[0] - list[i][0] })),
        )
      : undefined;
    this.decadeColours = this.signatureColours();
    this.yearColours = this.colourByYear();
  }

  get trends() {
    return this.data.trends;
  }
  get revivals() {
    return this.data.revivals;
  }

  /** 0 to 1: how much a trend was "on" in a year, from its Wikipedia periods, softened at the edges. */
  presence(trend: Trend, year: number) {
    let curve = this.presenceCache.get(trend.id);
    if (!curve) {
      curve = new Float32Array(NOW_YEAR - FIRST_YEAR + 1);
      for (const period of trend.periods) {
        const start = Math.max(period.start, FIRST_YEAR - 3);
        const end = Math.min(Math.max(period.end, start), NOW_YEAR);
        const mid = (start + end) / 2;
        const half = (end - start) / 2 + 2.5;
        for (let y = Math.max(FIRST_YEAR, start - 3); y <= Math.min(NOW_YEAR, end + 3); y++) {
          const inside = y >= start && y <= end;
          const value = clamp(1 - 0.55 * ((y - mid) / half) ** 2 - (inside ? 0 : 0.35 * Math.min(Math.abs(y - start), Math.abs(y - end))), 0, 1);
          const i = y - FIRST_YEAR;
          curve[i] = Math.min(1, Math.max(curve[i], value) + (inside && curve[i] > 0 ? 0.08 : 0));
        }
      }
      this.presenceCache.set(trend.id, curve);
    }
    return curve[clamp(Math.round(year), FIRST_YEAR, NOW_YEAR) - FIRST_YEAR];
  }

  /** How famous a trend is overall: quotes, periods, museum pieces and comebacks. */
  fame(trend: Trend) {
    let fame = this.fameCache.get(trend.id);
    if (fame === undefined) {
      const comebacks = this.revivals.filter((revival) => revival.trend === trend.id).length;
      const museum = Object.values(trend.counts.vam ?? {}).reduce((a, b) => a + b, 0) + Object.values(trend.counts.met ?? {}).reduce((a, b) => a + b, 0);
      fame = trend.periods.length * 1.2 + trend.sources.length + comebacks * 2 + Math.log1p(museum) + trend.examples.length * 0.4;
      this.fameCache.set(trend.id, fame);
    }
    return fame;
  }

  /** The trends that defined a year, most defining first. */
  top(year: number, count = 5, filter: (trend: Trend) => boolean = () => true) {
    return this.trends
      .filter(filter)
      .map((trend) => ({ trend, score: this.presence(trend, year) * (1 + this.fame(trend) / 12) * (1 - 0.8 * this.ubiquity(trend)) }))
      .filter((entry) => entry.score > 0.25)
      .sort((a, b) => b.score - a.score)
      .slice(0, count)
      .map((entry) => entry.trend);
  }

  /** 0 to 1: the share of the century a trend was on, so evergreen basics like T-shirts don't define every year. */
  ubiquity(trend: Trend) {
    let on = 0;
    for (let y = FIRST_YEAR; y <= NOW_YEAR; y++) on += this.presence(trend, y) > 0.4 ? 1 : 0;
    return on / (NOW_YEAR - FIRST_YEAR + 1);
  }

  /** Each trend's Ngram curve scaled to its own peak, since heights can't be compared across phrases. */
  shape(trend: Trend, corpus: "en-GB" | "en-US" = "en-GB") {
    const raw = trend.ngram?.[corpus] ?? trend.ngram?.["en-US"] ?? trend.ngram?.["en-GB"];
    if (!raw?.length) return undefined;
    const smooth = raw.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let k = -2; k <= 2; k++) if (raw[i + k] !== undefined) (sum += raw[i + k]), n++;
      return sum / n;
    });
    const peak = Math.max(...smooth) || 1;
    return smooth.map((value) => value / peak);
  }

  colour(year: number) {
    return this.yearColours.get(clamp(Math.round(year), FIRST_YEAR, NOW_YEAR)) ?? "#888888";
  }

  pantone(year: number) {
    return this.data.colours.pantone.filter((entry) => entry.year === year);
  }

  /** For each decade, the colour word the V&A over-indexes on most against the century, so not just "black" every time. */
  private signatureColours() {
    const vam = this.data.colours.vam;
    const decades = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990];
    const totals = new Map(decades.map((d) => [d, Object.values(vam).reduce((sum, row) => sum + (row[d] ?? 0), 0)]));
    const result = new Map<number, { word: string; hex: string; lift: number }>();
    for (const decade of decades) {
      let best = { word: "black", hex: COLOUR_WORDS.black, lift: 0 };
      for (const [word, row] of Object.entries(vam)) {
        if (!COLOUR_WORDS[word] || word === "multicoloured") continue;
        const all = decades.reduce((sum, d) => sum + (row[d] ?? 0), 0);
        const allTotal = decades.reduce((sum, d) => sum + (totals.get(d) ?? 0), 0);
        if (all < 25) continue;
        const share = (row[decade] ?? 0) / (totals.get(decade) || 1);
        const lift = share / (all / allTotal);
        if (lift > best.lift) best = { word, hex: COLOUR_WORDS[word], lift };
      }
      result.set(decade, best);
    }
    return result;
  }

  private colourByYear() {
    const result = new Map<number, string>();
    const pantone = new Map<number, string>();
    for (const entry of this.data.colours.pantone) if (!pantone.has(entry.year)) pantone.set(entry.year, entry.hex);
    const anchors = [...this.decadeColours.entries()].map(([decade, c]) => ({ year: decade + 5, hex: c.hex }));
    for (const year of years()) {
      if (pantone.has(year)) {
        result.set(year, pantone.get(year)!);
        continue;
      }
      if (year >= 2000) {
        result.set(year, pantone.get(year - 1) ?? pantone.get(2000)!);
        continue;
      }
      const after = anchors.findIndex((anchor) => anchor.year >= year);
      if (after <= 0) result.set(year, anchors[0].hex);
      else if (after === -1) result.set(year, anchors[anchors.length - 1].hex);
      else {
        const a = anchors[after - 1];
        const b = anchors[after];
        result.set(year, mix(a.hex, b.hex, (year - a.year) / (b.year - a.year)));
      }
    }
    // Ease the 1990s into the first Pantone.
    for (let year = 1995; year < 2000; year++) result.set(year, mix(result.get(1994)!, result.get(2000)!, (year - 1994) / 6));
    return result;
  }

  /** Revivals tied to a trend, with the gap in years from the original to the comeback. */
  comebacks() {
    return this.revivals
      .map((revival) => ({ ...revival, from: clamp(revival.original.start, 1900, NOW_YEAR), to: revival.revival.start }))
      .map((revival) => ({ ...revival, gap: revival.to - revival.from }))
      .filter((revival) => revival.gap > 0);
  }

  /** Every comeback wait, start of one wave to the start of the next (Ben's measure). */
  waits(): Wait[] {
    return this.waitList ?? this.comebacks().map((r) => ({ trend: r.trend ?? "", subject: r.subject, from: r.from, to: r.to, gap: r.gap }));
  }

  gapStats() {
    const gaps = this.waits()
      .map((wait) => wait.gap)
      .filter((gap) => gap > 0)
      .sort((a, b) => a - b);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const mid = gaps.length >> 1;
    const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2;
    return { count: gaps.length, mean, median, gaps };
  }

  /** Chance a trend that peaked `since` years ago comes back within `within` years, from the real gap distribution. */
  comebackOdds(since: number, within = 5) {
    const { gaps } = this.gapStats();
    const still = gaps.filter((gap) => gap > since).length;
    if (!still) return 0;
    return gaps.filter((gap) => gap > since && gap <= since + within).length / still;
  }

  milestones(born: number): Milestone[] {
    return MILESTONES.map((m) => ({ ...m, year: born + m.age })).filter((m) => m.year <= NOW_YEAR && m.year >= FIRST_YEAR);
  }

  /** Trends from your teens most likely to come back next, by years since they were last on. */
  dueForYou(born: number, count = 3) {
    const teenFrom = born + 13;
    const teenTo = born + 19;
    return this.trends
      .map((trend) => {
        let teen = 0;
        for (let y = teenFrom; y <= teenTo; y++) teen = Math.max(teen, y <= NOW_YEAR ? this.presence(trend, y) : 0);
        let last = 0;
        for (let y = FIRST_YEAR; y <= NOW_YEAR; y++) if (this.presence(trend, y) > 0.5) last = y;
        const since = NOW_YEAR - last;
        return { trend, teen, last, since, odds: this.comebackOdds(since, 5) };
      })
      .filter((entry) => entry.teen > 0.6 && entry.since >= 6)
      .sort((a, b) => b.odds * this.fame(b.trend) - a.odds * this.fame(a.trend))
      .slice(0, count);
  }
}

/** Read a theme token as a colour for canvas drawing. */
export function token(name: string, fallback = "#ffffff") {
  if (typeof document === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Today's date in the UK, for picking the story of the day. */
export function ukToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(now);
}
