import { describe, expect, test, vi } from "vitest";
import type { TrendRef } from "../src/intent/query";
import { MAX_QUERY } from "../src/intent/registry";
import type { Classifier, Question } from "./classifier";
import { componentQuestions, intentRoute, resolveIntent } from "./intent";

const index: TrendRef[] = [
  { id: "punk", name: "Punk", aliases: ["ramones look"] },
  { id: "bell-bottoms", name: "Bell-bottoms and flares", aliases: ["flared trousers"] },
  { id: "full-skirt", name: "Full skirt", aliases: ["flared skirt", "poodle skirt"] },
];

const fakeClassifier = (nouls: Record<string, number>, onAsk = vi.fn()): Classifier => ({
  version: "test-1",
  async ask(state, questions) {
    onAsk(state, questions);
    const name = (q: Question) => (typeof q.instructions === "string" ? "" : (q.instructions as { trend: { name: string } }).trend.name);
    return {
      model: "test-1",
      answers: Object.fromEntries(Object.entries(questions).map(([key, q]) => [key, { type: "noul" as const, noul: nouls[key] ?? nouls[name(q)] ?? 0 }])),
    };
  },
});
const down: Classifier = { version: "x", ask: () => Promise.reject(new Error("503")) };
const quiet = { index, log: () => {} };

describe("resolveIntent", () => {
  test("scores every component by its best answer, best first", async () => {
    const classifier = fakeClassifier({ globe__where: 0.2, globe__place: 0.91, gaps__comeback: 0.4, gaps__wait: 0.1 });
    const result = await resolveIntent("what was in during the 60s", { ...quiet, classifier });

    expect(result).toMatchObject({
      q: "what was in during the 60s",
      trend: null,
      year: null,
      decade: 1960,
      fallback: false,
    });
    expect(result.components.slice(0, 3)).toEqual([
      { id: "globe", score: 0.91, available: true },
      { id: "gaps", score: 0.4, available: true },
      { id: "board", score: 0, available: true },
    ]);
  });

  test("takes a trend named outright without asking about it", async () => {
    const onAsk = vi.fn();
    const result = await resolveIntent("Where did punk start?", { ...quiet, classifier: fakeClassifier({}, onAsk) });

    expect(result.trend).toEqual({ id: "punk", name: "Punk", score: 1 });
    const [state, questions] = onAsk.mock.calls[0];
    expect(state).toEqual({ search: "Where did punk start?" });
    expect(Object.keys(questions)).toEqual(Object.keys(componentQuestions));
  });

  test("asks about loosely matched trends, each in its own question, and keeps the best one over the threshold", async () => {
    const onAsk = vi.fn();
    const result = await resolveIntent("flared anything", { ...quiet, classifier: fakeClassifier({ "Full skirt": 0.3, "Bell-bottoms and flares": 0.86 }, onAsk) });

    expect(result.trend).toEqual({ id: "bell-bottoms", name: "Bell-bottoms and flares", score: 0.86 });
    const asked = Object.values(onAsk.mock.calls[0][1] as Record<string, Question>).filter((q) => typeof q.instructions !== "string");
    expect(asked.map((q) => (q.instructions as { trend: unknown }).trend)).toEqual([
      { name: "Full skirt", also_called: ["flared skirt", "poodle skirt"] },
      { name: "Bell-bottoms and flares", also_called: ["flared trousers"] },
    ]);

    const unsure = await resolveIntent("flared anything", { ...quiet, classifier: fakeClassifier({ "Full skirt": 0.5 }) });
    expect(unsure.trend).toBeNull();
  });

  test("falls back to keywords when Jev is down or unset, and says so", async () => {
    for (const classifier of [down, undefined]) {
      const result = await resolveIntent("are flares coming back?", { ...quiet, classifier });
      expect(result).toMatchObject({ fallback: true, trend: { id: "bell-bottoms", score: 1 }, year: null, decade: null });
      expect(result.components[0]).toEqual({ id: "gaps", score: 1, available: true });
      expect(result.components.filter((c) => c.score > 0)).toHaveLength(1);
    }
    const era = await resolveIntent("what was in during the 60s", quiet);
    expect(era.components[0]).toEqual({ id: "dancefloor", score: 1, available: true });
  });

  test("reuses cached answers and never caches a fallback", async () => {
    const store = new Map<string, Response>();
    const cache = {
      match: async (r: Request) => store.get(r.url)?.clone(),
      put: async (r: Request, res: Response) => void store.set(r.url, res),
    } as unknown as Cache;
    await resolveIntent("punk", { ...quiet, classifier: down, cache });
    expect(store.size).toBe(0);

    const onAsk = vi.fn();
    const classifier = fakeClassifier({ "trend-card__what": 0.9 }, onAsk);
    const first = await resolveIntent("punk", { ...quiet, classifier, cache });
    const second = await resolveIntent("  PUNK ", { ...quiet, classifier, cache });
    expect(second.components).toEqual(first.components);
    expect(onAsk).toHaveBeenCalledTimes(1);
  });

  test("logs one line of JSON per request", async () => {
    const log = vi.fn();
    await resolveIntent("punk", { index, log, classifier: fakeClassifier({ "trend-card__what": 0.9 }) });
    await resolveIntent("punk", { index, log, classifier: down });

    expect(JSON.parse(log.mock.calls[0][0])).toMatchObject({ event: "fashion_intent", fallback: false, cached: false, model: "test-1", scores: { "trend-card": 0.9 }, trend: "punk" });
    expect(JSON.parse(log.mock.calls[0][0]).jev_ms).toEqual(expect.any(Number));
    expect(JSON.parse(log.mock.calls[1][0])).toMatchObject({ fallback: true, reason: "jev_failed", error: "503" });
  });
});

describe("intentRoute", () => {
  const post = (body: unknown, headers: Record<string, string> = {}) =>
    intentRoute(new Request("https://build40for40.com/nerds-of-fashion/api/intent", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body), headers }), quiet);

  test("answers a search with the intent", async () => {
    const response = await post({ q: "  where did punk   start? " });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ q: "where did punk start?", fallback: true, trend: { id: "punk" }, ms: expect.any(Number) });
  });

  test.each([[{ q: "   " }], [{ q: 12 }], ["not json"], [{ q: "x".repeat(MAX_QUERY + 1) }]])("rejects %j", async (body) => {
    expect((await post(body)).status).toBe(400);
  });

  test("only takes posts from the site itself", async () => {
    expect((await post({ q: "punk" }, { Origin: "https://elsewhere.example" })).status).toBe(403);
    expect((await intentRoute(new Request("https://build40for40.com/nerds-of-fashion/api/intent"), quiet)).status).toBe(405);
  });
});
