<script setup lang="ts">
import { computed } from "vue";
import type { Nerds } from "./data";
import { useRoute } from "./route";
import type { View } from "./view";
import ViewHost from "./ViewHost.vue";

const props = defineProps<{ nerds: Nerds; view: View }>();
const { params, go, born } = useRoute();

const RESERVED = new Set(["tab", "set", "view", "born", "q"]);
const viewParams = computed(() => Object.fromEntries(Object.entries(params.value).filter(([key]) => !RESERVED.has(key))));
const sources = computed(() => props.nerds.data.meta.sources.filter((s) => props.view.sources.includes(s.id)));
const setParam = (key: string, value: string | null) => go({ [key]: value }, false);
</script>

<template>
  <section class="mx-auto max-w-[1280px] px-4 pt-6">
    <h1 class="font-nof-display text-2xl leading-tight font-bold italic sm:text-3xl">{{ view.title }}</h1>
    <div class="mt-4 overflow-hidden rounded-2xl border border-nof-line bg-nof-panel">
      <ViewHost :nerds="nerds" :view="view" :born="born" :params="viewParams" @param="setParam" />
    </div>
    <p class="mt-3 font-mono text-xs text-nof-muted">
      <template v-if="view.how">{{ view.how }}<template v-if="sources.length"> · </template></template>
      <template v-for="(s, i) in sources" :key="s.id"><a :href="s.url" class="underline hover:text-nof-text" target="_blank" rel="noopener">{{ s.name }}</a> ({{ s.licence }})<template v-if="i < sources.length - 1">, </template></template>
    </p>
  </section>
</template>
