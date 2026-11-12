<script setup lang="ts">
import { geoDistance, geoGraticule10, geoOrthographic, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import {
  buildPins,
  eraFor,
  monogram,
  percent,
  pinState,
  thumb,
  wornEverywhere,
  type Dataset,
  type Forecast,
  type ForecastFile,
  type Pin,
  type PinState,
  type Trend,
} from "./data";

const props = defineProps<{ dataset?: Dataset; focusTrend?: string | null; focusYear?: number | null }>();
const emit = defineEmits<{ year: [year: number]; trend: [id: string | null] }>();

interface Shown {
  key: string;
  pin?: Pin;
  more?: { place: string; count: number };
  state: PinState;
  size: number;
  x: number;
  y: number;
  scale: number;
  img: string | null;
  label: string;
}

const FROM = 1920;
const START = 1966;
const HOME: [number, number] = [20, -44];

const data = shallowRef<Dataset | null>(null);
const forecasts = shallowRef<ForecastFile | null>(null);
const failed = ref(false);
const year = ref(START);
const selected = shallowRef<{ trend: Trend; pin?: Pin } | null>(null);
const list = shallowRef<{ title: string; trends: Trend[] } | null>(null);
const playing = ref(false);
const shown = shallowRef<Shown[]>([]);
const broken = ref(new Set<string>());
const zoomedIn = ref(false);
const narrow = ref(false);

const now = computed(() => data.value?.meta.years.to ?? 2026);
const last = computed(() => forecasts.value?.meta.horizon.at(-1) ?? now.value + 3);
const isForecast = computed(() => year.value > now.value);
const era = computed(() => eraFor(year.value, now.value));
const pins = computed(() => (data.value ? buildPins(data.value) : []));
const everywhere = computed(() => (data.value && !isForecast.value ? wornEverywhere(data.value, year.value) : []));
const forecastOf = (t: Trend): Forecast | undefined => forecasts.value?.trends[t.id];
const stateOf = (pin: Pin) => pinState(pin, year.value, now.value, forecastOf(pin.trend));
const chance = (s: PinState) => ("p" in s ? s.p : 0);

const WORTH_A_PIN = 0.1;
const lit = computed(() =>
  pins.value
    .map((pin) => ({ pin, state: stateOf(pin) }))
    .filter((l) => l.state.kind !== "off" && (l.state.kind !== "back" || l.state.p >= WORTH_A_PIN || l.pin.trend.id === selected.value?.trend.id)),
);

const byPlace = computed(() => {
  const groups = new Map<string, { pin: Pin; state: PinState }[]>();
  for (const l of lit.value) groups.set(l.pin.place.name, [...(groups.get(l.pin.place.name) ?? []), l]);
  const rank = (l: { pin: Pin; state: PinState }) => {
    const arrived = Math.max(...l.pin.spans.filter(([s]) => s <= year.value).map(([s]) => s), FROM);
    return [
      l.pin.trend.id === selected.value?.trend.id ? 0 : 1,
      l.state.kind === "unknown" ? 1 : 0,
      -chance(l.state),
      thumb(l.pin.trend) ? 0 : 1,
      year.value - arrived,
    ];
  };
  for (const group of groups.values())
    group.sort((a, b) => {
      const [ra, rb] = [rank(a), rank(b)];
      const i = ra.findIndex((v, j) => v !== rb[j]);
      return i < 0 ? 0 : ra[i] - rb[i];
    });
  return groups;
});

const perPlace = computed(() => (zoomedIn.value ? 12 : narrow.value ? 4 : 6));

const candidates = computed(() => {
  const out: Omit<Shown, "x" | "y" | "scale">[] = [];
  const base = narrow.value ? 34 : 42;
  for (const [place, group] of byPlace.value) {
    const picked = group.filter((l, i) => i < perPlace.value || l.pin.trend.id === selected.value?.trend.id);
    for (const { pin, state } of picked) {
      const p = chance(state);
      const size = state.kind === "still" ? base * (0.6 + 0.4 * p) : state.kind === "back" ? base * Math.min(1, 0.5 + p * 2.4) : state.kind === "unknown" ? base * 0.6 : base;
      const what =
        state.kind === "in" ? `in fashion in ${year.value}` : state.kind === "still" ? `${percent(p)} chance still in by ${year.value}` : state.kind === "back" ? `${percent(p)} chance of a comeback by ${year.value}` : "forecast unknown: only one recorded wave";
      out.push({ key: pin.key, pin, state, size, img: broken.value.has(pin.trend.id) ? null : thumb(pin.trend), label: `${pin.trend.name}, ${pin.place.name}, ${what}` });
    }
    if (group.length > picked.length)
      out.push({ key: `more@${place}`, more: { place, count: group.length - picked.length }, state: { kind: "in" }, size: base * 0.8, img: null, label: `${group.length - picked.length} more in ${place}` });
  }
  return out;
});

const counts = computed(() => {
  const kinds = { in: 0, still: 0, back: 0, unknown: 0 };
  const seen = new Set<string>();
  for (const { pin, state } of lit.value) {
    if (seen.has(pin.trend.id) || state.kind === "off") continue;
    seen.add(pin.trend.id);
    kinds[state.kind]++;
  }
  return kinds;
});

const bars = computed(() => {
  const all = pins.value;
  const max = { v: 1 };
  const rows = [];
  for (let y = FROM; y <= last.value; y++) {
    let c = 0;
    for (const pin of all) {
      const s = pinState(pin, y, now.value, forecastOf(pin.trend));
      c += s.kind === "in" ? 1 : "p" in s ? s.p : 0;
    }
    max.v = Math.max(max.v, c);
    rows.push({ y, c });
  }
  return rows.map((r) => ({ ...r, h: Math.max(2, (r.c / max.v) * 100) }));
});

/* The forecast years get a wider share of the track so three years stay scrubbable on a phone. */
const history = computed(() => now.value - FROM + 1);
const future = computed(() => last.value - now.value);
const stretch = computed(() => {
  const share = narrow.value ? 0.27 : 0.18;
  return (share * history.value) / ((1 - share) * future.value);
});
const total = computed(() => history.value + future.value * stretch.value);
const xOf = (y: number) => ((y <= now.value ? y - FROM + 0.5 : history.value + (y - now.value - 0.5) * stretch.value) / total.value) * 100;
const yearAt = (frac: number) => {
  const u = Math.max(0, Math.min(0.9999, frac)) * total.value;
  return u < history.value ? FROM + Math.floor(u) : Math.min(last.value, now.value + 1 + Math.floor((u - history.value) / stretch.value));
};
const ticks = computed(() => {
  const out = [];
  for (let y = FROM; y <= now.value; y += 20) out.push({ y, label: String(y), future: false });
  for (let y = now.value + 1; y <= last.value; y++) out.push({ y, label: `’${String(y).slice(2)}`, future: true });
  return out;
});

function setYear(y: number) {
  year.value = Math.max(FROM, Math.min(last.value, Math.round(y)));
}

let timer: ReturnType<typeof setTimeout> | undefined;
function stop() {
  playing.value = false;
  clearTimeout(timer);
}
function tick() {
  if (year.value >= last.value) return stop();
  setYear(year.value + 1);
  timer = setTimeout(tick, year.value >= now.value ? 1500 : 420);
}
function togglePlay() {
  if (playing.value) return stop();
  playing.value = true;
  if (year.value >= last.value) setYear(FROM);
  timer = setTimeout(tick, 300);
}

const track = ref<HTMLElement | null>(null);
let scrubbing = false;
function scrub(ev: PointerEvent) {
  const r = track.value!.getBoundingClientRect();
  setYear(yearAt((ev.clientX - r.left) / r.width));
}
function trackDown(ev: PointerEvent) {
  scrubbing = true;
  stop();
  scrub(ev);
  ev.preventDefault();
  track.value!.focus({ preventScroll: true });
}
function trackKey(ev: KeyboardEvent) {
  const step = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[ev.key];
  if (step) setYear(year.value + step);
  else if (ev.key === "Home") setYear(FROM);
  else if (ev.key === "End") setYear(last.value);
  else return;
  stop();
  ev.preventDefault();
}

/* Globe drawing. Kept outside Vue's reactivity: it changes every frame. */
const stage = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const projection = geoOrthographic().clipAngle(90).precision(0.4);
const graticule = geoGraticule10();
const offsets = new Map<string, [number, number]>();
let land: GeoPermissibleObjects | null = null;
let rot: [number, number] = [...HOME];
let k = 1;
let W = 0;
let H = 0;
let R = 100;
let cx = 0;
let cy = 0;
let tcx = 0;
let tcy = 0;
let dpr = 1;
let settle = 60;
let spin = true;
let dragging = false;
let moved = false;
let lastFrame = 0;
let raf = 0;
let reduced = false;
let fly: { t0: number; dur: number; r0: [number, number]; dr: [number, number]; k0: number; k1: number } | null = null;
let colours: Record<string, string> = {};
const kick = (n = 60) => (settle = Math.max(settle, n));
const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

function layout(snap = false) {
  if (!stage.value || !canvas.value) return;
  const r = stage.value.getBoundingClientRect();
  W = r.width;
  H = r.height;
  narrow.value = window.innerWidth <= 760;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.value.width = Math.round(W * dpr);
  canvas.value.height = Math.round(H * dpr);
  R = Math.max(60, Math.min(W, H) * 0.43);
  tcx = W / 2;
  tcy = H / 2;
  const p = panel.value?.getBoundingClientRect();
  if (narrow.value) tcy = p ? Math.max(90, Math.min(H, p.top - r.top) / 2) : H * 0.6;
  else if (p && W > 2 * p.width) tcx = (W - p.width - 12) / 2;
  if (snap || reduced) [cx, cy] = [tcx, tcy];
  kick();
}

function draw() {
  const ctx = canvas.value?.getContext("2d");
  if (!ctx) return;
  const r = R * k;
  const fc = isForecast.value;
  const c = colours;
  projection.rotate(rot).scale(r).translate([cx, cy]);
  const path = geoPath(projection, ctx);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.22);
  glow.addColorStop(0, fc ? c.yellow : c.pink);
  glow.addColorStop(1, "transparent");
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.22, 0, 6.2832);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = fc ? c.night : c.tile;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 6.2832);
  ctx.fill();
  ctx.beginPath();
  path(graticule);
  ctx.lineWidth = 0.6;
  ctx.globalAlpha = fc ? 0.3 : 0.12;
  ctx.strokeStyle = fc ? c.yellow : c.text;
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (land) {
    ctx.beginPath();
    path(land);
    if (fc) {
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = c.yellow;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeStyle = c.yellow;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = c.land;
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 0.7;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 6.2832);
  ctx.lineWidth = fc ? 2 : 1.5;
  if (fc) ctx.setLineDash([7, 6]);
  ctx.strokeStyle = fc ? c.yellow : c.edge;
  ctx.stroke();
  ctx.setLineDash([]);

  const centre: [number, number] = [-rot[0], -rot[1]];
  const vis: (Shown & { ax: number; ay: number; o: [number, number] })[] = [];
  for (const cand of candidates.value) {
    const place = cand.pin?.place ?? byPlace.value.get(cand.more!.place)![0].pin.place;
    const front = Math.cos(geoDistance([place.lng, place.lat], centre));
    if (front <= 0.03) continue;
    const [ax, ay] = projection([place.lng, place.lat])!;
    if (!offsets.has(cand.key)) {
      const a = offsets.size * 2.39996;
      offsets.set(cand.key, [Math.cos(a) * 10, Math.sin(a) * 10]);
    }
    vis.push({ ...cand, ax, ay, o: offsets.get(cand.key)!, x: 0, y: 0, scale: 0.55 + 0.45 * Math.min(1, front * 3) });
  }
  for (let it = 0; it < 3; it++)
    for (let i = 0; i < vis.length; i++)
      for (let j = i + 1; j < vis.length; j++) {
        const [a, b] = [vis[i], vis[j]];
        let dx = a.ax + a.o[0] - (b.ax + b.o[0]);
        let dy = a.ay + a.o[1] - (b.ay + b.o[1]);
        const min = (a.size * a.scale + b.size * b.scale) / 2 + 5;
        let d = Math.hypot(dx, dy);
        if (d >= min) continue;
        if (d < 0.01) [dx, dy, d] = [Math.cos(i * 2.39996), Math.sin(i * 2.39996), 1];
        const push = ((min - d) / 2) * 0.6;
        a.o[0] += (dx / d) * push;
        a.o[1] += (dy / d) * push;
        b.o[0] -= (dx / d) * push;
        b.o[1] -= (dy / d) * push;
      }
  for (const v of vis) {
    v.o[0] *= 0.965;
    v.o[1] *= 0.965;
    v.x = v.ax + v.o[0];
    v.y = v.ay + v.o[1];
    if (Math.hypot(v.o[0], v.o[1]) > 5) {
      ctx.beginPath();
      ctx.moveTo(v.ax, v.ay);
      ctx.lineTo(v.x, v.y);
      ctx.strokeStyle = fc ? c.yellow : c.text;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(v.ax, v.ay, 2, 0, 6.2832);
      ctx.fillStyle = fc ? c.yellow : c.lime;
      ctx.fill();
    }
  }
  shown.value = vis;
}

