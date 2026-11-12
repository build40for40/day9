<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { curtain } from "./curtain";
import type { Nerds } from "./data";
import { viewById } from "./registry";
import { useRoute } from "./route";
import ViewHost from "./ViewHost.vue";

const props = defineProps<{ nerds: Nerds }>();
const { born } = useRoute();

const ROOMS = [
  {
    id: "ebb",
    no: "I",
    title: "The Ebb and",
    em: "Flow",
    index: "A century of trends as one river",
    text: "Every ribbon is a trend. It swells while people are wearing it and thins out when they move on. Twenty two of the looks that defined their decade, from the bob to the bucket hat.",
  },
  {
    id: "arcs",
    no: "II",
    title: "Everything Comes",
    em: "Back",
    index: "Every comeback, as a leap",
    text: "Each arc jumps from one wave of a trend to its next. Nothing really dies: the typical look is back in about 16 and a half years, which is roughly how long it takes to stop being embarrassing.",
  },
  {
    id: "strings",
    no: "III",
    title: "String",
    em: "Theory",
    index: "Every comeback, tied in thread",
    text: "The comebacks Wikipedia names, wound around a clock of the century. Every thread ties a trend's first life to its second. The dashed ones are what's due next.",
  },
  {
    id: "silhouette",
    no: "IV",
    title: "The Silhouette",
    em: "Machine",
    index: "A century of women's shapes",
    text: "One woman's outline, morphing through a hundred years of what she was told her body should look like. The waist wanders, the hem jumps, the shoulders inflate. Drag to scrub.",
  },
  {
    id: "dancefloor",
    no: "V",
    title: "The Mosh",
    em: "Pit",
    index: "Trends on the dance floor",
    text: "Every trend is a dancer. The more it's worn, the closer it gets to the middle. Fading ones end up as wallflowers. The dance changes with the decade: Charleston, waltz, sock hop, disco. It's only a proper mosh pit in the 90s.",
  },
  {
    id: "hear",
    no: "VI",
    title: "Hear the",
    em: "Century",
    index: "A hundred years, played out loud",
    text: "Press play and every trend makes its own noise as it comes into style. Jackets zip, boots stomp, skirts swish and punks play a power chord. Or switch to the tuned version, where heavy coats sound low and bikinis sound light.",
  },
  {
    id: "who-wore-it-first",
    no: "VII",
    title: "Who Wore It",
    em: "First?",
    index: "Every look's origin story, told in a few stops",
    text: "Pick a look and the globe tells its story: what it was borrowed from, where it was born, who else claims it, where it went and when it came back. Dug out of old newspapers and Wikipedia in every language by Samira.",
    href: "/nerds-of-fashion/who-wore-it-first",
  },
].map((room) => ({ ...room, view: "href" in room ? undefined : viewById(room.id) }));

const hero = ref<HTMLElement>();
let stopCurtain: (() => void) | undefined;
onMounted(() => {
  if (hero.value) stopCurtain = curtain(hero.value, props.nerds, "100%").destroy;
});
onBeforeUnmount(() => stopCurtain?.());
</script>

<template>
  <header id="top" class="relative h-[clamp(520px,86vh,860px)] overflow-hidden">
    <div ref="hero" class="absolute inset-0 [&>canvas]:h-full" aria-hidden="true" />
    <div class="pointer-events-none relative mx-auto flex h-full max-w-[1280px] flex-col justify-between px-4 pt-5 pb-7 text-white mix-blend-difference">
      <div class="flex justify-between gap-3 font-mono text-[11px] tracking-[0.14em] uppercase">
        <span>Nerds of Fashion</span><span>Seven rooms · 1920 to {{ new Date().getFullYear() }}</span>
      </div>
      <h1 class="font-nof-display text-[clamp(64px,15.5vw,236px)] leading-[0.8] font-normal tracking-[-0.035em] text-balance">
        The Century <em class="block pl-[0.55em] font-normal italic">Unspooled</em>
      </h1>
      <div class="flex flex-wrap items-end justify-between gap-4">
        <p class="max-w-[40ch]">A hundred years of fashion, pulled off the chart and made physical. Every stripe above is one year, dyed its own colour.</p>
        <span class="font-mono text-[11px] tracking-[0.14em] uppercase">Scroll to enter ↓</span>
      </div>
    </div>
  </header>

  <nav aria-label="Rooms" class="mx-auto max-w-[1280px] px-4">
    <div class="grid border-t border-nof-line pt-16 pb-6 md:grid-cols-3">
      <a v-for="room in ROOMS" :key="room.id" :href="'href' in room ? room.href : `#${room.id}`" class="group grid min-w-0 grid-cols-[auto_1fr] gap-x-3.5 gap-y-1 border-b border-nof-line py-4 pr-4 no-underline">
        <span class="pt-2 font-mono text-[11px] text-nof-muted">{{ room.no }}</span>
        <span class="font-nof-display text-[clamp(24px,3vw,34px)] leading-[1.05] italic transition group-hover:translate-x-1.5 group-hover:text-nof-pink motion-reduce:transition-none">{{ room.title }} {{ room.em }}</span>
        <span class="col-start-2 text-sm text-nof-muted">{{ room.index }}</span>
      </a>
    </div>
  </nav>

  <main>
    <section v-for="room in ROOMS" :id="room.id" :key="room.id" class="scroll-mt-4 pt-18">
      <div class="mx-auto grid max-w-[1280px] items-end gap-x-12 gap-y-4 px-4 pb-6 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div>
          <p class="font-mono text-[11px] tracking-[0.14em] text-nof-pink uppercase">Room {{ room.no }}</p>
          <h2 class="mt-2.5 font-nof-display text-[clamp(44px,7.5vw,104px)] leading-[0.9] font-medium tracking-[-0.025em] text-balance">{{ room.title }} <em class="font-normal">{{ room.em }}</em></h2>
        </div>
        <p class="max-w-[54ch] text-nof-sub">{{ room.text }}</p>
      </div>
      <div class="border-y border-nof-line bg-nof-panel">
        <div class="mx-auto max-w-[1280px]">
          <a v-if="'href' in room" :href="room.href" class="group flex flex-wrap items-center justify-between gap-4 px-4 py-14 no-underline sm:px-8">
            <span class="font-nof-display text-[clamp(28px,4vw,48px)] italic transition group-hover:translate-x-1.5 group-hover:text-nof-pink motion-reduce:transition-none">Enter Who Wore It First? →</span>
            <span class="font-mono text-xs text-nof-muted">Its own page, so the globe gets the whole screen</span>
          </a>
          <ViewHost v-else-if="room.view" :nerds="nerds" :view="room.view" :born="born" :params="{}" />
          <p v-else class="px-4 py-24 text-center font-nof-display text-2xl text-nof-muted italic">This room is still being hung. Back soon.</p>
        </div>
      </div>
      <p v-if="room.view?.how" class="mx-auto mt-3 max-w-[1280px] px-4 font-mono text-xs text-nof-muted">{{ room.view.how }}</p>
    </section>
  </main>
</template>
