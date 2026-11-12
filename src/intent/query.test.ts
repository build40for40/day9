import { describe, expect, test } from "vitest";
import { clean, findTrends, parseWhen, type TrendRef } from "./query";

const index: TrendRef[] = [
  { id: "punk", name: "Punk", aliases: ["hardcore punk", "ramones look"] },
  { id: "pop-punk", name: "Pop punk", aliases: [] },
  { id: "glam-rock", name: "Glam rock", aliases: ["glam punk"] },
  { id: "bell-bottoms", name: "Bell-bottoms and flares", aliases: ["flared trousers", "bell bottoms"] },
  { id: "full-skirt", name: "Full skirt", aliases: ["flared skirt", "poodle skirt"] },
  { id: "football-casuals", name: "Football casuals", aliases: ["casual"] },
];

describe("parseWhen", () => {
  test.each([
    ["what was in during the 60s", null, 1960],
    ["fashion in the '90s", null, 1990],
    ["the 1920s look", null, 1920],
    ["2020s micro trends", null, 2020],
    ["the swinging sixties", null, 1960],
    ["noughties denim", null, 2000],
    ["what did people wear in 1967?", 1967, 1960],
    ["the 00s", null, 2000],
    ["will flares be back in 2028", 2028, 2020],
    ["where did punk start?", null, null],
    ["size 1200 jeans", null, null],
  ])("%s", (query, year, decade) => {
    expect(parseWhen(query)).toEqual({ year, decade });
  });
});

describe("findTrends", () => {
  const ids = (query: string) => {
    const { named, phrased, candidates } = findTrends(query, index);
    return { named: named?.id ?? null, phrased: phrased?.id ?? null, candidates: candidates.map((t) => t.id) };
  };

  test("names the trend whose name is in the search", () => {
    expect(ids("Where did punk start?")).toMatchObject({ named: "punk", phrased: "punk" });
  });

  test("prefers the longer name", () => {
    expect(ids("who wore pop punk")).toMatchObject({ named: "pop-punk" });
  });

  test("matches plurals and either half of a double name", () => {
    expect(ids("are flares coming back?")).toMatchObject({ named: "bell-bottoms" });
    expect(ids("bell bottom jeans")).toMatchObject({ named: "bell-bottoms" });
  });

  test("leaves an alias match, or a longer alias of another trend, for Jev to settle", () => {
    expect(ids("poodle skirts")).toEqual({ named: null, phrased: "full-skirt", candidates: ["full-skirt"] });
    expect(ids("glam punk")).toEqual({ named: null, phrased: "glam-rock", candidates: ["glam-rock", "punk", "pop-punk"] });
  });

  test("offers trends that only share a word, and nothing for small talk", () => {
    expect(ids("flared anything")).toEqual({ named: null, phrased: null, candidates: ["full-skirt", "bell-bottoms"] });
    expect(ids("what was in during the 60s")).toEqual({ named: null, phrased: null, candidates: [] });
  });
});

test("clean trims and collapses whitespace", () => {
  expect(clean("  mini \n skirts  ")).toBe("mini skirts");
});
