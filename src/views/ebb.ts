import { area, curveBasis, stack, stackOffsetWiggle, stackOrderInsideOut } from "d3-shape";
import { FAMILIES, FIRST_YEAR, NOW_YEAR, familyOf, token, years, type Nerds, type Trend } from "../data";
import { escapeHtml, tip } from "../tip";
import type { View } from "../view";

const SVG = "http://www.w3.org/2000/svg";
const svgEl = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number> = {}) => {
  const el = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
  return el;
};

/** About two defining trends per decade, so the river reads as the whole century without turning to soup. */
function pick(nerds: Nerds, count = 22) {
  const chosen: Trend[] = [];
  for (let decade = 1920; decade <= 2020 && chosen.length < count; decade += 10) {
    const mid = decade + 5;
    const ranked = nerds.trends
      .filter((t) => !chosen.includes(t) && nerds.ubiquity(t) < 0.45)
      .map((t) => ({ t, score: Math.max(nerds.presence(t, mid - 3), nerds.presence(t, mid), nerds.presence(t, mid + 3)) * nerds.fame(t) }))
      .sort((a, b) => b.score - a.score);
    for (const { t } of ranked.slice(0, 2)) chosen.push(t);
  }
  return chosen;
}

function smooth(values: number[], width = 2.2) {
  return values.map((_, i) => {
    let sum = 0;
    let weight = 0;
    for (let k = -6; k <= 6; k++) {
      const v = values[i + k];
      if (v === undefined) continue;
      const g = Math.exp(-0.5 * (k / width) ** 2);
      sum += v * g;
      weight += g;
    }
    return sum / weight;
  });
}

