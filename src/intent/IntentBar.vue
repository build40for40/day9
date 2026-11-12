<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from "vue";
import { createIntentResolver, pickComponents } from "./client";
import { clean } from "./query";
import { MAX_QUERY, type IntentResult } from "./registry";
import { intentEvents } from "./track";

const props = withDefaults(defineProps<{ nudges?: string[]; endpoint?: string; debounceMs?: number; minLive?: number }>(), {
  nudges: () => ["Where did punk start?", "Are flares coming back?", "What was in during the 60s?", "When were shoulder pads a thing?", "Did punk or goth last longer?"],
  debounceMs: 350,
  minLive: 3,
});
const emit = defineEmits<{ resolved: [result: IntentResult]; draw: [query: string]; cleared: [] }>();
const query = defineModel<string>({ default: "" });

const id = useId();
const busy = ref(false);
const nudge = ref(0);
const whileTyping = createIntentResolver({ endpoint: props.endpoint, debounceMs: props.debounceMs });
const onSubmit = createIntentResolver({ endpoint: props.endpoint });
let last: { q: string; result: IntentResult } | undefined;

const matches = (result: IntentResult) => pickComponents(result).show.length > 0;

/** True when a view was opened, false when nothing fits, undefined when a newer search took over. */
async function resolve(resolver: typeof whileTyping, q: string) {
  busy.value = true;
  const started = performance.now();
  try {
    const result = await resolver.run(q);
    if (!result) return undefined;
    busy.value = false;
    last = { q, result };
    if (!matches(result)) return false;
    intentEvents.resolved(result, Math.round(performance.now() - started));
    for (const c of pickComponents(result).show) intentEvents.shown(c.id, result);
    emit("resolved", result);
    return true;
  } catch (error) {
    busy.value = false;
    intentEvents.failed(error instanceof Error ? error.message : String(error), q.length);
    return false;
  }
}

// Read the box itself, not v-model: Android keyboards compose each word, and v-model ignores input mid-composition,
// so the bar would think it was empty and clear what you'd typed.
function typed(event: Event) {
  // query.value only updates once the page re-renders, so search what's in the box now.
  const value = (event.target as HTMLInputElement).value;
  query.value = value;
  onSubmit.cancel();
  const q = clean(value);
  if (!q) return clear();
  if (q.length < props.minLive) {
    whileTyping.cancel();
    busy.value = false;
    return;
  }
  void resolve(whileTyping, q);
}

async function submit() {
  const q = clean(query.value);
  if (!q) return;
  whileTyping.cancel();
  intentEvents.submitted(q, false);
  const found = last?.q === q ? matches(last.result) : await resolve(onSubmit, q);
  busy.value = false;
  if (found === false) emit("draw", q);
}

function clear() {
  whileTyping.cancel();
  onSubmit.cancel();
  query.value = "";
  busy.value = false;
  emit("cleared");
}

let rotate: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  rotate = setInterval(() => {
    if (!query.value) nudge.value = (nudge.value + 1) % props.nudges.length;
  }, 4000);
});
onBeforeUnmount(() => {
  clearInterval(rotate);
  whileTyping.cancel();
  onSubmit.cancel();
});
</script>

<template>
  <form role="search" class="relative min-w-0 text-nof-text" :aria-busy="busy" @submit.prevent="submit">
    <label :for="id" class="sr-only">Search a century of fashion</label>
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-none stroke-current stroke-2 transition-colors [stroke-linecap:round]"
      :class="busy ? 'animate-pulse text-nof-pink' : 'text-nof-muted'"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </svg>
    <input
      :id="id"
      :value="query"
      type="search"
      name="q"
      enterkeyhint="search"
      autocomplete="off"
      :maxlength="MAX_QUERY"
      :placeholder="nudges[nudge]"
      class="w-full appearance-none rounded-full border border-nof-line/60 bg-transparent py-1.5 pr-9 pl-9 text-base text-nof-text transition-colors placeholder:text-nof-muted hover:border-nof-line focus-visible:border-nof-muted [&::-webkit-search-cancel-button]:hidden"
      @input="typed"
    />
    <button
      v-if="query"
      type="button"
      aria-label="Clear the search"
      class="absolute top-1/2 right-0.5 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-nof-muted hover:text-nof-text"
      @click="clear"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" class="size-3.5 fill-none stroke-current stroke-2 [stroke-linecap:round]"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
    <p role="status" class="sr-only">{{ busy ? "Searching" : "" }}</p>
  </form>
</template>
