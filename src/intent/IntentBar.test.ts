// @vitest-environment happy-dom
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import IntentBar from "./IntentBar.vue";
import type { IntentResult } from "./registry";

const match: IntentResult = {
  q: "where did punk start?",
  components: [
    { id: "globe", score: 0.8, available: true },
    { id: "trend-card", score: 0.75, available: false },
  ],
  trend: { id: "punk", name: "Punk", score: 1 },
  year: null,
  decade: null,
  ms: 140,
  fallback: false,
};
const noMatch: IntentResult = { ...match, q: "my nan's party frock", components: [{ id: "globe", score: 0.1, available: true }], trend: null };

let wrapper: VueWrapper | undefined;
const capture = vi.fn();
const fetcher = vi.fn();
const events = () => capture.mock.calls.map(([event]) => event);
const bar = () => (wrapper = mount(IntentBar, { props: { debounceMs: 0 } }));

beforeEach(() => {
  capture.mockClear();
  fetcher.mockReset().mockImplementation(async () => Response.json(match));
  vi.stubGlobal("fetch", fetcher);
  window.posthog = { capture };
});

afterEach(() => {
  wrapper?.unmount();
  vi.unstubAllGlobals();
  delete window.posthog;
});

test("labels the input and nudges with a placeholder", () => {
  const input = bar().find("input");
  expect(wrapper!.find(`label[for="${input.attributes("id")}"]`).exists()).toBe(true);
  expect(input.attributes("placeholder")).toBe("Where did punk start?");
  expect(wrapper!.find("button[type=submit]").exists()).toBe(false);
});

test("opens a match while typing, without a submit", async () => {
  await bar().find("input").setValue("  where did punk start? ");
  await flushPromises();

  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ q: "where did punk start?" });
  expect(wrapper!.emitted("resolved")).toEqual([[match]]);
  expect(events()).toEqual(["fashion_intent_resolved", "fashion_component_wanted", "fashion_component_shown"]);
});

test("stays quiet while typing when nothing fits, then draws on submit", async () => {
  fetcher.mockImplementation(async () => Response.json(noMatch));
  await bar().find("input").setValue("my nan's party frock");
  await flushPromises();
  expect(wrapper!.emitted()).not.toHaveProperty("resolved");
  expect(wrapper!.emitted()).not.toHaveProperty("draw");

  await wrapper!.find("form").trigger("submit");
  await flushPromises();
  expect(wrapper!.emitted("draw")).toEqual([["my nan's party frock"]]);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(events()).toEqual(["fashion_search_submitted"]);
});

test("draws on submit when the search itself fails", async () => {
  fetcher.mockImplementation(async () => new Response("", { status: 502 }));
  await bar().find("input").setValue("punk");
  await wrapper!.find("form").trigger("submit");
  await flushPromises();

  expect(wrapper!.emitted("draw")).toEqual([["punk"]]);
  expect(wrapper!.emitted()).not.toHaveProperty("resolved");
});

test("waits for a few letters before searching", async () => {
  await bar().find("input").setValue("pu");
  await flushPromises();
  expect(fetcher).not.toHaveBeenCalled();
});

test("clearing empties the input and tells the page", async () => {
  await bar().find("input").setValue("pu");
  await wrapper!.find("[aria-label='Clear the search']").trigger("click");

  expect(wrapper!.find("input").element.value).toBe("");
  expect(wrapper!.emitted("cleared")).toHaveLength(1);
});

test("keeps and searches what a phone keyboard is still composing", async () => {
  // Bound with v-model like the page does, so the model only catches up after a re-render.
  wrapper = mount(IntentBar, {
    props: { debounceMs: 0, modelValue: "", "onUpdate:modelValue": (q: string) => wrapper!.setProps({ modelValue: q }) },
  });
  const input = wrapper.find("input");
  await input.trigger("compositionstart");
  input.element.value = "where did punk";
  await input.trigger("input");
  await flushPromises();

  expect(input.element.value).toBe("where did punk");
  expect(wrapper!.emitted()).not.toHaveProperty("cleared");
  expect(wrapper!.find("[aria-label='Clear the search']").exists()).toBe(true);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ q: "where did punk" });
});
