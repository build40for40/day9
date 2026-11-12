// "Written about": Google Books Ngram curves for up to four trends, each scaled to its own
// peak, with the years Wikipedia says it was actually worn shaded underneath.

import { FIRST_YEAR, clamp, token, type Trend } from "../data";
import { FONT, stage } from "../stage";
import type { View } from "../view";

const DEFAULTS = ["miniskirt", "bell-bottoms", "shoulder-pads", "skinny-jeans"];
const SERIES_TOKENS = ["--color-nof-clothes", "--color-nof-scenes", "--color-nof-kit", "--color-nof-face"];
const SERIES_FALLBACK = ["#5b8ef0", "#e2703a", "#1fa583", "#a970da"];
const SWATCH = ["bg-nof-clothes", "bg-nof-scenes", "bg-nof-kit", "bg-nof-face"];
const LAST_YEAR = 2022;
// Some trends have no Ngram data at all (ngram is null in the file).
const hasCurve = (t: Trend) => !!(t.ngram && (t.ngram["en-GB"]?.length || t.ngram["en-US"]?.length));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const view: View = {
  id: "words",
  tab: "words",
  title: "Books are always late",
  blurb: "How often each trend got written about, against when people actually wore it",
  how: "Search to add up to four trends. Hover or drag across the chart to read any year.",
  sources: ["ngram", "wikipedia"],
  order: 1,
  mount(root, context) {
    const { nerds } = context;
    const wrap = el("div", "flex flex-col gap-3");
    root.append(wrap);

    // Slot i keeps its colour for as long as that trend stays picked: colour follows the trend, not its rank.
    const fromParams = (value?: string) =>
      (value ?? "")
        .split(",")
        .map((id) => nerds.byId.get(id))
        .filter((t): t is Trend => !!t && hasCurve(t))
        .slice(0, 4);
    let slots: (Trend | null)[] = [null, null, null, null];
    const setSlots = (list: Trend[]) => {
      slots = [0, 1, 2, 3].map((i) => list[i] ?? null);
    };
    setSlots(context.params.trends ? fromParams(context.params.trends) : DEFAULTS.map((id) => nerds.byId.get(id)!).filter(Boolean));
    let corpus: "en-GB" | "en-US" = context.params.corpus === "US" ? "en-US" : "en-GB";
    let hoverYear: number | null = null;
    let focus: number | null = null;

    const controls = el("div", "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between");
    const left = el("div", "flex min-w-0 flex-1 flex-col gap-2");
    const chips = el("div", "flex flex-wrap gap-2");
    const searchWrap = el("div", "relative max-w-sm");
    const search = el("input", "w-full rounded-full border border-nof-line bg-nof-panel px-4 py-2 font-nof-body text-sm text-nof-text placeholder:text-nof-muted focus:border-nof-pink focus:outline-none");
    search.type = "search";
    search.placeholder = "Add a trend, like corset or mullet";
    search.setAttribute("aria-label", "Search trends to add");
    const results = el("ul", "absolute inset-x-0 top-full z-20 mt-1 hidden max-h-64 overflow-y-auto rounded-2xl border border-nof-line bg-nof-raised py-1 font-nof-body text-sm shadow-lg");
    results.setAttribute("role", "listbox");
    searchWrap.append(search, results);
    left.append(chips, searchWrap);

    const toggle = el("div", "flex shrink-0 self-start rounded-full border border-nof-line bg-nof-panel p-1 font-nof-body text-xs font-semibold");
    toggle.setAttribute("role", "radiogroup");
    toggle.setAttribute("aria-label", "Which books");
    const corpusButtons = (["en-GB", "en-US"] as const).map((c) => {
      const b = el("button", "rounded-full px-3 py-1.5", c === "en-GB" ? "British books" : "American books");
      b.type = "button";
      b.setAttribute("role", "radio");
      b.addEventListener("click", () => {
        corpus = c;
        context.setParam("corpus", c === "en-US" ? "US" : null);
        renderToggle();
        s.draw();
      });
      toggle.append(b);
      return { c, b };
    });
    const renderToggle = () => {
      for (const { c, b } of corpusButtons) {
        const on = c === corpus;
        b.setAttribute("aria-checked", String(on));
        b.className = `rounded-full px-3 py-1.5 ${on ? "bg-nof-pink text-nof-pink-ink" : "text-nof-sub hover:text-nof-text"}`;
      }
    };
    controls.append(left, toggle);
    wrap.append(controls);

    const frame = el("div", "relative overflow-hidden rounded-2xl border border-nof-line bg-nof-night");
    wrap.append(frame);

    const note = el(
      "p",
      "font-nof-body text-xs leading-relaxed text-nof-muted",
      "Each line is scaled to its own peak, because \"mini\" and \"shoulder pads\" aren't fair fights in raw counts. The shaded bars underneath are when Wikipedia says people wore it. Books usually catch up years later, and some words moonlight as other things. Google Books Ngram (CC BY 3.0) to 2022, Wikipedia (CC BY-SA 4.0).",
    );
    if (!context.compact) wrap.append(note);

    const picked = () => slots.map((t, i) => (t ? { t, i } : null)).filter((x): x is { t: Trend; i: number } => !!x);
    const save = () => context.setParam("trends", picked().map(({ t }) => t.id).join(",") || null);

    const renderChips = () => {
      chips.replaceChildren(
        ...picked().map(({ t, i }) => {
          const chip = el("span", "inline-flex items-center gap-2 rounded-full border border-nof-line bg-nof-panel py-1 pl-3 pr-1 font-nof-body text-sm text-nof-text");
          chip.append(el("span", `h-2.5 w-2.5 rounded-full ${SWATCH[i]}`));
          chip.append(el("span", "", t.name));
          const x = el("button", "grid h-6 w-6 place-items-center rounded-full text-nof-muted hover:bg-nof-raised hover:text-nof-text", "×");
          x.type = "button";
          x.setAttribute("aria-label", `Remove ${t.name}`);
          x.addEventListener("click", () => {
            slots[i] = null;
            save();
            renderChips();
            s.draw();
          });
          chip.append(x);
          return chip;
        }),
      );
      search.disabled = picked().length >= 4;
      search.placeholder = search.disabled ? "Four's the limit. Remove one to swap" : "Add a trend, like corset or mullet";
    };

    const matches = (q: string) => {
      const query = q.trim().toLowerCase();
      if (!query) return [];
      const taken = new Set(picked().map(({ t }) => t.id));
      return nerds.trends
        .filter((t) => !taken.has(t.id) && hasCurve(t))
        .map((t) => {
          const name = t.name.toLowerCase();
          const score = name.startsWith(query) ? 0 : name.includes(query) ? 1 : t.aliases.some((a) => a.toLowerCase().includes(query)) ? 2 : 9;
          return { t, score };
        })
        .filter((x) => x.score < 9)
        .sort((a, b) => a.score - b.score || nerds.fame(b.t) - nerds.fame(a.t))
        .slice(0, 8)
        .map((x) => x.t);
    };
    const add = (t: Trend) => {
      const free = slots.findIndex((x) => !x);
      if (free < 0) return;
      slots[free] = t;
      search.value = "";
      results.classList.add("hidden");
      save();
      renderChips();
      s.draw();
    };
    const renderResults = () => {
      const list = matches(search.value);
      results.replaceChildren(
        ...list.map((t) => {
          const li = el("li", "");
          const b = el("button", "flex w-full items-baseline justify-between gap-3 px-4 py-2 text-left text-nof-text hover:bg-nof-panel focus:bg-nof-panel focus:outline-none");
          b.type = "button";
          b.setAttribute("role", "option");
          b.append(el("span", "", t.name), el("span", "font-mono text-[11px] text-nof-muted", t.category));
          b.addEventListener("click", () => add(t));
          li.append(b);
          return li;
        }),
      );
      if (!list.length && search.value.trim()) results.replaceChildren(el("li", "px-4 py-2 text-nof-muted", "Nothing in the books for that one"));
      results.classList.toggle("hidden", !search.value.trim());
    };
    search.addEventListener("input", renderResults);
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        const first = matches(search.value)[0];
        if (first) add(first);
      }
      if (event.key === "Escape") results.classList.add("hidden");
    });
    search.addEventListener("blur", () => setTimeout(() => results.classList.add("hidden"), 150));

    const colours = () => ({
      night: token("--color-nof-night", "#0e0d12"),
      line: token("--color-nof-line", "#302c3a"),
      text: token("--color-nof-text", "#f2eee6"),
      sub: token("--color-nof-sub", "#cfc9d6"),
      muted: token("--color-nof-muted", "#a39fae"),
      pink: token("--color-nof-pink", "#ff6fa8"),
      raised: token("--color-nof-raised", "#211e29"),
      series: SERIES_TOKENS.map((name, i) => token(name, SERIES_FALLBACK[i])),
    });

    let layout = { x0: 0, x1: 0, y0: 0, y1: 0 };
    const xOf = (year: number) => layout.x0 + ((year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * (layout.x1 - layout.x0);
    const yearAt = (x: number) => Math.round(FIRST_YEAR + ((x - layout.x0) / (layout.x1 - layout.x0)) * (LAST_YEAR - FIRST_YEAR));

    const s = stage(frame, {
      height: context.compact ? "min(56vh, 420px)" : "min(64vh, 520px)",
      label: "Line chart of how often each picked fashion trend appears in books from 1920 to 2022, with the years it was worn shaded below",
      render({ ctx, width, height }, pointer) {
        const c = colours();
        const narrow = width < 520;
        const list = picked();
        const lanes = Math.max(1, list.length);
        const laneH = 7;
        const laneGap = 4;
        const lanesH = lanes * (laneH + laneGap);
        layout = { x0: narrow ? 36 : 46, x1: width - (narrow ? 12 : 20), y0: 22, y1: height - 34 - lanesH - 10 };
        const { x0, x1, y0, y1 } = layout;
        ctx.fillStyle = c.night;
        ctx.fillRect(0, 0, width, height);

        // Recessive grid.
        ctx.font = FONT.mono(10);
        ctx.textBaseline = "middle";
        ctx.textAlign = "right";
        for (const v of [0, 0.5, 1]) {
          const y = y1 - v * (y1 - y0);
          ctx.strokeStyle = c.line;
          ctx.lineWidth = 1;
          ctx.globalAlpha = v === 0 ? 1 : 0.5;
          ctx.beginPath();
          ctx.moveTo(x0, y);
          ctx.lineTo(x1, y);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = c.muted;
          ctx.fillText(v === 1 ? "peak" : v === 0 ? "0" : "half", x0 - 6, y);
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const step = narrow ? 20 : 10;
        for (let year = FIRST_YEAR; year <= LAST_YEAR; year += step) {
          const x = xOf(year);
          ctx.fillStyle = c.muted;
          ctx.fillText(narrow ? `'${String(year).slice(2)}` : `${year}s`, x, height - 22);
          ctx.strokeStyle = c.line;
          ctx.globalAlpha = 0.35;
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y1);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        // Milestones on the axis.
        if (context.born) {
          for (const m of nerds.milestones(context.born)) {
            if (m.year > LAST_YEAR) continue;
            const x = xOf(m.year);
            ctx.strokeStyle = c.pink;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x, y1 + 2);
            ctx.lineTo(x, y1 + 8);
            ctx.stroke();
            if (m.key === "born" || m.key === "sixteen") {
              ctx.fillStyle = c.pink;
              ctx.font = FONT.mono(9, 700);
              ctx.fillText(m.key === "born" ? "you" : "16", x, height - 34 + (narrow ? 0 : 0));
              ctx.font = FONT.mono(10);
            }
          }
        }

        if (!list.length) {
          ctx.fillStyle = c.muted;
          ctx.font = FONT.body(14);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText("Add a trend to start reading", (x0 + x1) / 2, (y0 + y1) / 2);
          return;
        }

        // Hover state.
        hoverYear = pointer.inside && pointer.x >= x0 - 10 && pointer.x <= x1 + 10 ? clamp(yearAt(pointer.x), FIRST_YEAR, LAST_YEAR) : null;
        focus = null;
        if (hoverYear !== null && pointer.y < y1) {
          let best = 22;
          for (const { t, i } of list) {
            const shape = nerds.shape(t, corpus);
            if (!shape) continue;
            const y = y1 - (shape[hoverYear - FIRST_YEAR] ?? 0) * (y1 - y0);
            const d = Math.abs(y - pointer.y);
            if (d < best) (best = d), (focus = i);
          }
        }

        // Worn lanes, under the axis.
        list.forEach(({ t, i }, lane) => {
          const y = y1 + 14 + lane * (laneH + laneGap);
          ctx.fillStyle = c.raised;
          ctx.fillRect(x0, y, x1 - x0, laneH);
          ctx.fillStyle = c.series[i];
          ctx.globalAlpha = focus === null || focus === i ? 0.9 : 0.35;
          for (const p of t.periods) {
            const a = xOf(clamp(p.start, FIRST_YEAR, LAST_YEAR));
            const b = xOf(clamp(p.end + 1, FIRST_YEAR, LAST_YEAR));
            if (b > a) ctx.fillRect(a, y, Math.max(2, b - a), laneH);
          }
          ctx.globalAlpha = 1;
        });
        ctx.fillStyle = c.muted;
        ctx.font = FONT.mono(9);
        ctx.textAlign = "left";
        ctx.textBaseline = "bottom";
        if (!narrow) ctx.fillText("worn", 4, y1 + 14 + laneH + 1);

        // Focused trend: shade its worn years full height.
        if (focus !== null) {
          const t = slots[focus]!;
          ctx.fillStyle = c.series[focus];
          ctx.globalAlpha = 0.1;
          for (const p of t.periods) {
            const a = xOf(clamp(p.start, FIRST_YEAR, LAST_YEAR));
            const b = xOf(clamp(p.end + 1, FIRST_YEAR, LAST_YEAR));
            if (b > a) ctx.fillRect(a, y0, b - a, y1 - y0);
          }
          ctx.globalAlpha = 1;
        }

        // Lines, with a surface ring so crossings stay readable.
        const peaks: { x: number; y: number; i: number; name: string }[] = [];
        for (const { t, i } of list) {
          const shape = nerds.shape(t, corpus);
          if (!shape) continue;
          const dim = focus !== null && focus !== i;
          const trace = () => {
            ctx.beginPath();
            shape.forEach((v, k) => {
              const year = FIRST_YEAR + k;
              if (year > LAST_YEAR) return;
              const x = xOf(year);
              const y = y1 - v * (y1 - y0);
              if (k === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            });
          };
          trace();
          ctx.strokeStyle = c.night;
          ctx.lineWidth = 5;
          ctx.lineJoin = "round";
          ctx.stroke();
          trace();
          ctx.strokeStyle = c.series[i];
          ctx.globalAlpha = dim ? 0.3 : 1;
          ctx.lineWidth = focus === i ? 2.6 : 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
          const k = shape.indexOf(1);
          peaks.push({ x: xOf(FIRST_YEAR + k), y: y0 + 0, i, name: t.name });
        }

        // Direct labels at each peak, nudged apart.
        ctx.font = FONT.body(narrow ? 11 : 12, 600);
        ctx.textBaseline = "bottom";
        const taken: { x: number; y: number; w: number }[] = [];
        for (const p of peaks.sort((a, b) => a.x - b.x)) {
          const w = ctx.measureText(p.name).width;
          let x = clamp(p.x - w / 2, x0, x1 - w);
          let y = p.y - 4;
          while (taken.some((q) => Math.abs(q.y - y) < 14 && x < q.x + q.w + 6 && x + w + 6 > q.x)) y += 15;
          taken.push({ x, y, w });
          ctx.fillStyle = c.night;
          ctx.globalAlpha = 0.75;
          ctx.fillRect(x - 3, y - 14, w + 6, 15);
          ctx.globalAlpha = 1;
          ctx.fillStyle = focus === null || focus === p.i ? c.text : c.muted;
          ctx.textAlign = "left";
          ctx.fillText(p.name, x, y);
          ctx.fillStyle = c.series[p.i];
          ctx.fillRect(x - 3, y, w + 6, 2);
        }

        // Crosshair and tooltip.
        if (hoverYear !== null) {
          const x = xOf(hoverYear);
          ctx.strokeStyle = c.sub;
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(x, y1);
          ctx.stroke();
          ctx.globalAlpha = 1;
          const rows = list
            .map(({ t, i }) => {
              const shape = nerds.shape(t, corpus);
              const v = shape?.[hoverYear! - FIRST_YEAR] ?? 0;
              const worn = t.periods.some((p) => hoverYear! >= p.start && hoverYear! <= p.end);
              const y = y1 - v * (y1 - y0);
              ctx.beginPath();
              ctx.arc(x, y, 4.5, 0, Math.PI * 2);
              ctx.fillStyle = c.series[i];
              ctx.fill();
              ctx.strokeStyle = c.night;
              ctx.lineWidth = 2;
              ctx.stroke();
              return { t, i, v, worn };
            })
            .sort((a, b) => b.v - a.v);
          const lines = rows.map((r) => `${r.t.name}  ${Math.round(r.v * 100)}%${r.worn ? "  worn" : ""}`);
          let head = String(hoverYear);
          if (context.born) {
            const age = hoverYear - context.born;
            if (age >= 0) head += `  ·  you were ${age}`;
          }
          ctx.font = FONT.mono(11, 500);
          const w = Math.max(ctx.measureText(head).width, ...lines.map((l) => ctx.measureText(l).width)) + 34;
          const h = 26 + lines.length * 17;
          let tx = x + 14;
          if (tx + w > width - 6) tx = x - 14 - w;
          tx = clamp(tx, 6, width - w - 6);
          const ty = y0 + 6;
          ctx.fillStyle = c.raised;
          ctx.globalAlpha = 0.96;
          ctx.beginPath();
          ctx.roundRect(tx, ty, w, h, 10);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.strokeStyle = c.line;
          ctx.stroke();
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillStyle = c.text;
          ctx.font = FONT.mono(11, 700);
          ctx.fillText(head, tx + 10, ty + 8);
          ctx.font = FONT.mono(11, 500);
          rows.forEach((r, k) => {
            const ly = ty + 26 + k * 17;
            ctx.fillStyle = c.series[r.i];
            ctx.fillRect(tx + 10, ly + 3, 10, 3);
            ctx.fillStyle = r.worn ? c.text : c.sub;
            ctx.fillText(lines[k], tx + 26, ly);
          });
        }
      },
    });
    s.canvas.classList.add("cursor-crosshair");

    renderChips();
    renderToggle();

    return {
      destroy() {
        s.destroy();
        root.replaceChildren();
      },
      update(params) {
        if (params.trends) setSlots(fromParams(params.trends));
        if (params.corpus) corpus = params.corpus === "US" ? "en-US" : "en-GB";
        renderChips();
        renderToggle();
        s.draw();
      },
    };
  },
};

export default view;