function frame(ts: number) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(50, ts - lastFrame);
  lastFrame = ts;
  let active = dragging;
  if (spin && !fly) {
    rot[0] += dt * 0.0035;
    active = true;
  }
  if (fly) {
    const u = Math.min(1, (ts - fly.t0) / fly.dur);
    const e = ease(Math.max(0, u));
    rot = [fly.r0[0] + fly.dr[0] * e, fly.r0[1] + fly.dr[1] * e];
    k = fly.k0 + (fly.k1 - fly.k0) * e;
    if (u >= 1) fly = null;
    active = true;
  }
  if (Math.abs(cx - tcx) > 0.5 || Math.abs(cy - tcy) > 0.5) {
    cx += (tcx - cx) * 0.16;
    cy += (tcy - cy) * 0.16;
    active = true;
  }
  zoomedIn.value = k >= 2.2;
  if (active) kick(45);
  if (settle-- > 0) draw();
}

function flyTo(to: [number, number], zoom: number, dur = 950) {
  spin = false;
  const dl = ((((to[0] - rot[0]) % 360) + 540) % 360) - 180;
  if (reduced) {
    rot = [rot[0] + dl, to[1]];
    k = zoom;
  } else fly = { t0: performance.now(), dur, r0: [...rot], dr: [dl, to[1] - rot[1]], k0: k, k1: zoom };
  kick();
}
const zoomBy = (f: number) => flyTo(rot, Math.max(0.8, Math.min(6, k * f)), 350);

