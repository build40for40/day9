import { describe, expect, test, vi } from "vitest";
import { jevClassifier } from "./classifier";

const answer = { model: "jev-1.13.0", answers: { fit: { type: "score", score: 2, confidence: 0.8 } }, usage: { input_tokens: 1, output_tokens: 1 } };
const ok = () => Response.json(answer);

describe("jevClassifier", () => {
  test("posts the state and questions to System One with the key", async () => {
    const fetcher = vi.fn(async () => ok());
    const jev = jevClassifier({ apiKey: "key", fetcher });
    const questions = { fit: { type: "score" as const, instructions: "How well", criteria: ["no", "yes"] } };

    await expect(jev.ask({ a: 1 }, questions)).resolves.toMatchObject({ model: "jev-1.13.0" });

    const [url, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(String(url)).toBe("https://api.typesafe.ai/v1/systemone");
    expect(init.headers).toMatchObject({ Authorization: "Bearer key" });
    expect(JSON.parse(String(init.body))).toEqual({ model: "jev-latest", state: { a: 1 }, questions });
  });

  test("logs the exact body it sends", async () => {
    const fetcher = vi.fn(async () => ok());
    const log = vi.fn();
    await jevClassifier({ apiKey: "key", fetcher, log }).ask({ a: 1 }, {});
    const [, init] = fetcher.mock.calls[0] as unknown as [URL, RequestInit];
    expect(log).toHaveBeenCalledWith(init.body);
    expect(log.mock.calls[0][0]).not.toContain("key");
  });

  test("retries a server error once", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response("", { status: 503 })).mockResolvedValueOnce(ok());
    await jevClassifier({ apiKey: "key", fetcher }).ask({}, {});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("doesn't retry a bad request", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 422 }));
    await expect(jevClassifier({ apiKey: "key", fetcher }).ask({}, {})).rejects.toThrow("422");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("gives up when it's too slow", async () => {
    const fetcher = vi.fn((_: unknown, init?: RequestInit) => new Promise<Response>((_, reject) => init?.signal?.addEventListener("abort", () => reject(init.signal!.reason))));
    await expect(jevClassifier({ apiKey: "key", fetcher: fetcher as typeof fetch, timeoutMs: 30 }).ask({}, {})).rejects.toThrow();
  });
});
