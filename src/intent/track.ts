import { pickComponents } from "./client";
import type { ComponentId, IntentResult } from "./registry";

// The pool's search cuts what it sends on at this length, and so does this.
const MAX_TRACKED_QUERY = 80;

const capture = (event: string, properties: Record<string, unknown>) => window.posthog?.capture(event, properties);

export const intentEvents = {
  submitted(query: string, example: boolean) {
    capture("fashion_search_submitted", { query: query.slice(0, MAX_TRACKED_QUERY), query_length: query.length, example });
  },

  resolved(result: IntentResult, latencyMs: number) {
    const { show, comingSoon } = pickComponents(result);
    capture("fashion_intent_resolved", {
      scores: Object.fromEntries(result.components.map((c) => [c.id, c.score])),
      top_component: result.components[0]?.id ?? null,
      top_score: result.components[0]?.score ?? null,
      shown: show.map((c) => c.id),
      coming_soon: comingSoon.map((c) => c.id),
      trend_id: result.trend?.id ?? null,
      trend_score: result.trend?.score ?? null,
      year: result.year,
      decade: result.decade,
      latency_ms: latencyMs,
      worker_ms: result.ms,
      fallback: result.fallback,
    });
    for (const c of comingSoon) intentEvents.wanted(c.id, c.score, result);
  },

  shown(component: ComponentId, result?: IntentResult) {
    capture("fashion_component_shown", { component, score: result?.components.find((c) => c.id === component)?.score ?? null, trend_id: result?.trend?.id ?? null });
  },

  wanted(component: ComponentId, score: number, result: IntentResult) {
    capture("fashion_component_wanted", { component, score, trend_id: result.trend?.id ?? null, fallback: result.fallback });
  },

  failed(reason: string, queryLength: number) {
    capture("fashion_intent_failed", { reason, query_length: queryLength });
  },
};