const pointers = new Map<number, [number, number]>();
let pinch = { dist: 0, k: 1 };
let downAt: [number, number] = [0, 0];
function stageDown(ev: PointerEvent) {
  if ((ev.target as HTMLElement).closest("[data-ui]")) return;
  spin = false;
  pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (pointers.size === 1) {
    moved = false;
    downAt = [ev.clientX, ev.clientY];
  }
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    pinch = { dist: Math.hypot(a[0] - b[0], a[1] - b[1]), k };
    moved = true;
  }
}
function pointerMove(ev: PointerEvent) {
  if (scrubbing) return scrub(ev);
  const p = pointers.get(ev.pointerId);
  if (!p) return;
  const [dx, dy] = [ev.clientX - p[0], ev.clientY - p[1]];
  pointers.set(ev.pointerId, [ev.clientX, ev.clientY]);
  if (pointers.size === 2) {
    const [a, b] = [...pointers.values()];
    if (pinch.dist > 0) k = Math.max(0.8, Math.min(6, (pinch.k * Math.hypot(a[0] - b[0], a[1] - b[1])) / pinch.dist));
    fly = null;
    return kick();
  }
  if (!moved && Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]) < 6) return;
  moved = dragging = true;
  fly = null;
  const f = 180 / Math.PI / (R * k);
  rot = [rot[0] + dx * f, Math.max(-85, Math.min(85, rot[1] - dy * f))];
  kick();
}
function pointerUp(ev: PointerEvent) {
  scrubbing = false;
  if (!pointers.delete(ev.pointerId) || pointers.size) return;
  dragging = false;
  setTimeout(() => (moved = false), 0);
}
function wheel(ev: WheelEvent) {
  if ((ev.target as HTMLElement).closest("[data-ui]")) return;
  ev.preventDefault();
  spin = false;
  fly = null;
  k = Math.max(0.8, Math.min(6, k * Math.exp(-ev.deltaY * 0.0015)));
  kick();
}

