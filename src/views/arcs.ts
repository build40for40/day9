import { FAMILIES, FIRST_YEAR, NOW_YEAR, familyOf, token, type Family, type Nerds } from "../data";
import { escapeHtml, tip } from "../tip";
import type { View } from "../view";

const SVG = "http://www.w3.org/2000/svg";
const svgEl = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}) => {
  const el = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
};
const END = 2045;

interface Arc {
  name: string;
  from: number;
  to: number;
  family: Family | "era";
  quote?: string;
  article?: string;
  forecast?: number;
}

/** Famous trends that have been out long enough to be due, with real odds from the gap distribution. */
function forecasts(nerds: Nerds, median: number) {
  return nerds.trends
    .filter((t) => nerds.ubiquity(t) < 0.4)
    .map((t) => {
      let last = 0;
      for (let y = FIRST_YEAR; y <= NOW_YEAR; y++) if (nerds.presence(t, y) > 0.55) last = y;
      const since = NOW_YEAR - last;
      return { t, last, since, odds: nerds.comebackOdds(since, 10) };
    })
    .filter((f) => f.last && f.since >= 15 && f.since <= 45 && f.odds > 0)
    .sort((a, b) => b.odds * nerds.fame(b.t) - a.odds * nerds.fame(a.t))
    .slice(0, 3)
    .map((f) => ({ ...f, due: Math.min(END - 1, Math.max(NOW_YEAR + 2, f.last + median)) }));
}

