import { describe, expect, it } from "vitest";
import { buildPins, pinState, thumb, wornEverywhere, type Dataset, type Trend } from "./data";

const trend = (id: string, periods: Trend["periods"], image?: string): Trend => ({
  id,
  name: id,
  category: "garment",
  description: "",
  periods,
  sources: [],
  examples: image ? [{ image, title: "", designer: null, year: 1965, url: "" }] : [],
});

const data: Dataset = {
  meta: { years: { from: 1920, to: 2026 }, sources: [] },
  trends: [
    trend("miniskirt", [
      { start: 1960, end: 1969, region: "UK" },
      { start: 1964, end: 1966, region: "global" },
      { start: 1966, end: 1968, region: "FR" },
    ]),
    trend("grunge", [{ start: 1991, end: 1995, region: "US" }]),
    trend("jeans", [{ start: 1950, end: 2026, region: "global" }]),
  ],
};

describe("buildPins", () => {
  const pins = buildPins(data);

  it("pins a trend in each named country and marks the earliest as home", () => {
    expect(pins.map((p) => [p.key, p.place.name, p.home])).toEqual([
      ["miniskirt@UK", "London", true],
      ["miniskirt@FR", "Paris", false],
      ["grunge@US", "Seattle", true],
    ]);
  });

  it("leaves worldwide periods off the map and lists them by year instead", () => {
    expect(wornEverywhere(data, 1965).map((t) => t.id)).toEqual(["miniskirt", "jeans"]);
    expect(wornEverywhere(data, 1940)).toEqual([]);
  });
});

describe("pinState", () => {
  const [london, paris] = buildPins(data);

  it("lights a pin only in the years its own country records", () => {
    expect(pinState(london, 1962, 2026)).toEqual({ kind: "in" });
    expect(pinState(paris, 1962, 2026)).toEqual({ kind: "off" });
  });

  it("shows a comeback chance at the home pin only, and never a number for unknown", () => {
    const out = { waves: [], status: "out" as const, comebackBy: { 2028: 0.12 } };
    expect(pinState(london, 2028, 2026, out)).toEqual({ kind: "back", p: 0.12 });
    expect(pinState(paris, 2028, 2026, out)).toEqual({ kind: "off" });
    expect(pinState(london, 2028, 2026, { waves: [], status: "unknown" })).toEqual({ kind: "unknown" });
  });
});

describe("thumb", () => {
  it("asks the V&A image server for a small picture", () => {
    const t = trend("x", [], "https://framemark.vam.ac.uk/collections/ABC/full/!800,/0/default.jpg");
    expect(thumb(t, 160)).toBe("https://framemark.vam.ac.uk/collections/ABC/full/!160,/0/default.jpg");
    expect(thumb(trend("y", []))).toBeNull();
  });
});