function open(trend: Trend, pin?: Pin) {
  const at = pin ?? pins.value.find((p) => p.trend.id === trend.id && p.home);
  selected.value = { trend, pin: at };
  list.value = null;
  window.posthog?.capture("nerds_globe_trend_opened", { trend: trend.id, year: year.value, forecast: isForecast.value });
  if (at) flyTo([-at.place.lng, -at.place.lat], Math.max(k, 2.6));
}
function tapPin(s: Shown) {
  if (moved) return;
  if (s.pin) return open(s.pin.trend, s.pin);
  const group = byPlace.value.get(s.more!.place)!;
  selected.value = null;
  list.value = { title: `${s.more!.place}, ${year.value}`, trends: [...new Set(group.map((l) => l.pin.trend))] };
  const place = group[0].pin.place;
  flyTo([-place.lng, -place.lat], Math.max(k, 2.6));
}
function openEverywhere() {
  selected.value = null;
  list.value = { title: `Worn everywhere, ${year.value}`, trends: everywhere.value };
}
function close() {
  selected.value = null;
  list.value = null;
}
function escape(ev: KeyboardEvent) {
  if (ev.key === "Escape") close();
}

/* Detail panel. */
const detail = computed(() => {
  const s = selected.value;
  if (!s) return null;
  const f = forecastOf(s.trend);
  const lit = s.trend.periods.some((p) => p.start <= year.value && year.value <= p.end);
  const p = f?.status === "in" ? f.stillIn?.[year.value] : f?.status === "out" ? f.comebackBy?.[year.value] : undefined;
  const when = !isForecast.value
    ? `${lit ? "In" : "Not in"} fashion in ${year.value}.`
    : p === undefined
      ? `Forecast for ${year.value}: unknown.`
      : `${percent(p)} chance it is ${f!.status === "in" ? "still in" : "back"} by ${year.value}.`;
  const curve = s.trend.ngram?.["en-GB"] ?? [];
  const peak = Math.max(...curve, 0);
  const span = last.value + 1 - FROM;
  const x = (y: number) => ((y - FROM) / span) * 330;
  const area = peak > 0 ? `M0,50${curve.map((v, i) => `L${x(FROM + i + 0.5).toFixed(1)},${(50 - (v / peak) * 40).toFixed(1)}`).join("")}L${x(FROM + curve.length).toFixed(1)},50Z` : "";
  const waves = (f?.waves ?? []).map(([a, b]) => ({ x: x(a), w: Math.max(3, x(b + 1) - x(a)) }));
  const rows = f && f.status !== "unknown" ? (forecasts.value?.meta.horizon ?? []).map((y) => ({ y, p: (f.status === "in" ? f.stillIn : f.comebackBy)?.[y] ?? 0 })) : [];
  return { ...s, f, when, area, waves, rows, x, source: s.trend.sources[0], example: s.trend.examples[0], img: broken.value.has(s.trend.id) ? null : thumb(s.trend, 400) };
});

