import { jevClassifier } from "./classifier";
import { intentRoute } from "./intent";
import { MAX_PROMPT, allowed, anthropicDrawer, trendIndex } from "./nerds";

// Serves Nerds of Fashion at build40for40.com/nerds-of-fashion/. The static app comes from
// the assets binding, and only /nerds-of-fashion/api/* runs this code first.

const json = (body: unknown, cacheControl = "no-store") => Response.json(body, { headers: { "Cache-Control": cacheControl } });
const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
const problem = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

const classifierFor = (env: Env) => (env.TYPESAFE_API_KEY ? jevClassifier({ apiKey: env.TYPESAFE_API_KEY, baseUrl: env.TYPESAFE_API_URL || undefined }) : undefined);
const edgeCache = () => (typeof caches === "undefined" ? undefined : (caches as unknown as { default: Cache }).default);

async function capture(env: Env, event: string, distinctId: string, properties: Record<string, unknown>) {
  if (!env.PUBLIC_POSTHOG_PROJECT_TOKEN) return;
  await fetch(new URL("/i/v0/e/", env.PUBLIC_POSTHOG_HOST), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: env.PUBLIC_POSTHOG_PROJECT_TOKEN,
      event,
      distinct_id: distinctId,
      properties: { $process_person_profile: false, ...properties },
      timestamp: new Date().toISOString(),
    }),
  });
}

// PostHog hashes these into the same daily visitor id as the browser's cookieless events.
const cookieless = (request: Request) => ({
  $cookieless_mode: true,
  $ip: request.headers.get("CF-Connecting-IP"),
  $raw_user_agent: request.headers.get("User-Agent"),
  $host: new URL(request.url).host,
  $timezone: request.cf?.timezone,
});

// Turn a question into a chart spec. See worker/nerds.ts.
async function draw(request: Request, env: Env, ctx: ExecutionContext) {
  if (request.method !== "POST") return new Response("Method not allowed.", { status: 405, headers: { Allow: "POST" } });
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if (origin && origin !== url.origin) return text("Forbidden.", 403);
  if (!env.ANTHROPIC_API_KEY) return problem("Claude's off duty on this server.", 503);
  let question = "";
  try {
    question = String(((await request.json()) as { question?: unknown }).question ?? "").trim();
  } catch {
    return problem("That didn't look like a question.", 400);
  }
  if (!question) return problem("Ask us something first.", 400);
  if (question.length > MAX_PROMPT) return problem(`Keep it under ${MAX_PROMPT} characters, it's a chart not an essay.`, 400);
  const cache = edgeCache();
  const cacheKey = new Request(`https://nerds-draw.cache/?q=${encodeURIComponent(question.toLowerCase())}`);
  const hit = await cache?.match(cacheKey).catch(() => undefined);
  const report = (spec: { chart: string; trends: string[] }, ms: number, cached: boolean) => {
    const outcome = { question_length: question.length, chart: spec.chart, trends: spec.trends, ms, cached };
    console.log(JSON.stringify({ event: "nerds_draw", ...outcome }));
    ctx.waitUntil(capture(env, "nerds_chart_drawn", "$posthog_cookieless", { ...cookieless(request), ...outcome }).catch(() => {}));
  };
  if (hit) {
    const answer = (await hit.json()) as { spec: { chart: string; trends: string[] } };
    report(answer.spec, 0, true);
    return json(answer);
  }
  if (!allowed(request.headers.get("CF-Connecting-IP") ?? "local")) return problem("You've drawn a lot this hour. Have a breather and try again later.", 429);
  try {
    const dataset = new URL("/nerds-of-fashion/fashion.json", url);
    const index = await trendIndex(() => (env.ASSETS ? env.ASSETS.fetch(dataset) : fetch(dataset)));
    const started = Date.now();
    const spec = await anthropicDrawer({ apiKey: env.ANTHROPIC_API_KEY }).draw(question, index, request.signal);
    report(spec, Date.now() - started, false);
    if (cache) ctx.waitUntil(cache.put(cacheKey, Response.json({ spec }, { headers: { "Cache-Control": "max-age=86400" } })).catch(() => {}));
    return json({ spec });
  } catch (error) {
    console.error("nerds draw", error);
    return problem("Claude dropped the pencil. Try asking a different way.", 502);
  }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (/^\/nerds-of-fashion\/api\/intent\/?$/.test(pathname)) return intentRoute(request, { classifier: classifierFor(env), cache: edgeCache() });
    if (/^\/nerds-of-fashion\/api\/draw\/?$/.test(pathname)) return draw(request, env, ctx);
    if (pathname.startsWith("/nerds-of-fashion/api/")) return text("Not found.", 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
