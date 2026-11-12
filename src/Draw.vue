<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Nerds } from "./data";
import { renderSpec, type Spec } from "./drawSpec";

const props = defineProps<{ nerds: Nerds; q: string }>();

const spec = ref<Spec>();
const error = ref("");
const svg = computed(() => (spec.value ? renderSpec(props.nerds, spec.value) : ""));
const stop = new AbortController();

onMounted(async () => {
  try {
    const response = await fetch("/nerds-of-fashion/api/draw", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: props.q }),
      signal: stop.signal,
    });
    const body = (await response.json().catch(() => ({}))) as { spec?: Spec; error?: string };
    if (!response.ok || !body.spec) throw new Error(body.error || "Claude dropped the pencil. Try again.");
    spec.value = body.spec;
  } catch (e) {
    if (!stop.signal.aborted) error.value = e instanceof Error ? e.message : String(e);
  }
});
onBeforeUnmount(() => stop.abort());

function download() {
  if (!spec.value) return;
  const blob = new Blob([svg.value], { type: "image/svg+xml" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `nerds-of-fashion-${spec.value.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.svg`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
</script>

<template>
  <section class="mx-auto max-w-xl px-4 pt-6" aria-live="polite">
    <Transition mode="out-in" enter-active-class="transition duration-700 ease-out motion-reduce:transition-none" enter-from-class="opacity-0 blur-sm">
      <div v-if="svg" key="chart">
        <div class="overflow-hidden rounded-2xl border border-nof-line" v-html="svg" />
        <button type="button" class="mt-3 text-sm text-nof-muted underline hover:text-nof-text" @click="download">Download</button>
      </div>
      <p v-else-if="error" key="error" role="alert" class="grid aspect-[4/5] place-items-center rounded-2xl border border-nof-line p-8 text-center text-nof-sub">{{ error }}</p>
      <div v-else key="sketching" role="status" aria-label="Drawing" class="flex aspect-[4/5] animate-pulse flex-col gap-4 rounded-2xl bg-nof-panel p-8 motion-reduce:animate-none">
        <div class="h-8 w-2/3 rounded-lg bg-nof-raised" />
        <div class="h-4 w-1/2 rounded bg-nof-raised" />
        <div class="mt-4 flex-1 rounded-xl bg-nof-raised" />
        <div class="h-4 w-5/6 rounded bg-nof-raised" />
      </div>
    </Transition>
  </section>
</template>