watch([candidates, isForecast], () => kick(90));
watch(year, (y) => emit("year", y));
watch(selected, (s) => emit("trend", s?.trend.id ?? null));
watch([selected, list], () => requestAnimationFrame(() => layout()), { flush: "post" });
watch(
  () => [props.focusTrend, props.focusYear, data.value] as const,
  ([id, y]) => {
    if (!data.value) return;
    const trend = id && id !== selected.value?.trend.id ? data.value.trends.find((t) => t.id === id) : null;
    const debut = trend && pins.value.find((p) => p.trend.id === trend.id && p.home)?.spans[0][0];
    if (y ?? debut) setYear((y ?? debut)!);
    if (trend) open(trend);
  },
);

onMounted(async () => {
  reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  spin = !reduced;
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(`--color-${name}`).trim();
  colours = { night: token("nof-night"), tile: token("nof-raised"), land: token("nof-line"), edge: token("nof-muted"), text: token("nof-text"), lime: token("nof-pink"), pink: token("nof-pink"), yellow: token("nof-gold") };
  layout(true);
  window.addEventListener("resize", onResize);
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);
  window.addEventListener("pointercancel", pointerUp);
  window.addEventListener("keydown", escape);
  raf = requestAnimationFrame(frame);
  const json = (name: string) => fetch(`/nerds-of-fashion/${name}.json`).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  json("land-110m").then((j) => ((land = j), kick()), () => kick());
  try {
    [data.value, forecasts.value] = await Promise.all([props.dataset ?? json("fashion"), json("forecast")]);
  } catch {
    failed.value = true;
  }
});
const onResize = () => layout(true);
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  clearTimeout(timer);
  window.removeEventListener("resize", onResize);
  window.removeEventListener("pointermove", pointerMove);
  window.removeEventListener("pointerup", pointerUp);
  window.removeEventListener("pointercancel", pointerUp);
  window.removeEventListener("keydown", escape);
});
</script>

