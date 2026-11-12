// String Theory: every comeback Wikipedia records, as a thread from the original to its revival
// around a clock of years. Dashed threads are forecasts from the real gap distribution.

import { FAMILIES, NOW_YEAR, clamp, familyOf, token, type Family } from "../data";
import { FONT, reducedMotion, stage } from "../stage";
import type { View } from "../view";

const START = 1900;
const END = 2050;
type Filter = Family | "eras" | "all";

interface Thread {
  from: number;
  to: number;
  gap: number;
  subject: string;
  name: string;
  family: Family | "eras";
  quote?: string;
  article?: string;
  forecast?: number;
}

function alpha(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

const view: View = {
  id: "strings",
  tab: "comebacks",
  order: 1,
  title: "String Theory",
  blurb: "Every comeback on record, tied from the original to its revival. Fashion is a clock, not a line",
  how: "Hover or tap a thread to read the receipts. Tap the rim to see one year's comebacks. Dashed threads are our guesses",
  sources: ["wikipedia"],
  mount(el, context) {
    const { nerds } = context;
    const ink = token("--color-nof-text", "#f2eee6");
    const muted = token("--color-nof-muted", "#a39fae");
    const pink = token("--color-nof-pink", "#ff6fa8");
    const gold = token("--color-nof-gold", "#e8c27a");
    const night = token("--color-nof-night", "#0e0d12");
    const colours: Record<Family | "eras", string> = {
      clothes: token(FAMILIES.clothes.token, "#5b8ef0"),
      scenes: token(FAMILIES.scenes.token, "#e2703a"),
      kit: token(FAMILIES.kit.token, "#1fa583"),
      face: token(FAMILIES.face.token, "#a970da"),
      eras: gold,
    };
    const stats = nerds.gapStats();

    const real: Thread[] = nerds
      .comebacks()
      .map((c) => {
        const trend = c.trend ? nerds.byId.get(c.trend) : undefined;
        return {
          from: c.from,
          to: c.to,
          gap: c.gap,
          subject: c.subject,
          name: trend?.name ?? c.subject,
          family: trend ? familyOf(trend.category) : ("eras" as const),
          quote: c.quote,
          article: c.article,
        };
      })
      .sort((a, b) => a.from - b.from);

    // Forecasts: famous trends that have been off for 25 to 45 years and haven't come back yet.
    const forecasts: Thread[] = [...nerds.trends]
      .sort((a, b) => nerds.fame(b) - nerds.fame(a))
      .slice(0, 120)
      .map((trend) => {
        let last = 0;
        for (let y = 1920; y <= NOW_YEAR; y++) if (nerds.presence(trend, y) > 0.5) last = y;
        const since = NOW_YEAR - last;
        const back = real.some((t) => t.name === trend.name && t.to >= last - 2);
        const odds = nerds.comebackOdds(since, 10);
        return { trend, last, since, back, odds };
      })
      .filter((f) => f.last && f.since >= 25 && f.since <= 45 && !f.back && f.odds > 0)
      .sort((a, b) => b.odds * nerds.fame(b.trend) - a.odds * nerds.fame(a.trend))
      .slice(0, 8)
      .map((f) => ({
        from: f.last,
        to: Math.max(NOW_YEAR + 2, Math.min(END - 2, f.last + Math.round(stats.median))),
        gap: 0,
        subject: f.trend.name,
        name: f.trend.name,
        family: familyOf(f.trend.category),
        forecast: f.odds,
      }));

    let filter: Filter = (context.params.family as Filter) || "all";
    let showForecasts = context.params.forecast !== "off";
    let pinnedYear: number | null = context.params.year ? Number(context.params.year) : null;
    let selected: Thread | null = null;
    let hovered: Thread | null = null;
    let hoverYear: number | null = null;
    let clock = reducedMotion() || context.params.year ? 100 : 0;
    const geometry = new Map<Thread, [number, number][]>();
    const milestones = context.born ? [{ year: context.born, label: "you" }, { year: context.born + 16, label: "16" }].filter((m) => m.year <= NOW_YEAR) : [];

    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-3";
    el.append(wrapper);
    const box = document.createElement("div");
    box.className = "overflow-hidden rounded-2xl border border-nof-line bg-nof-night";
    wrapper.append(box);

    const visible = () => real.filter((t) => filter === "all" || t.family === filter).concat(showForecasts ? forecasts.filter((t) => filter === "all" || t.family === filter) : []);

    const scene = stage(box, {
      height: context.compact ? "clamp(360px, 62vh, 560px)" : "clamp(420px, 78vh, 720px)",
      animate: true,
      label: `A clock of years from ${START} to ${END} with ${real.length} comeback threads. The typical comeback takes ${stats.median} years`,
      render({ ctx: g, width: w, height: h, dt }, pointer) {
        clock += dt;
        const cx = w / 2;
        const cy = h / 2 + 4;
        const R = Math.min(w * (w < 500 ? 0.36 : 0.4), h * 0.38);
        const angle = (y: number) => -Math.PI / 2 + ((y - START) / (END - START)) * Math.PI * 2;
        const at = (y: number, r: number) => [cx + Math.cos(angle(y)) * r, cy + Math.sin(angle(y)) * r] as [number, number];

        g.fillStyle = night;
        g.fillRect(0, 0, w, h);

        // Hover: a thread near the pointer, or a year on the rim.
        hovered = null;
        hoverYear = null;
        const threads = visible();
        if (pointer.inside) {
          const d = Math.hypot(pointer.x - cx, pointer.y - cy);
          if (d > R * 0.88 && d < R + 46) {
            let a = Math.atan2(pointer.y - cy, pointer.x - cx) + Math.PI / 2;
            if (a < 0) a += Math.PI * 2;
            hoverYear = Math.round(START + (a / (Math.PI * 2)) * (END - START));
          } else {
            let best = 12;
            for (const t of threads) {
              for (const [x, y] of geometry.get(t) ?? []) {
                const dist = Math.hypot(x - pointer.x, y - pointer.y);
                if (dist < best) {
                  best = dist;
                  hovered = t;
                }
              }
            }
          }
        }
        const focusYear = hoverYear ?? pinnedYear;
        const focus = hovered ?? selected;

        // Rim: each year in its colour, the future in grey.
        for (let y = START; y < END; y++) {
          g.strokeStyle = y <= NOW_YEAR ? (y < 1920 ? alpha(ink, 0.25) : nerds.colour(y)) : alpha(ink, 0.14);
          g.lineWidth = y <= NOW_YEAR ? 9 : 3;
          g.beginPath();
          g.arc(cx, cy, R + 8, angle(y), angle(y + 1) - 0.004);
          g.stroke();
        }
        g.font = FONT.mono(w < 500 ? 9 : 10);
        g.textAlign = "center";
        g.textBaseline = "middle";
        for (let y = START; y < END; y += w < 500 ? 20 : 10) {
          const [x, yy] = at(y, R + 28);
          g.fillStyle = alpha(ink, 0.6);
          g.fillText(String(y), x, yy);
        }
        const [nx, ny] = at(NOW_YEAR, R + 22);
        g.fillStyle = pink;
        g.fillText("now", nx, ny);
        for (const m of milestones) {
          const [x1, y1] = at(m.year + 0.5, R + 2);
          const [x2, y2] = at(m.year + 0.5, R + 16);
          g.strokeStyle = pink;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke();
          const [lx, ly] = at(m.year + 0.5, R - 10);
          g.fillStyle = pink;
          g.font = FONT.mono(9, 600);
          g.fillText(m.label, lx, ly);
        }
        if (focusYear !== null) {
          const [x1, y1] = at(focusYear + 0.5, R * 0.3);
          const [x2, y2] = at(focusYear + 0.5, R + 16);
          g.strokeStyle = pink;
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke();
        }

        // Threads, drawn in over the first few seconds.
        g.globalCompositeOperation = "lighter";
        const n = threads.length || 1;
        threads.forEach((t, i) => {
          const progress = clamp((clock - (i / n) * 3.2) / 0.8, 0, 1);
          if (progress <= 0) return;
          const touches = focusYear !== null && (Math.abs(t.from - focusYear) <= 1 || Math.abs(t.to - focusYear) <= 1);
          const lit = focus ? focus === t : focusYear !== null ? touches : true;
          const p0 = at(t.from + 0.5, R);
          const p1 = at(t.to + 0.5, R);
          const mid = (angle(t.from) + angle(t.to)) / 2;
          const pull = 0.15 + Math.min(0.6, (t.to - t.from) / 180);
          const ctl: [number, number] = [cx + Math.cos(mid) * R * pull, cy + Math.sin(mid) * R * pull];
          const steps = 24;
          const pts: [number, number][] = [];
          for (let k = 0; k <= steps; k++) {
            const u = k / steps;
            pts.push([(1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * ctl[0] + u * u * p1[0], (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * ctl[1] + u * u * p1[1]]);
          }
          geometry.set(t, pts);
          const upto = Math.max(1, Math.floor(steps * progress));
          const trace = () => {
            g.beginPath();
            for (let k = 0; k <= upto; k++) (k ? g.lineTo : g.moveTo).call(g, pts[k][0], pts[k][1]);
          };
          const colour = colours[t.family];
          const dim = lit ? 1 : 0.12;
          g.setLineDash(t.forecast ? [4, 5] : []);
          g.strokeStyle = alpha(colour, 0.1 * dim);
          g.lineWidth = focus === t ? 10 : 5;
          trace();
          g.stroke();
          g.strokeStyle = alpha(colour, (t.forecast ? 0.95 : 0.6) * dim);
          g.lineWidth = focus === t ? 2.6 : 1.2;
          trace();
          g.stroke();
          g.setLineDash([]);
          if (progress >= 1) {
            g.fillStyle = alpha(colour, dim);
            for (const p of [p0, p1]) {
              g.beginPath();
              g.arc(p[0], p[1], 2.2, 0, Math.PI * 2);
              g.fill();
            }
          }
        });
        g.globalCompositeOperation = "source-over";

        // Centre text.
        g.textAlign = "center";
        g.textBaseline = "alphabetic";
        g.fillStyle = ink;
        if (focus) {
          g.font = FONT.display(clamp(R * 0.12, 16, 30), 600, true);
          const name = focus.name.length > 26 ? `${focus.name.slice(0, 25)}…` : focus.name;
          g.fillText(name, cx, cy - 6);
          g.font = FONT.mono(clamp(R * 0.05, 10, 13));
          g.fillStyle = alpha(ink, 0.75);
          g.fillText(focus.forecast ? `${focus.from} → ${focus.to}?` : `${focus.from} → ${focus.to}`, cx, cy + 16);
          g.fillText(focus.forecast ? `${Math.round(focus.forecast * 100)}% chance within 10 years` : `${focus.gap} years later`, cx, cy + 34);
        } else if (focusYear !== null) {
          g.font = FONT.display(clamp(R * 0.24, 30, 72), 600, true);
          g.fillText(String(focusYear), cx, cy - 4);
          const hits = threads.filter((t) => Math.abs(t.from - focusYear) <= 1 || Math.abs(t.to - focusYear) <= 1).slice(0, 4);
          g.font = FONT.body(clamp(R * 0.045, 10, 13));
          g.fillStyle = alpha(ink, 0.8);
          if (!hits.length) g.fillText("No comebacks on record here", cx, cy + 20);
          hits.forEach((t, i) => {
            const text = `${t.name} ${t.from} → ${t.to}${t.forecast ? "?" : ""}`;
            g.fillText(text.length > 40 ? `${text.slice(0, 39)}…` : text, cx, cy + 20 + i * 17);
          });
        } else {
          g.font = FONT.display(clamp(R * 0.42, 52, 150), 700);
          g.fillText(String(stats.median), cx, cy + R * 0.1);
          g.font = FONT.mono(clamp(R * 0.045, 9, 11));
          g.fillStyle = alpha(ink, 0.65);
          g.fillText("years, the typical comeback", cx, cy + R * 0.1 + 22);
          g.fillText(`${stats.count} comebacks on record`, cx, cy + R * 0.1 + 38);
        }
        g.textAlign = "left";
        g.font = FONT.mono(10);
        g.fillStyle = muted;
        if (w >= 500) g.fillText("hover a thread · tap the rim", 14, 22);
      },
    });

    // Tap: pin a thread or a year.
    let downAt: [number, number] | null = null;
    scene.canvas.addEventListener("pointerdown", (event) => {
      downAt = [event.clientX, event.clientY];
    });
    scene.canvas.addEventListener("pointerup", (event) => {
      if (!downAt || Math.hypot(event.clientX - downAt[0], event.clientY - downAt[1]) > 8) return;
      downAt = null;
      scene.draw();
      if (hovered) {
        selected = selected === hovered ? null : hovered;
        pinnedYear = null;
      } else if (hoverYear !== null) {
        pinnedYear = pinnedYear === hoverYear ? null : hoverYear;
        selected = null;
        context.setParam("year", pinnedYear === null ? null : String(pinnedYear));
      } else {
        selected = null;
        pinnedYear = null;
        context.setParam("year", null);
      }
      renderPanel();
    });
    scene.canvas.addEventListener("pointermove", () => {
      if (hovered !== shownInPanel && !selected) renderPanel();
    });

    // Filters.
    const controls = document.createElement("div");
    controls.className = "flex flex-wrap items-center gap-2";
    const options: [Filter, string][] = [
      ["all", "Everything"],
      ["clothes", FAMILIES.clothes.label],
      ["scenes", FAMILIES.scenes.label],
      ["kit", FAMILIES.kit.label],
      ["face", FAMILIES.face.label],
      ["eras", "Whole eras"],
    ];
    const chip = (active: boolean) =>
      `rounded-full border px-3 py-1.5 font-nof-body text-xs font-semibold ${active ? "border-nof-pink bg-nof-pink text-nof-pink-ink" : "border-nof-line text-nof-sub hover:border-nof-pink"}`;
    const buttons = options.map(([value, label]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => {
        filter = value;
        selected = null;
        clock = 100;
        context.setParam("family", value === "all" ? null : value);
        sync();
      });
      return [value, button] as const;
    });
    const forecastButton = document.createElement("button");
    forecastButton.type = "button";
    forecastButton.addEventListener("click", () => {
      showForecasts = !showForecasts;
      context.setParam("forecast", showForecasts ? null : "off");
      sync();
    });
    if (!context.compact) {
      for (const [, button] of buttons) controls.append(button);
      controls.append(forecastButton);
      wrapper.append(controls);
    }

    // Legend, so colour is never the only clue.
    const legend = document.createElement("div");
    legend.className = "flex flex-wrap gap-x-4 gap-y-1 font-nof-body text-xs text-nof-sub";
    for (const [family, label] of options.slice(1) as [Family | "eras", string][]) {
      const item = document.createElement("span");
      item.className = "inline-flex items-center gap-1.5";
      const swatch = document.createElement("span");
      swatch.className = "inline-block h-0.5 w-4";
      swatch.style.background = colours[family];
      item.append(swatch, label);
      legend.append(item);
    }
    const dashed = document.createElement("span");
    dashed.className = "inline-flex items-center gap-1.5";
    const dash = document.createElement("span");
    dash.className = "inline-block w-4 border-t border-dashed border-nof-text";
    dashed.append(dash, "Forecast");
    legend.append(dashed);
    wrapper.append(legend);

    // The receipts for one thread.
    const panel = document.createElement("div");
    panel.className = "min-h-24 rounded-2xl border border-nof-line bg-nof-panel p-4 font-nof-body text-sm text-nof-sub";
    panel.setAttribute("aria-live", "polite");
    wrapper.append(panel);
    let shownInPanel: Thread | null = null;
    function renderPanel() {
      const t = selected ?? hovered;
      shownInPanel = t;
      panel.replaceChildren();
      const title = document.createElement("p");
      title.className = "font-nof-display text-xl italic text-nof-text";
      const body = document.createElement("p");
      body.className = "mt-1";
      if (!t) {
        title.textContent = `${stats.count} comebacks, and counting`;
        body.textContent = `Half of them took ${stats.median} years or less. Tap a thread for the evidence, straight from Wikipedia.`;
        panel.append(title, body);
        return;
      }
      title.textContent = t.name;
      if (t.forecast) {
        body.textContent = `Last properly in style around ${t.from}. Going by every comeback on record, there's a ${Math.round(t.forecast * 100)}% chance it's back within ten years. This is a guess, not a promise.`;
        panel.append(title, body);
        return;
      }
      body.textContent = `${t.from} → ${t.to}, back after ${t.gap} years${t.name.toLowerCase() !== t.subject.toLowerCase() ? ` as ${t.subject}` : ""}.`;
      panel.append(title, body);
      if (t.quote) {
        const quote = document.createElement("blockquote");
        quote.className = "mt-3 border-l-2 border-nof-pink pl-3 italic text-nof-sub";
        quote.textContent = `“${t.quote}”`;
        const cite = document.createElement("p");
        cite.className = "mt-2 text-xs text-nof-muted";
        cite.textContent = `Wikipedia, ${t.article}. CC BY-SA 4.0`;
        panel.append(quote, cite);
      }
    }

    function sync() {
      for (const [value, button] of buttons) button.className = chip(filter === value);
      forecastButton.className = chip(showForecasts);
      forecastButton.textContent = showForecasts ? "Forecasts on" : "Forecasts off";
      renderPanel();
    }
    sync();

    return {
      update(params) {
        if (params.family) filter = params.family as Filter;
        pinnedYear = params.year ? Number(params.year) : null;
        if (params.trend) selected = real.find((t) => nerds.byId.get(params.trend)?.name === t.name) ?? null;
        clock = 100;
        sync();
      },
      destroy() {
        scene.destroy();
        wrapper.remove();
      },
    };
  },
};

export default view;
