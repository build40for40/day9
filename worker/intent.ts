import { clean, findTrends, parseWhen, type TrendRef } from "../src/intent/query";
import { MAX_QUERY, TREND_THRESHOLD, components, type ComponentScore, type IntentResult } from "../src/intent/registry";
import trendIndex from "../src/intent/trend-index.json";
import type { Classifier, Question } from "./classifier";

const CACHE_SECONDS = 3600;
const MAX_ALIASES = 6;

const questionKey = (component: string, question: string) => `${component}__${question}`;
const trendKey = (i: number) => `trend_${i}`;

export const componentQuestions: Record<string, Question> = Object.fromEntries(
  components.flatMap((c) => Object.entries(c.questions).map(([key, q]) => [questionKey(c.id, key), { type: "noul" as const, ...q }])),
);

// Each trend goes in its own question rather than a list the model would look up by id.
const trendQuestion = ({ name, aliases }: TrendRef): Question => ({
  type: "noul",
  instructions: {
    trend: aliases.length ? { name, also_called: aliases.slice(0, MAX_ALIASES) } : { name },
    question: "Is the person who typed `search` asking about `trend`?",
  },
  criteria: {
    true: "The search names this garment, look or subculture, by this name or another name for it.",
    false: "The search is about a different garment or look, about fashion in general, or about something else.",
  },
});

const rounded = (score: number) => Number(score.toFixed(3));
const ranked = (scores: ComponentScore[]) => scores.toSorted((a, b) => b.score - a.score);

interface ResolveOptions {
  classifier?: Classifier;
  cache?: Cache;
  index?: readonly TrendRef[];
  log?: (line: string) => void;
}

type Resolved = Omit<IntentResult, "ms">;

export async function resolveIntent(query: string, { classifier, cache, index = trendIndex, log = console.log }: ResolveOptions = {}): Promise<IntentResult> {
  const started = Date.now();
  const q = clean(query);
  const when = parseWhen(q);
  const lookup = findTrends(q, index);
  const report = (result: Resolved, extra: Record<string, unknown>) => {
    const ms = Date.now() - started;
    log(
      JSON.stringify({
        event: "fashion_intent",
        q,
        fallback: result.fallback,
        cached: false,
        ms,
        scores: Object.fromEntries(result.components.map((c) => [c.id, c.score])),
        trend: result.trend?.id ?? null,
        trend_score: result.trend?.score ?? null,
        year: result.year,
        decade: result.decade,
        ...extra,
      }),
    );
    return { ...result, ms };
  };

  const keywords = (): Resolved => {
    const clues = { text: q.toLowerCase(), trend: Boolean(lookup.phrased), era: when.decade !== null };
    return {
      q,
      components: ranked(components.map((c) => ({ id: c.id, score: Number(c.fallback(clues)), available: c.available }))),
      trend: lookup.phrased ? { id: lookup.phrased.id, name: lookup.phrased.name, score: 1 } : null,
      ...when,
      fallback: true,
    };
  };
  if (!classifier) return report(keywords(), { reason: "no_key" });

  const cacheKey = new Request(`https://fashion-intent.cache/${encodeURIComponent(classifier.version)}?q=${encodeURIComponent(q.toLowerCase())}`);
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  if (hit) return report((await hit.json()) as Resolved, { cached: true });

  const asked = lookup.named ? [] : lookup.candidates;
  const questions = { ...componentQuestions, ...Object.fromEntries(asked.map((trend, i) => [trendKey(i), trendQuestion(trend)])) };
  const jevStarted = Date.now();
  try {
    const { model, answers } = await classifier.ask({ search: q }, questions);
    const jevMs = Date.now() - jevStarted;
    const noul = (key: string) => {
      const answer = answers[key];
      if (answer?.type !== "noul") throw new Error(`No answer for ${key}`);
      return answer.noul;
    };
    const guesses = asked.map((trend, i) => ({ trend, score: noul(trendKey(i)) })).toSorted((a, b) => b.score - a.score);
    const guess = guesses[0]?.score >= TREND_THRESHOLD ? guesses[0] : undefined;
    const found = lookup.named ? { trend: lookup.named, score: 1 } : guess;
    const result: Resolved = {
      q,
      components: ranked(
        components.map((c) => ({
          id: c.id,
          score: rounded(Math.max(...Object.keys(c.questions).map((key) => noul(questionKey(c.id, key))))),
          available: c.available,
        })),
      ),
      trend: found ? { id: found.trend.id, name: found.trend.name, score: rounded(found.score) } : null,
      ...when,
      fallback: false,
    };
    await cache?.put(cacheKey, Response.json(result, { headers: { "Cache-Control": `max-age=${CACHE_SECONDS}` } })).catch(() => {});
    return report(result, {
      model,
      jev_ms: jevMs,
      answers: Object.fromEntries(Object.keys(componentQuestions).map((key) => [key, rounded(noul(key))])),
      trend_guesses: Object.fromEntries(guesses.map((g) => [g.trend.id, rounded(g.score)])),
    });
  } catch (error) {
    return report(keywords(), { reason: "jev_failed", error: error instanceof Error ? error.message : String(error), jev_ms: Date.now() - jevStarted });
  }
}

const text = (body: string, status: number, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", ...headers } });

export async function intentRoute(request: Request, options: ResolveOptions): Promise<Response> {
  if (request.method !== "POST") return text("Method not allowed.", 405, { Allow: "POST" });
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) return text("Forbidden.", 403);

  const input = (await request.json().catch(() => null)) as { q?: unknown } | null;
  const q = typeof input?.q === "string" ? clean(input.q) : "";
  if (!q) return text("Type something to search for.", 400);
  if (q.length > MAX_QUERY) return text(`Keep it under ${MAX_QUERY} characters.`, 400);

  return Response.json(await resolveIntent(q, options), { headers: { "Cache-Control": "no-store" } });
}
