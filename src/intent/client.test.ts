import { describe, expect, test, vi } from "vitest";
import { IntentError, createIntentResolver, pickComponents, resolveIntent } from "./client";
import type { IntentResult } from "./registry";

const result: IntentResult = {
  q: "where did punk start?",
  components: [
    { id: "board", score: 0.75, available: false },
    { id: "globe", score: 0.8, available: true },
    { id: "gaps", score: 0.69, available: false },
    { id: "trend-card", score: 0.1, available: false },
  ],
  trend: { id: "punk", name: "Punk", score: 1 },
  year: null,
  decade: null,
  ms: 140,
  fallback: false,
};
const answering = () => vi.fn(async (_url: unknown, _init?: RequestInit) => Response.json(result));

describe("resolveIntent", () => {
  test("posts the tidied search and returns the intent", async () => {
    const fetcher = answering();
    await expect(resolveIntent("  where did   punk start? ", { fetcher })).resolves.toEqual(result);

    const [url, init] = fetcher.mock.calls[0];
    expect(url).toBe("/nerds-of-fashion/api/intent");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ q: "where did punk start?" });
  });

  test("throws when the Worker says no, or there's nothing to ask", async () => {
    await expect(resolveIntent("punk", { fetcher: async () => new Response("", { status: 400 }) })).rejects.toThrow(IntentError);
    await expect(resolveIntent("   ", { fetcher: answering() })).rejects.toThrow(IntentError);
  });
});

describe("pickComponents", () => {
  test("splits what cleared the threshold into built and coming soon, best first", () => {
    expect(pickComponents(result)).toEqual({
      show: [{ id: "globe", score: 0.8, available: true }],
      comingSoon: [{ id: "board", score: 0.75, available: false }],
    });
    expect(pickComponents(result, 0.9)).toEqual({ show: [], comingSoon: [] });
  });
});

describe("createIntentResolver", () => {
  test("delivers only the latest search", async () => {
    vi.useFakeTimers();
    const fetcher = answering();
    const resolver = createIntentResolver({ fetcher, debounceMs: 300 });
    const first = resolver.run("pun");
    const second = resolver.run("punk");
    await vi.advanceTimersByTimeAsync(300);

    await expect(first).resolves.toBeNull();
    await expect(second).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  test("resolves a cancelled search to null and passes real failures on", async () => {
    const hanging = (_: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason)));
    const resolver = createIntentResolver({ fetcher: hanging as typeof fetch });
    const pending = resolver.run("punk");
    resolver.cancel();
    await expect(pending).resolves.toBeNull();

    await expect(createIntentResolver({ fetcher: async () => new Response("", { status: 502 }) }).run("punk")).rejects.toThrow(IntentError);
  });
});
