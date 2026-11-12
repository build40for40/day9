// Draws a "Draw your own" spec as an SVG infographic, straight from the dataset.
// Claude only picks the chart, the trends and the framing; every mark here is real data.

import { FAMILIES, NOW_YEAR, clamp, decadeOf, familyOf, token, type Family, type Nerds, type Trend } from "./data";

export interface Spec {
  title: string;
  subtitle: string;
  insight: string;
  chart: "lines" | "timeline" | "bars" | "stripes" | "radial" | "bubbles";
  trends: string[];
  measure: "presence" | "books_uk" | "books_us";
  bars: "trends_on" | "comebacks" | "museum_vam" | "museum_met";
  families: Family[];
  from: number;
  to: number;
  highlights: { year: number; label: string }[];
  mood: "editorial" | "neon" | "poster";
}

const W = 1080;
const H = 1350;
const PAD = 72;
const TOP = 330;
const BOTTOM = H - 230;

const esc = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function wrap(text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if ((line + " " + word).trim().length > max) {
      if (line) lines.push(line);
      line = word;
    } else line = (line + " " + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

export function renderSpec(nerds: Nerds, spec: Spec) {
  const c = {
    night: token("--color-nof-night", "#0e0d12"),
    panel: token("--color-nof-panel", "#17151d"),
    line: token("--color-nof-line", "#302c3a"),
    text: token("--color-nof-text", "#f2eee6"),
    sub: token("--color-nof-sub", "#cfc9d6"),
    muted: token("--color-nof-muted", "#a39fae"),
    pink: token("--color-nof-pink", "#ff6fa8"),
    gold: token("--color-nof-gold", "#e8c27a"),
  };
  const family = (f: Family) => token(FAMILIES[f].token);
  const palette = [family("clothes"), family("scenes"), family("kit"), family("face")];
  const trends = spec.trends.map((id) => nerds.byId.get(id)).filter((t): t is Trend => !!t);
  const { from, to } = spec;
  const x = (year: number) => PAD + ((year - from) / Math.max(1, to - from)) * (W - PAD * 2);
  const display = `'Bodoni Moda', Didot, Georgia, serif`;
  const body = `'Instrument Sans', system-ui, sans-serif`;
  const mono = `'JetBrains Mono', ui-monospace, monospace`;
  const neon = spec.mood === "neon";
  const poster = spec.mood === "poster";
  const glow = neon ? ` filter="url(#glow)"` : "";
  const parts: string[] = [];

  // Background and header.
  const bg = poster ? nerds.colour(spec.highlights[0]?.year ?? Math.round((from + to) / 2)) : c.night;
  parts.push(`<rect width="${W}" height="${H}" fill="${c.night}"/>`);
  if (poster) parts.push(`<rect width="${W}" height="300" fill="${bg}"/><rect y="292" width="${W}" height="8" fill="${c.night}" opacity="0.4"/>`);
  if (neon) parts.push(`<rect width="${W}" height="${H}" fill="url(#vignette)"/>`);
  const titleSize = poster ? 92 : 76;
  const titleLines = wrap(spec.title, poster ? 18 : 22).slice(0, 2);
  parts.push(`<text x="${PAD}" y="70" font-family="${mono}" font-size="20" letter-spacing="4" fill="${poster ? c.night : c.pink}">NERDS OF FASHION · ${from} TO ${to}</text>`);
  titleLines.forEach((line, i) =>
    parts.push(`<text x="${PAD}" y="${150 + i * titleSize * 0.98}" font-family="${display}" font-weight="900" ${poster ? "" : 'font-style="italic"'} font-size="${titleSize}" fill="${poster ? c.night : c.text}"${glow}>${esc(line)}</text>`),
  );
  wrap(spec.subtitle, 70)
    .slice(0, 2)
    .forEach((line, i) => parts.push(`<text x="${PAD}" y="${150 + titleLines.length * titleSize * 0.98 + 8 + i * 30}" font-family="${body}" font-size="24" fill="${poster ? c.night : c.sub}">${esc(line)}</text>`));

  // Year axis, shared by most charts.
  const axis = () => {
    const step = to - from > 60 ? 20 : to - from > 25 ? 10 : 5;
    for (let year = Math.ceil(from / step) * step; year <= to; year += step) {
      parts.push(`<line x1="${x(year)}" x2="${x(year)}" y1="${TOP}" y2="${BOTTOM}" stroke="${c.line}" stroke-width="1"/>`);
      parts.push(`<text x="${x(year)}" y="${BOTTOM + 34}" text-anchor="middle" font-family="${mono}" font-size="20" fill="${c.muted}">${year}</text>`);
    }
  };
  const highlights = (top = TOP, bottom = BOTTOM) =>
    spec.highlights.forEach((h, i) => {
      parts.push(`<line x1="${x(h.year)}" x2="${x(h.year)}" y1="${top - 10}" y2="${bottom}" stroke="${c.pink}" stroke-width="2" stroke-dasharray="6 6"/>`);
      const anchor = x(h.year) > W - 260 ? "end" : "start";
      parts.push(`<text x="${x(h.year) + (anchor === "end" ? -10 : 10)}" y="${top + 4 + i * 28}" text-anchor="${anchor}" font-family="${body}" font-weight="600" font-size="20" fill="${c.pink}">${h.year} · ${esc(h.label)}</text>`);
    });

  const series = (trend: Trend) => {
    const values: number[] = [];
    const shape = spec.measure === "presence" ? undefined : nerds.shape(trend, spec.measure === "books_us" ? "en-US" : "en-GB");
    for (let year = from; year <= to; year++) {
      if (shape) values.push(year <= 2022 ? (shape[year - 1920] ?? 0) : NaN);
      else values.push(nerds.presence(trend, year));
    }
    return values;
  };

  if (spec.chart === "lines") {
    axis();
    const shown = trends.slice(0, 4);
    // Legend first, so identity never rests on colour alone.
    let lx = PAD;
    shown.forEach((trend, i) => {
      const label = trend.name.length > 26 ? `${trend.name.slice(0, 25)}…` : trend.name;
      parts.push(`<rect x="${lx}" y="${TOP + 4}" width="28" height="8" rx="4" fill="${palette[i]}"/>`);
      parts.push(`<text x="${lx + 36}" y="${TOP + 14}" font-family="${body}" font-weight="700" font-size="20" fill="${c.text}">${esc(label)}</text>`);
      lx += 36 + label.length * 10.5 + 28;
      if (lx > W - 260 && i < shown.length - 1) lx = PAD;
    });
    const chartTop = TOP + 70;
    const y = (v: number) => BOTTOM - v * (BOTTOM - chartTop);
    shown.forEach((trend, i) => {
      const values = series(trend);
      const d = values.map((v, k) => (Number.isNaN(v) ? "" : `${k === 0 || Number.isNaN(values[k - 1]) ? "M" : "L"}${x(from + k).toFixed(1)},${y(v).toFixed(1)}`)).join("");
      parts.push(`<path d="${d}" fill="none" stroke="${palette[i]}" stroke-width="${neon ? 5 : 4}" stroke-linejoin="round" stroke-linecap="round"${glow}/>`);
      let peak = 0;
      values.forEach((v, k) => v > (values[peak] || 0) && (peak = k));
      parts.push(`<circle cx="${x(from + peak)}" cy="${y(values[peak])}" r="8" fill="${palette[i]}" stroke="${c.night}" stroke-width="3"/>`);
    });
    highlights(chartTop);
    parts.push(`<text x="${PAD}" y="${BOTTOM + 64}" font-family="${mono}" font-size="16" fill="${c.muted}">${spec.measure === "presence" ? "IN STYLE, ACCORDING TO WIKIPEDIA" : `MENTIONS IN ${spec.measure === "books_us" ? "AMERICAN" : "BRITISH"} BOOKS, EACH SCALED TO ITS OWN PEAK`}</text>`);
  }

  if (spec.chart === "timeline") {
    axis();
    const rows = trends.slice(0, 12);
    const rowH = Math.min(64, (BOTTOM - TOP - 20) / Math.max(1, rows.length));
    rows.forEach((trend, i) => {
      const top = TOP + 20 + i * rowH;
      const colour = family(familyOf(trend.category));
      parts.push(`<text x="${PAD}" y="${top + rowH * 0.36}" font-family="${body}" font-weight="600" font-size="${Math.min(22, rowH * 0.42)}" fill="${c.text}">${esc(trend.name)}</text>`);
      for (const period of trend.periods) {
        const a = clamp(period.start, from, to);
        const b = clamp(period.end, from, to);
        if (period.end < from || period.start > to) continue;
        parts.push(`<rect x="${x(a)}" y="${top + rowH * 0.48}" width="${Math.max(6, x(b + 1) - x(a))}" height="${rowH * 0.36}" rx="${rowH * 0.12}" fill="${colour}" opacity="${period.region === "global" ? 0.95 : 0.6}"${glow}/>`);
      }
    });
    highlights();
  }

  if (spec.chart === "bars") {
    const decades: number[] = [];
    for (let d = decadeOf(from); d <= decadeOf(to); d += 10) decades.push(d);
    const value = (d: number) => {
      if (spec.bars === "museum_vam") return nerds.data.series.vamByDecade[d] ?? 0;
      if (spec.bars === "museum_met") return nerds.data.series.metByDecade[d] ?? 0;
      if (spec.bars === "comebacks") return nerds.comebacks().filter((r) => decadeOf(r.to) === d).length;
      return nerds.trends.filter((t) => (!spec.families.length || spec.families.includes(familyOf(t.category))) && t.periods.some((p) => p.start <= d + 9 && p.end >= d)).length;
    };
    const values = decades.map(value);
    const max = Math.max(1, ...values);
    const bw = (W - PAD * 2) / decades.length;
    const colour = spec.families.length === 1 ? family(spec.families[0]) : c.pink;
    decades.forEach((d, i) => {
      const h = (values[i] / max) * (BOTTOM - TOP - 60);
      const bx = PAD + i * bw + 4;
      parts.push(`<rect x="${bx}" y="${BOTTOM - h}" width="${bw - 8}" height="${h}" rx="6" fill="${spec.highlights.some((hl) => decadeOf(hl.year) === d) ? c.gold : colour}"${glow}/>`);
      parts.push(`<text x="${bx + (bw - 8) / 2}" y="${BOTTOM - h - 12}" text-anchor="middle" font-family="${display}" font-weight="700" font-size="${Math.min(34, bw * 0.4)}" fill="${c.text}">${values[i]}</text>`);
      parts.push(`<text x="${bx + (bw - 8) / 2}" y="${BOTTOM + 34}" text-anchor="middle" font-family="${mono}" font-size="${Math.min(20, bw * 0.24)}" fill="${c.muted}">${d}s</text>`);
    });
    const what = { trends_on: "TRENDS IN STYLE EACH DECADE", comebacks: "COMEBACKS EACH DECADE", museum_vam: "V&A OBJECTS KEPT FROM EACH DECADE", museum_met: "MET OBJECTS KEPT FROM EACH DECADE" }[spec.bars];
    parts.push(`<text x="${PAD}" y="${TOP}" font-family="${mono}" font-size="18" fill="${c.muted}">${esc(what)}</text>`);
  }

  if (spec.chart === "stripes") {
    const sw = (W - PAD * 2) / (to - from + 1);
    for (let year = from; year <= to; year++) parts.push(`<rect x="${PAD + (year - from) * sw}" y="${TOP}" width="${sw + 0.6}" height="${BOTTOM - TOP}" fill="${nerds.colour(year)}"/>`);
    spec.highlights.forEach((h, i) => {
      const hx = PAD + (h.year - from + 0.5) * sw;
      const ty = TOP + 60 + i * 70;
      const anchor = hx > W - 300 ? "end" : "start";
      parts.push(`<line x1="${hx}" x2="${hx}" y1="${TOP}" y2="${BOTTOM}" stroke="${c.night}" stroke-width="3"/>`);
      parts.push(`<rect x="${anchor === "end" ? hx - 290 : hx + 6}" y="${ty - 30}" width="284" height="44" rx="8" fill="${c.night}"/>`);
      parts.push(`<text x="${anchor === "end" ? hx - 280 : hx + 16}" y="${ty}" font-family="${body}" font-weight="600" font-size="20" fill="${c.text}">${h.year} · ${esc(h.label)}</text>`);
    });
    for (let year = Math.ceil(from / 10) * 10; year <= to; year += 10) parts.push(`<text x="${PAD + (year - from + 0.5) * sw}" y="${BOTTOM + 34}" text-anchor="middle" font-family="${mono}" font-size="20" fill="${c.muted}">${year}</text>`);
  }

  if (spec.chart === "radial") {
    const cx = W / 2;
    const cy = (TOP + BOTTOM) / 2 + 10;
    const outer = Math.min(W / 2 - PAD, (BOTTOM - TOP) / 2) - 10;
    const rows = trends.slice(0, 12);
    const inner = outer * 0.3;
    const ringW = (outer - inner) / Math.max(1, rows.length);
    const angle = (year: number) => -Math.PI / 2 + ((year - from) / (to - from + 1)) * Math.PI * 2;
    const polar = (r: number, a: number) => `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
    for (let year = from; year <= to; year++) {
      const a0 = angle(year);
      const a1 = angle(year + 1);
      parts.push(`<path d="M${polar(outer + 10, a0)}A${outer + 10},${outer + 10} 0 0 1 ${polar(outer + 10, a1)}L${polar(outer + 24, a1)}A${outer + 24},${outer + 24} 0 0 0 ${polar(outer + 24, a0)}Z" fill="${nerds.colour(year)}"/>`);
    }
    rows.forEach((trend, i) => {
      const r = inner + (i + 0.5) * ringW;
      const colour = family(familyOf(trend.category));
      parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c.line}" stroke-width="1"/>`);
      for (let year = from; year <= to; year++) {
        const v = nerds.presence(trend, year);
        if (v < 0.35) continue;
        parts.push(`<path d="M${polar(r, angle(year))}A${r},${r} 0 0 1 ${polar(r, angle(year + 1) + 0.002)}" fill="none" stroke="${colour}" stroke-width="${ringW * 0.62}" opacity="${(0.35 + v * 0.65).toFixed(2)}"${glow}/>`);
      }
      parts.push(`<text x="${cx + 8}" y="${cy - r + 6}" font-family="${body}" font-weight="600" font-size="${Math.min(18, ringW * 0.55)}" fill="${c.text}" stroke="${c.night}" stroke-width="4" paint-order="stroke">${esc(trend.name)}</text>`);
    });
    const step = to - from > 60 ? 20 : 10;
    for (let year = Math.ceil(from / step) * step; year <= to; year += step) {
      const a = angle(year);
      parts.push(`<text x="${cx + Math.cos(a) * (outer + 50)}" y="${cy + Math.sin(a) * (outer + 50) + 7}" text-anchor="middle" font-family="${mono}" font-size="18" fill="${c.muted}">${year}</text>`);
    }
    spec.highlights.forEach((h) => {
      const a = angle(h.year + 0.5);
      parts.push(`<line x1="${cx + Math.cos(a) * inner}" y1="${cy + Math.sin(a) * inner}" x2="${cx + Math.cos(a) * (outer + 24)}" y2="${cy + Math.sin(a) * (outer + 24)}" stroke="${c.pink}" stroke-width="2" stroke-dasharray="5 5"/>`);
    });
    parts.push(`<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-family="${display}" font-weight="900" font-style="italic" font-size="${inner * 0.5}" fill="${c.text}">${from}</text>`);
  }

  if (spec.chart === "bubbles") {
    axis();
    const lanes = (Object.keys(FAMILIES) as Family[]).filter((f) => trends.some((t) => familyOf(t.category) === f));
    const laneH = (BOTTOM - TOP - 40) / Math.max(1, lanes.length);
    const maxFame = Math.max(...trends.map((t) => nerds.fame(t)), 1);
    lanes.forEach((f, li) => parts.push(`<text x="${PAD}" y="${TOP + 30 + li * laneH}" font-family="${mono}" font-size="18" fill="${c.muted}">${esc(FAMILIES[f].label.toUpperCase())}</text>`));
    trends.slice(0, 16).forEach((trend, i) => {
      let peak = from;
      let best = -1;
      for (let year = from; year <= to; year++) {
        const v = nerds.presence(trend, year);
        if (v > best) (best = v), (peak = year);
      }
      const li = lanes.indexOf(familyOf(trend.category));
      const r = 18 + (nerds.fame(trend) / maxFame) * 52;
      const by = TOP + 40 + li * laneH + laneH / 2 + ((i % 3) - 1) * laneH * 0.2;
      const colour = family(familyOf(trend.category));
      parts.push(`<circle cx="${x(peak)}" cy="${by}" r="${r}" fill="${colour}" opacity="0.85" stroke="${c.night}" stroke-width="3"${glow}/>`);
      parts.push(`<text x="${x(peak)}" y="${by + r + 24}" text-anchor="middle" font-family="${body}" font-weight="600" font-size="19" fill="${c.text}" stroke="${c.night}" stroke-width="4" paint-order="stroke">${esc(trend.name)}</text>`);
    });
    highlights();
  }

  // Insight and credit.
  const insight = wrap(spec.insight, 74).slice(0, 4);
  insight.forEach((line, i) => parts.push(`<text x="${PAD}" y="${BOTTOM + 104 + i * 32}" font-family="${body}" font-size="24" fill="${c.sub}">${esc(line)}</text>`));
  parts.push(`<text x="${PAD}" y="${H - 34}" font-family="${mono}" font-size="16" fill="${c.muted}">build40for40.com/nerds-of-fashion · Data: Wikipedia, Google Books Ngram, V&amp;A, The Met, Pantone</text>`);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(spec.title)}. ${esc(spec.subtitle)}">
<defs>
<filter id="glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
<radialGradient id="vignette" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="${c.pink}" stop-opacity="0.12"/><stop offset="1" stop-color="${c.night}" stop-opacity="0"/></radialGradient>
</defs>
${parts.join("\n")}
</svg>`;
}
