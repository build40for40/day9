import { expect, test } from "vitest";
import worker from "./index";

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;
const assets = { fetch: async () => new Response("the app") } as unknown as Fetcher;

test("the intent route answers with keywords when Jev has no key", async () => {
  const request = new Request("https://build40for40.com/nerds-of-fashion/api/intent", { method: "POST", body: JSON.stringify({ q: "where did punk start?" }) });
  const response = await worker.fetch(request as never, { ASSETS: assets } as Env, ctx);

  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ fallback: true, trend: { id: "punk" }, components: expect.arrayContaining([{ id: "globe", score: 1, available: true }]) });
});

test("drawing says Claude's off duty without a key", async () => {
  const request = new Request("https://build40for40.com/nerds-of-fashion/api/draw", { method: "POST", body: JSON.stringify({ question: "punk vs goth" }) });
  expect((await worker.fetch(request as never, { ASSETS: assets } as Env, ctx)).status).toBe(503);
});

test("unknown API paths are a 404, and everything else is the app", async () => {
  expect((await worker.fetch(new Request("https://build40for40.com/nerds-of-fashion/api/nope") as never, { ASSETS: assets } as Env, ctx)).status).toBe(404);
  expect(await (await worker.fetch(new Request("https://build40for40.com/nerds-of-fashion/") as never, { ASSETS: assets } as Env, ctx)).text()).toBe("the app");
});
