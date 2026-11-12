// The comeback forecast: public/forecast.json, written by
// datasets/fashion/scripts/forecast.mjs, plus the sums the forecast views share.

import { BASE } from "./data";

export type Wave = [start: number, end: number];

export interface TrendForecast {
  waves: Wave[];
  status: "in" | "out" | "unknown";
  inNow?: boolean;
  typicalGap?: number;
  stillIn?: Record<string, number>;
  comebackBy?: Record<string, number>;
  verdict?: "likely" | "possible" | "unlikely";
  medianReturn?: number;
  returnRange?: [number, number];
}

export interface CalibrationBucket {
  from: number;
  to: number;
  guesses: number;
  predicted: number;
  observed: number;
}

export interface ForecastFile {
  meta: {
    now: number;
    horizon: number[];
    summary: string;
    params: { returnShare: number; medianGapYears: number; logMu: number; logSd: number; medianWaveYears: number };
    counts: { trends: number; gaps: number; in: number; out: number; unknown: number };
    bands: { likely: number; possible: number };
    backtest: { guesses: number; baseRate: number; brier: number; brierBaseRate: number; skill: number; auc: number; calibration?: CalibrationBucket[] };
  };
  trends: Record<string, TrendForecast>;
}

let loading: Promise<ForecastFile> | undefined;
export function loadForecast() {
  loading ??= fetch(`${BASE}/forecast.json`).then((response) => {
    if (!response.ok) throw new Error(`forecast.json: ${response.status}`);
    return response.json() as Promise<ForecastFile>;
  });
  loading.catch(() => (loading = undefined));
  return loading;
}

export interface Gap {
  id: string;
  from: number;
  to: number;
  gap: number;
}

/** Every wait in the file: the years from one wave starting to the next one starting. */
export function waveGaps(trends: Record<string, { waves: Wave[] }>): Gap[] {
  return Object.entries(trends).flatMap(([id, { waves }]) => waves.slice(1).map((wave, i) => ({ id, from: waves[i][0], to: wave[0], gap: wave[0] - waves[i][0] })));
}

export const lognormalPdf = (x: number, mu: number, sd: number) => (x <= 0 ? 0 : Math.exp(-((Math.log(x) - mu) ** 2) / (2 * sd * sd)) / (x * sd * Math.sqrt(2 * Math.PI)));

export const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = values.toSorted((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/** How far a wait is from a whole number of laps of `period`, in years. */
export const offBeat = (gap: number, period: number) => Math.abs(((gap + period / 2) % period) - period / 2);

export interface Bin<T> {
  low: number;
  items: T[];
}

/** Equal bins of `size` covering every value, empty ones included, lowest first. */
export function binned<T>(items: T[], value: (item: T) => number, size: number): Bin<T>[] {
  if (!items.length) return [];
  const index = (item: T) => Math.floor(value(item) / size);
  const first = Math.min(...items.map(index));
  const last = Math.max(...items.map(index));
  const bins: Bin<T>[] = Array.from({ length: last - first + 1 }, (_, i) => ({ low: (first + i) * size, items: [] }));
  for (const item of items) bins[index(item) - first].items.push(item);
  return bins;
}

export interface BookLag {
  /** The wave the peak belongs to: the latest one that had started by then, else the first. */
  waveStart: number;
  peak: number;
  lag: number;
  /** Books were still writing more each year when the data stops, so the peak isn't one yet. */
  climbing: boolean;
}

/** The start of the latest wave under way or over by `year`, else of the first wave. */
export const waveBefore = (waves: Wave[], year: number) => waves.findLast((wave) => wave[0] <= year)?.[0] ?? waves[0][0];

/** Years from a wave starting to the peak of a book curve whose first value is for `firstYear`. */
export function bookLag(curve: number[] | undefined, firstYear: number, waves: Wave[]): BookLag | null {
  if (!curve?.length || !waves.length) return null;
  const top = Math.max(...curve);
  if (!(top > 0)) return null;
  const peak = firstYear + curve.indexOf(top);
  const waveStart = waveBefore(waves, peak);
  return { waveStart, peak, lag: peak - waveStart, climbing: peak >= firstYear + curve.length - 2 };
}

/** 0 to 1: the average distance between two curves that are each scaled to their own peak. */
export const disagreement = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + Math.abs(value - (b[i] ?? 0)), 0) / (a.length || 1);
