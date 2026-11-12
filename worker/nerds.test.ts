import { describe, expect, it } from "vitest";
import { DrawError, allowed, cleanSpec, type Spec } from "./nerds";

const ids = new Set(["miniskirt", "punk", "goth", "bob", "beehive"]);
const base: Spec = {
  title: "Test",
  subtitle: "Sub",
  insight: "Look here.",
  chart: "lines",
  trends: ["miniskirt", "punk"],
  measure: "presence",
  bars: "trends_on",
  families: [],
  from: 1920,
  to: 2026,
  highlights: [],
  mood: "editorial",
};

describe("cleanSpec", () => {
  it("drops trend ids that aren't in the dataset", () => {
    expect(cleanSpec({ ...base, trends: ["miniskirt", "made-up", "punk"] }, ids).trends).toEqual(["miniskirt", "punk"]);
  });

  it("caps how many trends each chart draws", () => {
    expect(cleanSpec({ ...base, trends: [...ids] }, ids).trends).toHaveLength(4);
  });

  it("refuses a trend chart with no real trends", () => {
    expect(() => cleanSpec({ ...base, trends: ["nope"] }, ids)).toThrow(DrawError);
  });

  it("lets bars and stripes go without trends", () => {
    expect(cleanSpec({ ...base, chart: "bars", trends: [] }, ids).trends).toEqual([]);
  });

  it("keeps years on the timeline and the right way round", () => {
    const spec = cleanSpec({ ...base, from: 2100, to: 1850 }, ids);
    expect([spec.from, spec.to]).toEqual([1920, 2026]);
  });

  it("drops highlights outside the years shown and unknown enum values", () => {
    const spec = cleanSpec({ ...base, from: 1960, to: 1990, highlights: [{ year: 1950, label: "early" }, { year: 1966, label: "mini" }], mood: "glitter" as Spec["mood"] }, ids);
    expect(spec.highlights).toEqual([{ year: 1966, label: "mini" }]);
    expect(spec.mood).toBe("editorial");
  });
});

describe("allowed", () => {
  it("brakes after the hourly limit and forgets old hits", () => {
    const now = 1_000_000_000;
    for (let i = 0; i < 3; i++) expect(allowed("1.2.3.4", now, 3)).toBe(true);
    expect(allowed("1.2.3.4", now, 3)).toBe(false);
    expect(allowed("1.2.3.4", now + 3_600_001, 3)).toBe(true);
  });
});
