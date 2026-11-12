export type Region = "UK" | "US" | "FR" | "IT" | "global";

export interface Period {
  start: number;
  end: number;
  region: Region;
}

export interface Trend {
  id: string;
  name: string;
  category: string;
  description: string;
  periods: Period[];
  sources: { article: string; quote: string; url: string }[];
  examples: { image: string; title: string; designer: string | null; year: number; url: string }[];
  ngram?: Record<string, number[]>;
}

export interface Dataset {
  meta: { years: { from: number; to: number }; sources: { name: string; credit: string; licence: string; url: string }[] };
  trends: Trend[];
}

export interface Forecast {
  waves: [number, number][];
  status: "in" | "out" | "unknown";
  typicalGap?: number;
  stillIn?: Record<string, number>;
  comebackBy?: Record<string, number>;
  verdict?: "likely" | "possible" | "unlikely";
  medianReturn?: number;
  returnRange?: [number, number];
}

export interface ForecastFile {
  meta: {
    now: number;
    horizon: number[];
    summary: string;
    params: { returnShare: number; medianGapYears: number };
    counts: { trends: number; gaps: number; unknown: number };
    backtest: { guesses: number; baseRate: number; auc: number; skill: number };
  };
  trends: Record<string, Forecast>;
}

export interface Place {
  name: string;
  lat: number;
  lng: number;
}

export interface Pin {
  key: string;
  trend: Trend;
  region: Exclude<Region, "global">;
  place: Place;
  spans: [number, number][];
  home: boolean;
}

export type PinState =
  | { kind: "in" | "off" }
  | { kind: "still" | "back"; p: number }
  | { kind: "unknown" };

const CAPITALS: Record<Exclude<Region, "global">, Place> = {
  UK: { name: "London", lat: 51.51, lng: -0.13 },
  US: { name: "New York", lat: 40.71, lng: -74.0 },
  FR: { name: "Paris", lat: 48.86, lng: 2.35 },
  IT: { name: "Milan", lat: 45.46, lng: 9.19 },
};

// Hand-picked: the dataset only records countries, so these name the city a
// scene is known for. Each applies only to the pin in that city's own country.
const SCENES: Record<string, [Exclude<Region, "global">, Place]> = {
  grunge: ["US", { name: "Seattle", lat: 47.61, lng: -122.33 }],
  kinderwhore: ["US", { name: "Seattle", lat: 47.61, lng: -122.33 }],
  hippie: ["US", { name: "San Francisco", lat: 37.77, lng: -122.42 }],
  "flower-power": ["US", { name: "San Francisco", lat: 37.77, lng: -122.42 }],
  beatniks: ["US", { name: "San Francisco", lat: 37.77, lng: -122.42 }],
  "tie-dye": ["US", { name: "San Francisco", lat: 37.77, lng: -122.42 }],
  skater: ["US", { name: "Los Angeles", lat: 34.05, lng: -118.24 }],
  "hip-hop": ["US", { name: "The Bronx", lat: 40.84, lng: -73.87 }],
  "zoot-suit": ["US", { name: "Harlem", lat: 40.81, lng: -73.95 }],
  rockabilly: ["US", { name: "Memphis", lat: 35.15, lng: -90.05 }],
  "western-wear": ["US", { name: "Dallas", lat: 32.78, lng: -96.8 }],
  preppy: ["US", { name: "Boston", lat: 42.36, lng: -71.06 }],
  "ivy-league": ["US", { name: "Boston", lat: 42.36, lng: -71.06 }],
  britpop: ["UK", { name: "Manchester", lat: 53.48, lng: -2.24 }],
  rave: ["UK", { name: "Manchester", lat: 53.48, lng: -2.24 }],
  "football-casuals": ["UK", { name: "Liverpool", lat: 53.41, lng: -2.98 }],
  goth: ["UK", { name: "Leeds", lat: 53.8, lng: -1.55 }],
  "two-tone": ["UK", { name: "Coventry", lat: 52.41, lng: -1.51 }],
  mod: ["UK", { name: "Brighton", lat: 50.82, lng: -0.14 }],
};

