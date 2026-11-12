// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { IntentResult } from "./registry";
import { intentEvents } from "./track";

const result: IntentResult = {
  q: "are flares coming back?",
  components: [
    { id: "gaps", score: 0.89, available: false },
    { id: "globe", score: 0.72, available: true },
    { id: "board", score: 0.11, available: false },
    { id: "trend-card", score: 0.05, available: false },
  ],
  trend: { id: "bell-bottoms", name: "Bell-bottoms and flares", score: 1 },
  year: null,
  decade: null,
  ms: 130,
  fallback: false,
};

const capture = vi.fn();
beforeEach(() => {
  capture.mockClear();
  window.posthog = { capture };
});
afterEach(() => {
  delete window.posthog;
});

test("a submitted search sends its length, whether it was an example, and at most 80 characters of it", () => {
  intentEvents.submitted("x".repeat(100), true);
  expect(capture).toHaveBeenCalledWith("fashion_search_submitted", { query: "x".repeat(80), query_length: 100, example: true });
});

test("a resolved intent sends the scores, and one event for each component that isn't built yet", () => {
  intentEvents.resolved(result, 210);
  expect(capture.mock.calls).toEqual([
    [
      "fashion_intent_resolved",
      {
        scores: { gaps: 0.89, globe: 0.72, board: 0.11, "trend-card": 0.05 },
        top_component: "gaps",
        top_score: 0.89,
        shown: ["globe"],
        coming_soon: ["gaps"],
        trend_id: "bell-bottoms",
        trend_score: 1,
        year: null,
        decade: null,
        latency_ms: 210,
        worker_ms: 130,
        fallback: false,
      },
    ],
    ["fashion_component_wanted", { component: "gaps", score: 0.89, trend_id: "bell-bottoms", fallback: false }],
  ]);
});

test("shown and failed say which component and why", () => {
  intentEvents.shown("globe", result);
  intentEvents.failed("Intent answered 502", 12);
  expect(capture.mock.calls).toEqual([
    ["fashion_component_shown", { component: "globe", score: 0.72, trend_id: "bell-bottoms" }],
    ["fashion_intent_failed", { reason: "Intent answered 502", query_length: 12 }],
  ]);
});

test("does nothing without PostHog", () => {
  delete window.posthog;
  expect(() => intentEvents.submitted("punk", false)).not.toThrow();
});
