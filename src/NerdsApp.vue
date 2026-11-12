<script setup lang="ts">
import { computed, onMounted, onUnmounted, provide, ref, shallowRef } from "vue";
import { loadNerds, type Nerds } from "./data";
import Exhibition from "./Exhibition.vue";
import Stage from "./Stage.vue";
import Methods from "./Methods.vue";
import Draw from "./Draw.vue";
import { pickComponents } from "./intent/client";
import IntentBar from "./intent/IntentBar.vue";
import type { IntentResult } from "./intent/registry";
import { viewById } from "./registry";
import { BORN_KEY, routeKey } from "./route";

const nerds = shallowRef<Nerds>();
const failed = ref("");
const params = ref<Record<string, string>>({});
const born = ref<number | null>(null);
const query = ref("");

const read = () => {
  params.value = Object.fromEntries(new URLSearchParams(location.search));
};

const screen = computed(() => {
  const { view, q } = params.value;
  if (view === "methods") return { key: "methods" };
  const found = viewById(view ?? "");
  if (found) return { key: `view:${found.id}`, view: found };
  if (q) return { key: `draw:${q}`, q };
  return { key: "home" };
});

/** Change the URL. `push` adds a history entry for real navigation; filters just replace. */
function go(next: Record<string, string | null>, push = true) {
  const search = new URLSearchParams(location.search);
  for (const [key, value] of Object.entries(next)) value === null ? search.delete(key) : search.set(key, value);
  const url = `${location.pathname}${search.size ? `?${search}` : ""}`;
  push ? history.pushState(null, "", url) : history.replaceState(null, "", url);
  read();
}

function setBorn(year: number | null) {
  born.value = year;
  try {
    year === null ? localStorage.removeItem(BORN_KEY) : localStorage.setItem(BORN_KEY, String(year));
  } catch {
    // Private mode: keep it for this visit only.
  }
}

provide(routeKey, { params, go, born, setBorn });

const SCREEN_PARAMS = ["tab", "set", "view", "q", "trend", "trends", "year", "decade", "place", "family", "corpus", "forecast", "story"];
const blank = () => Object.fromEntries(SCREEN_PARAMS.map((key) => [key, null]));

/** Swap what's on screen. Leaving the exhibition is a step back can undo; one search screen replacing another isn't. */
function swap(next: Record<string, string | null>) {
  go({ ...blank(), ...next }, screen.value.key === "home");
  scrollTo({ top: 0 });
}

function matched(result: IntentResult) {
  const year = result.year ?? (result.decade === null ? null : result.decade + 5);
  swap({
    view: pickComponents(result).show[0].id,
    trend: result.trend?.id ?? null,
    trends: result.trend?.id ?? null,
    year: year === null ? null : String(year),
    decade: result.decade === null ? null : String(result.decade),
  });
}

function home() {
  query.value = "";
  if (screen.value.key === "home") return scrollTo({ top: 0 });
  go(blank());
  scrollTo({ top: 0 });
}

onMounted(async () => {
  read();
  query.value = params.value.q ?? "";
  // There's no birth year question any more, so nothing should talk to the reader as if it knows them.
  // Forget any year an earlier version of the page saved in this browser.
  born.value = null;
  try {
    localStorage.removeItem(BORN_KEY);
  } catch {
    // Private mode: nothing was saved.
  }
  addEventListener("popstate", read);
  try {
    nerds.value = await loadNerds();
  } catch (error) {
    failed.value = String(error);
  }
});
onUnmounted(() => removeEventListener("popstate", read));
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-nof-line/40 bg-nof-night/85 backdrop-blur">
    <div class="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-2.5">
      <button type="button" class="shrink-0 text-left font-nof-display text-2xl leading-none font-black italic tracking-tight sm:text-3xl" aria-label="Nerds of Fashion, home" @click="home">
        <span class="sm:hidden">N<span class="text-nof-pink">o</span>F</span>
        <span class="hidden sm:inline">Nerds <span class="text-nof-pink">of</span> Fashion</span>
      </button>
      <IntentBar v-model="query" class="flex-1 sm:max-w-sm" @resolved="matched" @draw="swap({ q: $event })" @cleared="home" />
    </div>
  </header>

  <main class="min-h-[70dvh]">
    <p v-if="failed" class="mx-auto max-w-xl px-4 py-24 text-center text-nof-sub">The wardrobe's stuck shut. Try a refresh. <span class="block pt-2 font-mono text-xs text-nof-muted">{{ failed }}</span></p>
    <p v-else-if="!nerds" class="py-32 text-center font-nof-display text-2xl italic text-nof-muted">Unpacking…</p>
    <Transition
      v-else
      mode="out-in"
      enter-active-class="transition duration-500 ease-out motion-reduce:transition-none"
      enter-from-class="translate-y-3 opacity-0 blur-sm"
      leave-active-class="transition duration-200 ease-in motion-reduce:transition-none"
      leave-to-class="-translate-y-2 opacity-0 blur-sm"
    >
      <div :key="screen.key">
        <Methods v-if="screen.key === 'methods'" :nerds="nerds" />
        <Stage v-else-if="screen.view" :nerds="nerds" :view="screen.view" />
        <Draw v-else-if="screen.q" :nerds="nerds" :q="screen.q" />
        <Exhibition v-else :nerds="nerds" />
      </div>
    </Transition>
  </main>

  <footer class="mx-auto mt-20 grid max-w-[1280px] gap-2 px-4 pt-16 pb-12 text-sm text-nof-muted">
    <p class="font-nof-display text-[clamp(28px,4vw,44px)] leading-[1.1] text-nof-text italic">Nerds of Fashion</p>
    <p>
      Built live on <a class="underline hover:text-nof-text" href="/">40 for 40</a>, day 9. Data from <b class="font-medium text-nof-sub">Wikipedia</b> (CC BY-SA 4.0), <b class="font-medium text-nof-sub">Google Books Ngram</b> (CC BY 3.0), the <b class="font-medium text-nof-sub">V&amp;A</b>, <b class="font-medium text-nof-sub">the Met</b> (CC0), Vogue Runway tag counts and Pantone.
      <button type="button" class="underline hover:text-nof-text" @click="swap({ view: 'methods' })">How we got the numbers</button>
    </p>
    <p>Mostly high fashion as written about and kept in museums, not what everyone wore. Year colours before 2000 are the colour each decade's museum pieces lean towards, then Pantone's pick.</p>
    <p><button type="button" class="underline hover:text-nof-text" @click="home">Back to the curtain ↑</button></p>
  </footer>
</template>
