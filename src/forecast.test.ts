import { describe, expect, test } from "vitest";
import { binned, bookLag, disagreement, lognormalPdf, median, offBeat, waveGaps, type Wave } from "./forecast";

const flares: Wave[] = [
  [1966, 1978],
  [1994, 2000],
  [2019, 2026],
];

describe("waveGaps", () => {
  test("measures each wait from one wave starting to the next, and gives one wave none", () => {
    expect(waveGaps({ flares: { waves: flares }, crocs: { waves: [[2006, 2009]] } })).toEqual([
      { id: "flares", from: 1966, to: 1994, gap: 28 },
      { id: "flares", from: 1994, to: 2019, gap: 25 },
    ]);
  });
});

describe("the sums", () => {
  test("the fitted curve peaks before its median and is zero at zero", () => {
    const mu = Math.log(18.5);
    expect(lognormalPdf(0, mu, 0.7)).toBe(0);
    expect(lognormalPdf(11, mu, 0.7)).toBeGreaterThan(lognormalPdf(18.5, mu, 0.7));
    expect(lognormalPdf(18.5, mu, 0.7)).toBeCloseTo(1 / (18.5 * 0.7 * Math.sqrt(2 * Math.PI)));
  });

  test("median copes with odd, even and empty lists", () => {
    expect(median([9, 1, 5])).toBe(5);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });

  test("offBeat is the distance to the nearest whole lap", () => {
    expect(offBeat(20, 10)).toBe(0);
    expect(offBeat(23, 10)).toBe(3);
    expect(offBeat(28, 10)).toBe(2);
  });

  test("binned keeps the empty bins between the first and the last", () => {
    expect(binned([-3, 1, 12], (v) => v, 5).map((bin) => [bin.low, bin.items])).toEqual([
      [-5, [-3]],
      [0, [1]],
      [5, []],
      [10, [12]],
    ]);
  });

  test("disagreement is nothing for twins and everything for opposites", () => {
    expect(disagreement([0, 1, 0.5], [0, 1, 0.5])).toBe(0);
    expect(disagreement([1, 0], [0, 1])).toBe(1);
  });
});

describe("bookLag", () => {
  const curve = (peakYear: number) => Array.from({ length: 103 }, (_, i) => 1 / (1 + Math.abs(1920 + i - peakYear)));

  test("counts from the latest wave that had started by the peak", () => {
    expect(bookLag(curve(1999), 1920, flares)).toEqual({ waveStart: 1994, peak: 1999, lag: 5, climbing: false });
  });

  test("goes negative when the books got there before the first wave", () => {
    expect(bookLag(curve(1960), 1920, flares)).toMatchObject({ waveStart: 1966, lag: -6 });
  });

  test("flags a curve that is still climbing when the data stops, and skips a flat one", () => {
    expect(bookLag(curve(2022), 1920, flares)?.climbing).toBe(true);
    expect(bookLag(new Array(103).fill(0), 1920, flares)).toBeNull();
    expect(bookLag(undefined, 1920, flares)).toBeNull();
  });
});
