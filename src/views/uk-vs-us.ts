// Britain vs America in print: small multiples of the trends whose British and American
// book curves disagree the most, each scaled to its own peak.

import { clamp, type Trend } from "../data";
import { disagreement } from "../forecast";
import type { View } from "../view";
import { el, legend, pct, trendPicker } from "../viewkit";

const SVG = "http://www.w3.org/2000/svg";
const TOP = 6;
const HEIGHT = 100;

function svg(tag: string, attrs: Record<string, string | number>) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

interface Pair {
  trend: Trend;
  uk: number[];
  us: number[];
  ukPeak: number;
  usPeak: number;
  score: number;
}

const view: View = {
  id: "uk-vs-us",
  tab: "words",
  title: "Britain vs America, in print",
  blurb: "The looks British and American books can't agree on, starting with when",
  how: "Slide across a chart to read any year. Tap one to keep it, or pick any trend to see how its two curves compare.",
  sources: ["ngram", "wikipedia"],
  order: 3,
  mount(host, context) {
    const { nerds } = context;
    const { from, to } = nerds.data.series.ngramYears;
    const pairs: Pair[] = nerds.trends
      .filter((trend) => (["en-GB", "en-US"] as const).every((corpus) => trend.ngram?.[corpus]?.some((value) => value > 0)))
      .map((trend) => {
        const uk = nerds.shape(trend, "en-GB")!;
        const us = nerds.shape(trend, "en-US")!;
        return { trend, uk, us, ukPeak: from + uk.indexOf(Math.max(...uk)), usPeak: from + us.indexOf(Math.max(...us)), score: disagreement(uk, us) };
      })
      .sort((a, b) => b.score - a.score);
    const count = context.compact ? 4 : TOP;
    let focus: string | undefined;

    const root = el("div", "flex flex-col gap-5 font-nof-body text-nof-text");
    host.append(root);
    const worst = pairs[0];
    if (worst)
      root.append(
        el(
          "p",
          "max-w-3xl font-nof-display text-[22px] leading-snug font-bold sm:text-[26px]",
          `Britain and America can't agree on ${worst.trend.name.toLowerCase()}: British books peak in ${worst.ukPeak}, American ones in ${worst.usPeak}${worst.ukPeak === worst.usPeak ? ", and the shapes still don't match." : "."}`,
        ),
      );
    root.append(
      legend([
        ["w-5 border-t-2 border-nof-clothes", "British books"],
        ["w-5 border-t-2 border-nof-scenes", "American books"],
        ["h-2.5 w-2.5 rounded-sm bg-nof-line", "years it was actually worn"],
      ]),
    );
    const grid = el("div", "grid grid-cols-2 gap-3 sm:grid-cols-3");
    const picker = trendPicker(pairs.map((pair) => pair.trend), "Put any trend in the dock", `The ${count} biggest rows`);
    const missing = el("p", "text-[14px] text-nof-sub");
    root.append(grid);
    if (!context.compact)
      root.append(
        picker.field,
        missing,
        el(
          "p",
          "max-w-3xl text-[12px] leading-relaxed text-nof-muted",
          `Each line is scaled to its own peak, so compare the shapes and the timing, never the heights. The curves stop in ${to}. Ranked by the average distance between the two lines across ${pairs.length} trends with both curves. A big row is often one word doing two jobs on one side of the Atlantic, so check before you blame the Americans.`,
        ),
      );

    const tile = (pair: Pair) => {
      const on = pair.trend.id === focus;
      const box = el("button", `flex min-w-0 flex-col gap-1 rounded-xl border bg-nof-panel p-3 text-left transition-colors hover:border-nof-muted ${on ? "border-nof-pink" : "border-nof-line"}`);
      box.type = "button";
      box.setAttribute("aria-pressed", String(on));
      const resting = `UK peak ${pair.ukPeak} · US peak ${pair.usPeak}`;
      const readout = el("span", "min-h-8 font-mono text-[11px] leading-snug text-nof-muted", resting);
      const last = pair.uk.length - 1;
      const chart = svg("svg", { viewBox: `0 0 ${last} ${HEIGHT}`, preserveAspectRatio: "none", role: "img", "aria-label": `${pair.trend.name}: mentions in British and American books, ${from} to ${to}. ${resting}.`, class: "block h-24 w-full touch-pan-y" });
      for (const period of pair.trend.periods) {
        const start = clamp(period.start, from, to);
        const end = clamp(period.end + 1, from, to);
        if (end > start) chart.append(svg("rect", { x: start - from, y: 0, width: end - start, height: HEIGHT, class: "fill-nof-line" }));
      }
      const line = (curve: number[], colour: string) =>
        svg("polyline", { points: curve.map((value, i) => `${i},${(HEIGHT - 4 - value * (HEIGHT - 8)).toFixed(1)}`).join(" "), fill: "none", "stroke-width": 2, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke", class: colour });
      const cross = svg("line", { y1: 0, y2: HEIGHT, "stroke-width": 1, "vector-effect": "non-scaling-stroke", class: "hidden stroke-nof-text" });
      chart.append(line(pair.us, "stroke-nof-scenes"), line(pair.uk, "stroke-nof-clothes"), cross);
      chart.addEventListener("pointermove", (event) => {
        const rect = chart.getBoundingClientRect();
        const i = clamp(Math.round(((event.clientX - rect.left) / rect.width) * last), 0, last);
        cross.setAttribute("x1", String(i));
        cross.setAttribute("x2", String(i));
        cross.classList.remove("hidden");
        readout.textContent = `${from + i}: UK at ${pct(pair.uk[i])} of its peak, US at ${pct(pair.us[i])}`;
      });
      chart.addEventListener("pointerleave", () => {
        cross.classList.add("hidden");
        readout.textContent = resting;
      });
      const axis = el("span", "flex justify-between font-mono text-[10px] text-nof-muted");
      axis.append(el("span", "", `${from}`), el("span", "", `${to}`));
      box.append(el("span", "truncate text-[14px] font-semibold text-nof-text", pair.trend.name), chart, axis, readout);
      box.addEventListener("click", () => {
        context.setParam("trend", pair.trend.id);
        pick(pair.trend.id);
      });
      return box;
    };

    const pick = (id: string | undefined) => {
      const pair = pairs.find((candidate) => candidate.trend.id === id);
      focus = pair?.trend.id;
      picker.select.value = focus ?? "";
      const named = id ? nerds.byId.get(id) : undefined;
      missing.textContent = named && !pair ? `${named.name} doesn't have a book curve on both sides of the Atlantic, so here are the biggest rows instead.` : "";
      const top = pairs.slice(0, count);
      const shown = pair && !top.includes(pair) ? [pair, ...top.slice(0, count - 1)] : top;
      grid.replaceChildren(...(shown.length ? shown.map(tile) : [el("p", "col-span-full py-10 text-center text-nof-muted", "No trend has a book curve in both countries. The Atlantic wins.")]));
    };
    const onChange = () => {
      context.setParam("trend", picker.select.value || null);
      pick(picker.select.value);
    };
    picker.select.addEventListener("change", onChange);
    pick(context.params.trend);

    return {
      update: (params) => pick(params.trend),
      destroy() {
        picker.select.removeEventListener("change", onChange);
        root.remove();
      },
    };
  },
};

export default view;