const view: View = {
  id: "arcs",
  tab: "comebacks",
  order: 0,
  title: "Everything Comes Back",
  blurb: "Every arc leaps from a trend's first run to its comeback. The taller the arc, the longer it hid in the loft",
  how: "Hover or tap an arc to see which trend came back and how long it waited. Dashed arcs are our guesses.",
  sources: ["wikipedia"],
  mount(el, { nerds, born }) {
    const stats = nerds.gapStats();
    const sorted = stats.gaps;
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    // One arc per comeback: from the start of a trend's wave to the start of its next one.
    const real: Arc[] = nerds
      .waits()
      .filter((w) => w.gap > 0 && w.from >= FIRST_YEAR)
      .map((w) => {
        const trend = nerds.byId.get(w.trend);
        return { name: w.subject, from: w.from, to: w.to, family: trend ? familyOf(trend.category) : "era" };
      });
    const due = forecasts(nerds, Math.round(stats.median));
    const guessed: Arc[] = due.map((f) => ({ name: f.t.name, from: f.last, to: f.due, family: familyOf(f.t.category), forecast: f.odds }));
    const colour = (family: Arc["family"]) => (family === "era" ? token("--color-nof-gold") : token(FAMILIES[family].token));

    const wrap = document.createElement("div");
    wrap.className = "relative px-3 pt-4 pb-5 sm:px-6";
    const legend = document.createElement("div");
    legend.className = "mb-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-nof-muted";
    for (const f of Object.keys(FAMILIES) as Family[]) legend.insertAdjacentHTML("beforeend", `<span class="inline-flex items-center gap-1.5"><i class="inline-block size-2.5 rounded-full" style="background:var(${FAMILIES[f].token})"></i>${FAMILIES[f].label}</span>`);
    legend.insertAdjacentHTML("beforeend", `<span class="inline-flex items-center gap-1.5"><i class="inline-block h-0 w-4 border-t-2 border-dashed border-nof-text"></i>Our forecast</span>`);
    const box = document.createElement("div");
    box.className = "relative";
    const cards = document.createElement("div");
    cards.className = "mt-6 grid gap-3 sm:grid-cols-3";
    for (const f of due) {
      const pct = Math.round(f.odds * 100);
      cards.insertAdjacentHTML(
        "beforeend",
        `<div class="rounded-2xl border border-nof-line bg-nof-night p-4"><p class="font-nof-display text-5xl font-black text-nof-pink">${pct}%</p><p class="mt-1 text-lg font-semibold text-nof-text">${escapeHtml(f.t.name)}</p><p class="text-sm text-nof-muted">Last on in ${f.last}. Odds it's back within ten years${born ? `, about when you're ${f.due - born}` : ""}.</p><div class="mt-3 h-1.5 overflow-hidden rounded-full bg-nof-line"><i class="block h-full rounded-full bg-nof-pink" style="width:${pct}%"></i></div></div>`,
      );
    }
    wrap.append(legend, box, cards);
    el.append(wrap);
    const hover = tip(box);
    let svg: SVGSVGElement | undefined;

    const draw = () => {
      svg?.remove();
      const W = box.clientWidth || 800;
      const H = Math.max(300, Math.min(500, W * 0.5));
      const m = { t: 22, r: 8, b: 30, l: 8 };
      const base = H - m.b;
      svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Arcs linking ${real.length} trends to their comebacks, with ${guessed.length} forecast comebacks after ${NOW_YEAR}` });
      svg.classList.add("block", "w-full", "h-auto");
      const x = (year: number) => m.l + ((year - FIRST_YEAR) / (END - FIRST_YEAR)) * (W - m.l - m.r);
      const maxGap = Math.max(...real.map((a) => a.to - a.from), ...guessed.map((a) => a.to - a.from));
      const lift = (gap: number) => (gap / maxGap) * (base - m.t) * 0.75;
      const muted = token("--color-nof-muted", "#a39fae");
      const line = token("--color-nof-line", "#302c3a");
      const text = token("--color-nof-text", "#f2eee6");
      const sub = token("--color-nof-sub", "#cfc9d6");

      // The future, shaded.
      svg.append(svgEl("rect", { x: x(NOW_YEAR), y: m.t - 14, width: x(END) - x(NOW_YEAR), height: base - m.t + 14, fill: line, opacity: 0.35 }));
      const future = svgEl("text", { x: x(NOW_YEAR) + 6, y: m.t, fill: muted, "font-size": 11, "font-family": "JetBrains Mono, monospace" });
      future.textContent = "the future";
      svg.append(future);
      // The middle half of all real gaps, as a height band.
      const bandTop = base - lift(q3);
      svg.append(svgEl("rect", { x: m.l, y: bandTop, width: W - m.l - m.r, height: lift(q3) - lift(q1), fill: token("--color-nof-pink"), opacity: 0.07 }));
      const band = svgEl("text", { x: m.l + 4, y: bandTop - 6, fill: sub, stroke: token("--color-nof-panel"), "stroke-width": 4, "paint-order": "stroke", "font-size": 11, "font-family": "JetBrains Mono, monospace" });
      band.textContent = `half of all comebacks take ${q1} to ${q3} years · typical ${stats.median}`;
      svg.append(band);
      svg.append(svgEl("line", { x1: m.l, x2: W - m.r, y1: base, y2: base, stroke: line }));
      const step = W < 520 ? 25 : 10;
      for (let year = 1930; year <= END; year += step) {
        const label = svgEl("text", { x: x(year), y: H - 8, "text-anchor": "middle", fill: muted, "font-size": 11, "font-family": "JetBrains Mono, monospace" });
        label.textContent = String(year);
        svg.append(label);
      }
      if (born && born >= FIRST_YEAR) {
        svg.append(svgEl("line", { x1: x(born), x2: x(born), y1: m.t, y2: base, stroke: text, "stroke-dasharray": "2 4", opacity: 0.6 }));
        const you = svgEl("text", { x: x(born) + 4, y: base - 6, fill: text, "font-size": 11, "font-family": "JetBrains Mono, monospace" });
        you.textContent = "you";
        svg.append(you);
      }

      const path = (a: Arc) => {
        const x1 = x(a.from);
        const x2 = x(a.to);
        const h = lift(a.to - a.from) * 1.33;
        return `M${x1},${base} C${x1},${base - h} ${x2},${base - h} ${x2},${base}`;
      };
      const strokes: SVGPathElement[] = [];
      const all = [...real, ...guessed];
      for (const a of all) {
        const p = svgEl("path", { d: path(a), fill: "none", stroke: colour(a.family), "stroke-width": a.forecast ? 2.4 : 1.2, opacity: a.forecast ? 0.95 : 0.28, "stroke-dasharray": a.forecast ? "6 6" : "", "stroke-linecap": "round" });
        p.style.transition = "opacity .15s";
        strokes.push(p);
        svg.append(p);
      }
      // Fat invisible copies to make thin arcs easy to hover and tap.
      all.forEach((a, i) => {
        const hit = svgEl("path", { d: path(a), fill: "none", stroke: "transparent", "stroke-width": 12 });
        hit.style.cursor = "pointer";
        const on = (event: PointerEvent) => {
          strokes.forEach((s, k) => (s.style.opacity = k === i ? "1" : "0.12"));
          strokes[i].setAttribute("stroke-width", "3.5");
          const head = `<b class="block font-nof-display text-lg italic text-nof-text">${escapeHtml(a.name)}</b>`;
          hover.show(
            event,
            a.forecast
              ? `${head}<span class="font-mono text-[11px] text-nof-muted">last on ${a.from} · due around ${a.to}</span><span class="mt-1 block">${Math.round(a.forecast * 100)}% chance it's back within ten years, going by every comeback we've counted.</span>`
              : `${head}<span class="font-mono text-[11px] text-nof-muted">on in ${a.from}, back in ${a.to} · ${a.to - a.from} years in the loft</span>`,
          );
        };
        hit.addEventListener("pointermove", on);
        hit.addEventListener("pointerdown", on);
        hit.addEventListener("pointerleave", () => {
          strokes.forEach((s, k) => {
            s.style.opacity = "";
            s.setAttribute("stroke-width", all[k].forecast ? "2.4" : "1.2");
          });
          hover.hide();
        });
        svg!.append(hit);
      });
      guessed.forEach((a, i) => {
        svg!.append(svgEl("circle", { cx: x(a.to), cy: base, r: 5, fill: token("--color-nof-panel"), stroke: colour(a.family), "stroke-width": 2 }));
        const label = svgEl("text", { x: Math.min(W - m.r - 4, x(a.to) + 8), y: base - lift(a.to - a.from) - 8 - i * 15, "text-anchor": "end", stroke: token("--color-nof-panel"), "stroke-width": 4, "paint-order": "stroke", fill: text, "font-size": 11, "font-weight": 600, "font-family": "Instrument Sans, sans-serif" });
        label.textContent = a.name;
        svg!.append(label);
      });
      box.prepend(svg);
    };
    draw();
    let lastWidth = box.clientWidth;
    const resizer = new ResizeObserver(() => {
      if (box.clientWidth === lastWidth) return;
      lastWidth = box.clientWidth;
      draw();
    });
    resizer.observe(box);
    return {
      destroy() {
        resizer.disconnect();
        wrap.remove();
      },
    };
  },
};

export default view;
