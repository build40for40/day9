<script setup lang="ts">
import type { Nerds } from "./data";

defineProps<{ nerds: Nerds }>();
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 pt-6">
    <h1 class="font-nof-display text-3xl font-bold italic">How we got the numbers</h1>
    <p class="mt-3 text-nof-sub">Every number here comes from public sources we're allowed to use, and every trend links back to the sentence it came from. Generated {{ nerds.data.meta.generated }}.</p>
    <ul class="mt-6 space-y-4">
      <li v-for="s in nerds.data.meta.sources" :key="s.id" class="rounded-xl border border-nof-line bg-nof-panel p-4">
        <a :href="s.url" target="_blank" rel="noopener" class="font-semibold underline">{{ s.name }}</a>
        <span class="ml-2 font-mono text-xs text-nof-muted">{{ s.licence }}</span>
        <p class="mt-1 text-sm text-nof-sub">{{ s.covers }}</p>
        <p class="mt-1 text-xs text-nof-muted">Credit: {{ s.credit }}</p>
      </li>
    </ul>
    <h2 class="mt-10 font-nof-display text-2xl font-bold italic">Things to argue with us about</h2>
    <ul class="mt-3 list-disc space-y-2 pl-5 text-nof-sub">
      <li v-for="c in nerds.data.meta.caveats" :key="c">{{ c }}</li>
      <li>Year colours before 2000 are the colour word each decade's V&amp;A descriptions use more than the century average, blended between decades. From 2000 they're Pantone's Colour of the Year, which is marketing, not measurement.</li>
      <li>The silhouette figure is our own reading of each decade's typical women's daywear shape, not a measurement.</li>
    </ul>
  </section>
</template>