const clamp = (p: Period, from: number, to: number): [number, number] => [Math.max(from, p.start), Math.min(to, p.end)];

export function buildPins(data: Dataset): Pin[] {
  const { from, to } = data.meta.years;
  const pins: Pin[] = [];
  for (const trend of data.trends) {
    const byRegion = new Map<Exclude<Region, "global">, [number, number][]>();
    for (const p of trend.periods) {
      if (p.region === "global") continue;
      const span = clamp(p, from, to);
      if (span[1] < span[0]) continue;
      byRegion.set(p.region, [...(byRegion.get(p.region) ?? []), span]);
    }
    const first = [...byRegion].sort((a, b) => Math.min(...a[1].map((s) => s[0])) - Math.min(...b[1].map((s) => s[0])))[0]?.[0];
    for (const [region, spans] of byRegion) {
      const scene = SCENES[trend.id];
      pins.push({
        key: `${trend.id}@${region}`,
        trend,
        region,
        place: scene?.[0] === region ? scene[1] : CAPITALS[region],
        spans: spans.sort((a, b) => a[0] - b[0]),
        home: region === first,
      });
    }
  }
  return pins;
}

export function pinState(pin: Pin, year: number, now: number, forecast?: Forecast): PinState {
  if (year <= now) return { kind: pin.spans.some(([s, e]) => s <= year && year <= e) ? "in" : "off" };
  if (!forecast || forecast.status === "unknown") return pin.home ? { kind: "unknown" } : { kind: "off" };
  if (forecast.status === "in") {
    const ongoing = pin.spans.some(([, e]) => e >= now);
    return ongoing ? { kind: "still", p: forecast.stillIn?.[year] ?? 0 } : { kind: "off" };
  }
  return pin.home ? { kind: "back", p: forecast.comebackBy?.[year] ?? 0 } : { kind: "off" };
}

export function wornEverywhere(data: Dataset, year: number): Trend[] {
  return data.trends.filter((t) => t.periods.some((p) => p.region === "global" && p.start <= year && year <= p.end));
}

export function thumb(trend: Trend, width = 160): string | null {
  const image = trend.examples[0]?.image;
  return image ? image.replace(/\/full\/![0-9]+,\//, `/full/!${width},/`) : null;
}

export function monogram(name: string): string {
  return name
    .split(/[\s-]+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function percent(p: number): string {
  return p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`;
}

const ERAS: [number, number, string, string][] = [
  [1920, 1929, "Roaring Twenties", "Hemlines up, corsets out, everyone doing the Charleston."],
  [1930, 1938, "Make-Do Thirties", "Skint but glamorous. Hollywood did the heavy lifting."],
  [1939, 1946, "Ration Book Years", "Clothing coupons, siren suits and a lot of mending."],
  [1947, 1959, "New Look Fifties", "Full skirts, tiny waists and the first teenagers."],
  [1960, 1969, "Swinging Sixties", "London runs the show. Skirts get shorter by the week."],
  [1970, 1979, "Flared Seventies", "Disco at one end, punk at the other, flares throughout."],
  [1980, 1989, "Shoulder Pad Eighties", "Bigger hair, bigger shoulders, louder everything."],
  [1990, 1999, "Grungy Nineties", "Flannel, slip dresses and looking like you did not try."],
  [2000, 2009, "Y2K", "Low rise, high gloss and some regrettable belts."],
  [2010, 2019, "Skinny Jeans Teens", "Instagram arrives. So does wearing gym kit to brunch."],
  [2020, 2026, "Everything At Once Twenties", "Lockdown joggers, then every decade came back together."],
];

export function eraFor(year: number, now: number): { name: string; line: string } {
  if (year > now) return { name: "The Crystal Ball", line: "Nobody has worn these years yet. This is the model guessing." };
  const era = ERAS.find(([from, to]) => year >= from && year <= to) ?? ERAS[ERAS.length - 1];
  return { name: era[2], line: era[3] };
}