const view: View = {
  id: "ebb",
  tab: "trends",
  order: 4,
  title: "The Ebb and Flow of Fashion",
  blurb: "Every trend is a ribbon that swells while it's worn and thins when everyone moves on",
  how: "Hover or tap a ribbon to see when it was in and what Wikipedia says about it.",
  sources: ["wikipedia"],
  mount(el, { nerds }) {
    const trends = pick(nerds);
    const span = years(FIRST_YEAR, NOW_YEAR);
    const curves = trends.map((t) => smooth(span.map((y) => nerds.presence(t, y))).map((v) => v * (1 + nerds.fame(t) / 14) + 0.01));
    const rows = span.map((_, i) => Object.fromEntries(trends.map((t, k) => [t.id, curves[k][i]])));
    const series = stack<Record<string, number>>().keys(trends.map((t) => t.id)).offset(stackOffsetWiggle).order(stackOrderInsideOut)(rows);
    // Each ribbon is dyed the colour of the year it peaked, like the curtain.
    const peakYear = (k: number) => span[curves[k].indexOf(Math.max(...curves[k]))];
    const fills = trends.map((_, k) => nerds.colour(peakYear(k)));
    const ink = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
      return lum > 0.55;
    };

    const wrap = document.createElement("div");
    wrap.className = "relative px-3 pt-4 pb-3 sm:px-6";
    const legend = document.createElement("div");
    legend.className = "mb-3 font-mono text-[11px] text-nof-muted";
    legend.textContent = "Each ribbon is dyed the colour of the year it peaked. Thickness is how strongly it was in style.";
    const box = document.createElement("div");
    box.className = "relative";
    wrap.append(legend, box);
    el.append(wrap);
    const hover = tip(box);
    let svg: SVGSVGElement | undefined;

    const draw = () => {
      svg?.remove();
      const W = box.clientWidth || 800;
      const H = Math.max(320, Math.min(560, W * 0.55));
      const m = { t: 8, r: 4, b: 26, l: 4 };
      svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `Streamgraph of ${trends.length} defining trends from 1920 to 2026` });
      svg.classList.add("block", "w-full", "h-auto", "overflow-visible");
      const x = (year: number) => m.l + ((year - FIRST_YEAR) / (NOW_YEAR - FIRST_YEAR)) * (W - m.l - m.r);
      const lo = Math.min(...series.map((s) => Math.min(...s.map((d) => d[0]))));
      const hi = Math.max(...series.map((s) => Math.max(...s.map((d) => d[1]))));
      const y = (v: number) => H - m.b - ((v - lo) / (hi - lo)) * (H - m.t - m.b);
      const muted = token("--color-nof-muted", "#a39fae");
      const line = token("--color-nof-line", "#302c3a");
      const text = token("--color-nof-text", "#f2eee6");
      const night = token("--color-nof-night", "#0e0d12");
      const step = W < 520 ? 20 : 10;
      for (let d = 1920; d <= 2020; d += 10) {
        svg.append(svgEl("line", { x1: x(d), x2: x(d), y1: m.t, y2: H - m.b, stroke: line, "stroke-width": 1 }));
        if ((d - 1920) % step === 0) {
          const label = svgEl("text", { x: x(d), y: H - 6, "text-anchor": d === 1920 ? "start" : "middle", fill: muted, "font-size": 11, "font-family": "JetBrains Mono, monospace" });
          label.textContent = `${d}s`;
          svg.append(label);
        }
      }
      const shape = area<[number, number]>()
        .curve(curveBasis)
        .x((_, i) => x(span[i]))
        .y0((d) => y(d[0]))
        .y1((d) => y(d[1]));
      const paths: SVGPathElement[] = [];
      series.forEach((s, k) => {
        const trend = trends[k];
        const path = svgEl("path", { d: shape(s as unknown as [number, number][]) ?? "", fill: fills[k], stroke: night, "stroke-width": 1.2, opacity: 0.95 });
        path.style.transition = "opacity .2s";
        path.style.cursor = "pointer";
        const on = (event: PointerEvent) => {
          paths.forEach((p) => (p.style.opacity = p === path ? "1" : "0.25"));
          const periods = trend.periods.filter((p) => p.end >= FIRST_YEAR).map((p) => (p.start === p.end ? `${p.start}` : `${Math.max(p.start, FIRST_YEAR)} to ${p.end}`));
          const quote = trend.sources[0];
          hover.show(
            event,
            `<b class="block font-nof-display text-lg italic text-nof-text">${escapeHtml(trend.name)}</b><span class="font-mono text-[11px] text-nof-muted">${escapeHtml(FAMILIES[familyOf(trend.category)].label)} · in ${escapeHtml(periods.slice(0, 4).join(", "))}</span>${quote ? `<span class="mt-1 block">“${escapeHtml(quote.quote.length > 180 ? `${quote.quote.slice(0, 178)}…` : quote.quote)}”</span><span class="font-mono text-[10px] text-nof-muted">Wikipedia, CC BY-SA</span>` : ""}`,
          );
        };
        path.addEventListener("pointermove", on);
        path.addEventListener("pointerdown", on);
        path.addEventListener("pointerleave", () => {
          paths.forEach((p) => (p.style.opacity = "0.95"));
          hover.hide();
        });
        paths.push(path);
        svg!.append(path);
      });
      // Direct labels at each ribbon's fattest point, only where they fit.
      series.forEach((s, k) => {
        const trend = trends[k];
        let best = 0;
        let at = 0;
        s.forEach((d, i) => {
          const thick = y(d[0]) - y(d[1]);
          if (thick > best) (best = thick), (at = i);
        });
        const size = W < 520 ? 10 : 12;
        const width = trend.name.length * size * 0.55;
        const lx = x(span[at]);
        if (best > size + 5 && lx - width / 2 > m.l && lx + width / 2 < W - m.r) {
          const label = svgEl("text", { x: lx, y: (y(s[at][0]) + y(s[at][1])) / 2 + size * 0.35, "text-anchor": "middle", fill: ink(fills[k]) ? night : text, "font-size": size, "font-weight": 600, "font-family": "Instrument Sans, sans-serif" });
          label.style.pointerEvents = "none";
          label.textContent = trend.name;
          svg!.append(label);
        }
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
