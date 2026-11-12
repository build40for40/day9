# Nerds of Fashion

Sabermetrics for fashion: a hundred years of trends, comebacks, shapes and colours, starting with the year you were born. Day 9 of [40 for 40](https://build40for40.com), served at [build40for40.com/nerds-of-fashion/](https://build40for40.com/nerds-of-fashion/).

See `AGENTS.md` for how it fits together and how to run it, and `datasets/fashion/README.md` for where the data comes from.

## Search

The search bar (`src/intent/IntentBar.vue`) asks the Worker what a search is after. The page opens the best-fitting view from `src/views/`, focused on the trend and year the search named. When no built view fits, the search goes to `/nerds-of-fashion/api/draw` and the drawn chart replaces whatever was showing.

`POST /nerds-of-fashion/api/intent` takes `{ "q": "where did punk start?" }`, up to 120 characters, and answers:

```json
{
  "q": "where did punk start?",
  "components": [{ "id": "globe", "score": 0.8, "available": true }, { "id": "trend-card", "score": 0.07, "available": false }],
  "trend": { "id": "punk", "name": "Punk", "score": 1 },
  "year": null,
  "decade": null,
  "ms": 190,
  "fallback": false
}
```

- **`components`:** every entry in `src/intent/registry.ts`, best first. Jev answers each entry's yes or no questions about the search, and the score is the entry's best answer. A component is shown at `SHOW_THRESHOLD` (0.7) or more. `pickComponents` in `client.ts` applies it and splits the built ones from the ones still to come.
- **`trend`:** the dataset trend the search is about. Code finds it first: a trend whose name is in the search scores 1 and Jev isn't asked. Otherwise up to six trends sharing an alias or a word with the search go to Jev, one question each, and the best one counts at `TREND_THRESHOLD` or more. Names and aliases come from `src/intent/trend-index.json`, so the Worker never bundles the dataset. Regenerate it after the dataset changes with `npm run trend-index`.
- **`year` and `decade`:** read from the search by code ("1967", "the 60s", "noughties"). "The 20s" means the 1920s.
- **`fallback`:** true when Jev is down, slow or has no key. Scores are then 1 or 0 from each entry's keyword rule, and the trend is the longest name or alias found in the search. Bad input gets a 400, and nothing gets a 500.

Jev's answers are cached for an hour per search. Fallbacks aren't cached. Only the search text, and the names and aliases of candidate trends, are sent to Jev.

Every request logs one line of JSON, so `npm run wrangler -- tail` shows what happened:

```json
{ "event": "fashion_intent", "q": "…", "fallback": false, "cached": false, "ms": 190, "jev_ms": 184, "model": "jev-…", "scores": { "globe": 0.8 }, "answers": { "globe__where": 0.8 }, "trend": "punk", "trend_score": 1, "trend_guesses": {}, "year": null, "decade": null }
```

A fallback adds `reason` (`no_key` or `jev_failed`) and the `error`.

The browser sends these to PostHog (`src/intent/track.ts`):

| Event | When | Properties |
| --- | --- | --- |
| `fashion_search_submitted` | A search is sent | `query` (first 80 characters), `query_length`, `example` |
| `fashion_intent_resolved` | The Worker answers | `scores`, `top_component`, `top_score`, `shown`, `coming_soon`, `trend_id`, `trend_score`, `year`, `decade`, `latency_ms`, `worker_ms`, `fallback` |
| `fashion_component_shown` | A built component cleared the threshold | `component`, `score`, `trend_id` |
| `fashion_component_wanted` | A component that isn't built yet cleared it | `component`, `score`, `trend_id`, `fallback` |
| `fashion_intent_failed` | The request failed | `reason`, `query_length` |

Every view has an entry with the same `id`, and `registry.test.ts` fails when one is missing. To add a component, add one entry to `components` in `registry.ts`: an `id`, a `label`, whether it's `available`, its `questions` for Jev (one judgment each, with what yes and no look like) and a `fallback` keyword rule. The Worker, the scores, the events and `pickComponents` pick it up from there. Flip `available` to `true` once the page can render it.

## Draw your own

`POST /nerds-of-fashion/api/draw` with `{ "question": "..." }` turns a question into a chart, for any search that fits no view. Claude gets the question and the trend list read from `fashion.json`, and replies with a spec: one of six chart types, which trends, which measure and which years. It never writes code or numbers. `cleanSpec` in `worker/nerds.ts` drops anything the dataset doesn't have, and `renderSpec` in `src/drawSpec.ts` draws the spec as an SVG from `fashion.json` in the browser. Answers are cached for a day per question, and one address gets 20 fresh drawings an hour. Each request logs a `nerds_draw` line and sends a `nerds_chart_drawn` event with the chart, trends, timing and the question's length, never its text. Without `ANTHROPIC_API_KEY` it answers 503.