<template>
  <div class="flex h-full flex-col bg-nof-night text-nof-text">
    <div ref="stage" class="relative min-h-0 flex-1 touch-none overflow-hidden select-none" :class="dragging ? 'cursor-grabbing' : 'cursor-grab'" @pointerdown="stageDown" @wheel="wheel">
      <canvas ref="canvas" class="absolute inset-0 size-full" aria-hidden="true"></canvas>

      <button
        v-for="s in shown"
        :key="s.key"
        type="button"
        class="absolute top-0 left-0 grid cursor-pointer place-items-center overflow-hidden rounded-full border-2 p-0 text-[11px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nof-pink"
        :class="[
          s.more ? 'border-nof-line bg-nof-panel text-nof-text' : s.state.kind === 'in' ? 'border-nof-pink bg-nof-panel text-nof-text' : 'border-dashed border-nof-gold bg-nof-night text-nof-gold',
          selected?.pin?.key === s.key && 'ring-4 ring-nof-text',
        ]"
        :style="{ width: `${s.size}px`, height: `${s.size}px`, transform: `translate(${s.x - s.size / 2}px, ${s.y - s.size / 2}px) scale(${s.scale})` }"
        :aria-label="s.label"
        :title="s.label"
        @click.stop="tapPin(s)"
      >
        <template v-if="s.more">+{{ s.more.count }}</template>
        <template v-else-if="s.state.kind === 'unknown'">?</template>
        <img v-else-if="s.img" :src="s.img" alt="" loading="lazy" draggable="false" class="size-full object-cover" :class="isForecast && 'opacity-70'" @error="broken = new Set(broken).add(s.pin!.trend.id)" />
        <template v-else>{{ monogram(s.pin!.trend.name) }}</template>
      </button>

      <div class="pointer-events-none absolute top-4 left-4 max-w-[70%] sm:max-w-sm" :class="narrow && (detail || list) && '[&>*:not(:first-child)]:hidden'" aria-live="polite">
        <div class="text-5xl leading-none font-bold tabular-nums sm:text-7xl" :class="isForecast && 'text-nof-gold'">{{ year }}</div>
        <div class="mt-1 text-lg font-semibold sm:text-xl">{{ era.name }}</div>
        <p class="m-0 mt-1 hidden text-xs text-nof-sub sm:block sm:text-sm">{{ era.line }}</p>
        <p v-if="failed" class="m-0 mt-2 text-xs text-nof-gold">The data did not load. Give it a refresh.</p>
        <p v-else-if="!data" class="m-0 mt-2 text-xs text-nof-muted">Fetching a century of clothes…</p>
        <p v-else-if="isForecast" class="m-0 mt-2 text-xs text-nof-gold">
          Guesses, not history. {{ counts.still }} probably still in, {{ counts.back }} with a 10%+ shot at a comeback, {{ counts.unknown }} unknown.
        </p>
        <p v-else class="pointer-events-auto m-0 mt-2 text-xs text-nof-muted" data-ui>
          {{ counts.in }} looks pinned to a country.
          <button v-if="everywhere.length" type="button" class="cursor-pointer border-0 bg-transparent p-0 text-nof-pink underline" @click="openEverywhere">Plus {{ everywhere.length }} worn everywhere</button>
        </p>
      </div>

      <div class="absolute right-3 bottom-3 flex flex-col gap-1" data-ui>
        <button type="button" class="size-9 cursor-pointer rounded-full border border-nof-line bg-nof-panel text-nof-text" aria-label="Zoom in" @click="zoomBy(1.6)">+</button>
        <button type="button" class="size-9 cursor-pointer rounded-full border border-nof-line bg-nof-panel text-nof-text" aria-label="Zoom out" @click="zoomBy(1 / 1.6)">−</button>
        <button type="button" class="size-9 cursor-pointer rounded-full border border-nof-line bg-nof-panel text-nof-text" aria-label="Reset the globe" @click="flyTo(HOME, 1, 700)">⟲</button>
      </div>

      <aside
        v-if="detail || list"
        ref="panel"
        data-ui
        class="absolute inset-x-0 bottom-0 max-h-[58%] cursor-auto overflow-y-auto rounded-t-2xl border border-nof-line bg-nof-panel p-4 select-text sm:inset-x-auto sm:top-3 sm:right-3 sm:bottom-3 sm:max-h-none sm:w-[360px] sm:rounded-2xl"
        :aria-label="detail ? 'Trend details' : 'Trends'"
      >
        <button type="button" class="float-right size-8 cursor-pointer rounded-full border border-nof-line bg-nof-night text-nof-text" aria-label="Close" @click="close">✕</button>

        <template v-if="detail">
          <div class="flex items-center gap-3">
            <div class="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-nof-pink bg-nof-night text-xl font-bold">
              <img v-if="detail.img" :src="detail.img" :alt="detail.example?.title ?? detail.trend.name" class="size-full object-cover" @error="broken = new Set(broken).add(detail.trend.id)" />
              <template v-else>{{ monogram(detail.trend.name) }}</template>
            </div>
            <div class="min-w-0">
              <h2 class="m-0 text-xl leading-tight font-bold">{{ detail.trend.name }}</h2>
              <p class="m-0 mt-1 text-xs text-nof-muted">{{ detail.trend.category }}<template v-if="detail.pin"> · {{ detail.pin.place.name }}</template></p>
            </div>
          </div>
          <p class="mt-3 mb-0 text-sm font-semibold" :class="isForecast ? 'text-nof-gold' : 'text-nof-pink'">{{ detail.when }}</p>
          <p class="mt-2 mb-0 text-sm text-nof-sub">{{ detail.trend.description }}</p>
          <blockquote v-if="detail.source" class="mx-0 mt-3 mb-0 border-0 border-l-2 border-nof-line pl-3 text-xs text-nof-sub">
            “{{ detail.source.quote }}”
            <a :href="detail.source.url" target="_blank" rel="noopener" class="mt-1 block text-nof-pink">Read “{{ detail.source.article }}” on Wikipedia ↗</a>
          </blockquote>
          <p v-if="detail.img && detail.example" class="mt-2 mb-0 text-[11px] text-nof-muted">
            Picture: <a :href="detail.example.url" target="_blank" rel="noopener" class="text-nof-sub">{{ detail.example.title }}, {{ detail.example.year }}</a>. © Victoria and Albert Museum, London.
          </p>

          <h3 class="mt-4 mb-1 text-sm font-semibold">{{ detail.waves.length }} {{ detail.waves.length === 1 ? "wave" : "waves" }} so far</h3>
          <svg viewBox="0 0 330 78" role="img" :aria-label="`Waves of ${detail.trend.name} from 1920 to now`" class="w-full">
            <path v-if="detail.area" :d="detail.area" class="fill-nof-line stroke-nof-muted" stroke-width="1" />
            <rect :x="detail.x(now + 1)" y="2" :width="330 - detail.x(now + 1)" height="56" rx="3" class="fill-transparent stroke-nof-gold" stroke-dasharray="3 3" />
            <line x1="0" x2="330" y1="50" y2="50" class="stroke-nof-line" />
            <rect v-for="(w, i) in detail.waves" :key="i" :x="w.x" y="44" :width="w.w" height="12" rx="4" class="fill-nof-pink" />
            <line :x1="detail.x(year + 0.5)" :x2="detail.x(year + 0.5)" y1="0" y2="60" class="stroke-nof-text" stroke-width="1.5" />
            <text v-for="y in [1920, 1945, 1970, 1995]" :key="y" :x="detail.x(y)" y="74" class="fill-nof-muted text-[10px]">{{ y }}</text>
            <text x="330" y="74" text-anchor="end" class="fill-nof-gold text-[10px]">forecast</text>
          </svg>
          <p class="m-0 text-[11px] text-nof-muted">Blocks are the years it was in. The faint curve is how much British books went on about it, which usually runs late.</p>

          <h3 class="mt-4 mb-1 text-sm font-semibold">Forecast, {{ now + 1 }} to {{ last }}</h3>
          <div class="rounded-xl border border-dashed border-nof-gold p-3">
            <template v-if="!detail.f || detail.f.status === 'unknown'">
              <div class="text-lg font-bold text-nof-gold">Unknown</div>
              <p class="m-0 mt-1 text-xs text-nof-sub">Only one recorded wave, so there is no gap to learn a cycle from. No number, no pretending.</p>
            </template>
            <template v-else>
              <div class="text-xs font-semibold">{{ detail.f.status === "in" ? "In right now. Chance it is still in:" : "Out right now. Chance it has come back:" }}</div>
              <div v-for="r in detail.rows" :key="r.y" class="mt-2 grid grid-cols-[3.5rem_1fr_2.5rem] items-center gap-2 text-xs tabular-nums">
                <span>{{ detail.f.status === "in" ? "" : "by " }}{{ r.y }}</span>
                <span class="h-2 overflow-hidden rounded-full bg-nof-night"><i class="block h-full bg-nof-gold" :style="{ width: `${Math.max(1, r.p * 100)}%` }"></i></span>
                <b class="text-right">{{ percent(r.p) }}</b>
              </div>
              <p class="m-0 mt-2 text-[11px] text-nof-sub">
                Its waves usually sit about {{ detail.f.typicalGap }} years apart<template v-if="detail.f.medianReturn">, so the best guess for a return is around {{ detail.f.medianReturn }}</template>.
              </p>
            </template>
            <p v-if="forecasts" class="m-0 mt-2 text-[11px] text-nof-muted">
              Pinch of salt: tested on the past, this guess picks the real comeback {{ Math.round(forecasts.meta.backtest.auc * 100) }}% of the time, where a coin toss gets 50%.
            </p>
          </div>
        </template>

        <template v-else-if="list">
          <h2 class="m-0 text-lg font-bold">{{ list.title }}</h2>
          <p class="m-0 mt-1 text-xs text-nof-muted">{{ list.trends.length }} looks. Tap one for the full story.</p>
          <ul class="m-0 mt-3 flex list-none flex-col gap-1 p-0">
            <li v-for="t in list.trends" :key="t.id">
              <button type="button" class="flex w-full cursor-pointer items-baseline justify-between gap-3 rounded-lg border border-nof-line bg-nof-night px-3 py-2 text-left text-sm text-nof-text hover:border-nof-pink" @click="open(t)">
                <span>{{ t.name }}</span><span class="shrink-0 text-[11px] text-nof-muted">{{ t.category }}</span>
              </button>
            </li>
          </ul>
        </template>
      </aside>
    </div>

    <div class="border-t border-nof-line bg-nof-panel px-4 pt-3 pb-4" data-ui>
      <div class="flex items-center gap-2">
        <button type="button" class="size-10 cursor-pointer rounded-full border-0 bg-nof-pink font-bold text-nof-pink-ink hover:bg-nof-pink" :aria-label="playing ? 'Pause' : 'Play through the years'" @click="togglePlay">{{ playing ? "❚❚" : "▶" }}</button>
        <button type="button" class="size-9 cursor-pointer rounded-full border border-nof-line bg-nof-night text-nof-text" aria-label="Back one year" @click="(stop(), setYear(year - 1))">‹</button>
        <button type="button" class="size-9 cursor-pointer rounded-full border border-nof-line bg-nof-night text-nof-text" aria-label="Forward one year" @click="(stop(), setYear(year + 1))">›</button>
        <span class="min-w-0 text-[11px] text-nof-muted">
          {{ isForecast ? "Dashed means guessed. Bigger means likelier. A ? means unknown." : "Lit pictures were in fashion that year. Drag the globe, tap a picture." }}
        </span>
      </div>
      <div
        ref="track"
        class="relative mt-3 h-14 cursor-ew-resize touch-none rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-nof-pink"
        role="slider"
        tabindex="0"
        aria-label="Year"
        :aria-valuemin="FROM"
        :aria-valuemax="last"
        :aria-valuenow="year"
        :aria-valuetext="`${year}, ${era.name}${isForecast ? ' (forecast)' : ''}`"
        @pointerdown="trackDown"
        @keydown="trackKey"
      >
        <div class="absolute inset-x-0 top-0 h-8">
          <i
            v-for="b in bars"
            :key="b.y"
            class="absolute bottom-0 block"
            :class="b.y > now ? 'bg-nof-gold' : b.y % 10 === 0 ? 'bg-nof-text' : 'bg-nof-muted'"
            :style="{ left: `${xOf(b.y)}%`, width: `${((b.y > now ? stretch : 1) / total) * 76}%`, height: `${b.h}%`, transform: 'translateX(-50%)' }"
          ></i>
        </div>
        <div class="absolute inset-x-0 top-8 h-px bg-nof-line"></div>
        <div class="absolute top-0 h-8 rounded-sm border border-dashed border-nof-gold" :style="{ left: `${(history / total) * 100}%`, right: 0 }"></div>
        <span v-for="t in ticks" :key="t.y" class="absolute top-9 -translate-x-1/2 text-[10px] tabular-nums" :class="t.future ? 'text-nof-gold' : 'text-nof-muted'" :style="{ left: `${xOf(t.y)}%` }">{{ t.label }}</span>
        <div class="absolute top-0 h-8 w-0.5 -translate-x-1/2" :class="isForecast ? 'bg-nof-gold' : 'bg-nof-pink'" :style="{ left: `${xOf(year)}%` }">
          <b class="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full rounded px-1.5 text-[11px] tabular-nums" :class="isForecast ? 'bg-nof-gold text-nof-night' : 'bg-nof-pink text-nof-pink-ink'">{{ year }}</b>
        </div>
      </div>
    </div>
  </div>
</template>
