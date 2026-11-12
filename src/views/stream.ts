import { FAMILIES, FIRST_YEAR, NOW_YEAR, clamp, familyOf, token, years, type Family } from "../data";
import { FONT, stage } from "../stage";
import type { View } from "../view";

const ORDER: Family[] = ["clothes", "scenes", "kit", "face"];
const DOT: Record<Family, string> = { clothes: "bg-nof-clothes", scenes: "bg-nof-scenes", kit: "bg-nof-kit", face: "bg-nof-face" };
const FALLBACK: Record<Family, string> = { clothes: "#5b8ef0", scenes: "#e2703a", kit: "#1fa583", face: "#a970da" };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function tooltip(parent: HTMLElement) {
  const box = el("div", "pointer-events-none absolute z-20 hidden w-max max-w-[280px] rounded-lg border border-nof-line bg-nof-raised px-3 py-2 font-nof-body text-[13px] leading-snug text-nof-text shadow-lg");
  parent.append(box);
  return {
    show(x: number, y: number, build: (box: HTMLElement) => void) {
      box.replaceChildren();
      build(box);
      box.classList.remove("hidden");
      const w = box.offsetWidth;
      const h = box.offsetHeight;
      let left = x + 16;
      if (left + w > parent.clientWidth - 4) left = x - 16 - w;
      let top = y - h / 2;
      top = clamp(top, 4, Math.max(4, parent.clientHeight - h - 4));
      box.style.left = `${Math.max(4, left)}px`;
      box.style.top = `${top}px`;
    },
    hide: () => box.classList.add("hidden"),
  };
}

const view: View = {
  id: "stream",
  tab: "trends",
  title: "The River of Trends",
  blurb: "How much was going on in each corner of fashion, every year since 1920",
  how: "Hover or touch the river to see the year's biggest trends in each family.",
  sources: ["wikipedia"],
  order: 3,
  mount(host, context) {
    const { nerds } = context;
    const all = years();
    const m = all.length;

    // Sum of presence per family per year.
    const values = ORDER.map((family) => all.map((year) => nerds.trends.filter((trend) => familyOf(trend.category) === family).reduce((sum, trend) => sum + nerds.presence(trend, year), 0)));

    // Centred baseline (a "silhouette" stream), so the river is symmetric and easy to read.
    const base = all.map((_, i) => -values.reduce((sum, row) => sum + row[i], 0) / 2);
    const lower = ORDER.map((_, j) => all.map((_, i) => base[i] + values.slice(0, j).reduce((sum, row) => sum + row[i], 0)));
    const upper = ORDER.map((_, j) => all.map((_, i) => lower[j][i] + values[j][i]));
    const lo = Math.min(...lower[0]);
    const hi = Math.max(...upper[ORDER.length - 1]);

    // Candidate labels: each family's top trend in every year, tried fattest first at draw time.
    const names = ORDER.map((family) => all.map((year) => nerds.top(year, 1, (trend) => familyOf(trend.category) === family)[0]?.name ?? ""));
    const byThickness = ORDER.map((_, j) => all.map((_, i) => i).sort((a, b) => values[j][b] - values[j][a]));

    const root = el("div", "flex flex-col gap-3 font-nof-body text-nof-text");
    host.append(root);
    const legend = el("ul", "flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-nof-sub");
    for (const family of ORDER) {
      const item = el("li", "inline-flex items-center gap-2");
      item.append(el("span", `size-2.5 rounded-full ${DOT[family]}`), el("span", "", FAMILIES[family].label));
      legend.append(item);
    }
    root.append(legend);
    const frame = el("div", "relative overflow-hidden rounded-xl border border-nof-line bg-nof-panel");
    root.append(frame);
    const tip = tooltip(frame);
    if (!context.compact) root.append(el("p", "text-[13px] text-nof-muted", "Thickness is how many trends in each family were on that year, counted from Wikipedia's decade articles. It's a measure of how much got written about, not how many people wore it."));

    let focus: number | null = context.params.year ? clamp(Number(context.params.year), FIRST_YEAR, NOW_YEAR) : null;

    const st = stage(frame, {
      height: context.compact ? "min(52vh, 420px)" : "min(62vh, 560px)",
      label: "Streamgraph of fashion trends by family from 1920 to now",
      render({ ctx, width, height }, pointer) {
        const pad = { left: 12, right: 12, top: context.born ? 26 : 14, bottom: 26 };
        const x = (i: number) => pad.left + (i / (m - 1)) * (width - pad.left - pad.right);
        const y = (v: number) => pad.top + ((v - lo) / (hi - lo)) * (height - pad.top - pad.bottom);
        const panel = token("--color-nof-panel", "#17151d");
        const line = token("--color-nof-line", "#302c3a");
        const muted = token("--color-nof-muted", "#a39fae");
        const text = token("--color-nof-text", "#f2eee6");
        const gold = token("--color-nof-gold", "#e8c27a");
        const night = token("--color-nof-night", "#0e0d12");
        ctx.fillStyle = panel;
        ctx.fillRect(0, 0, width, height);

        // Recessive decade grid and labels.
        ctx.strokeStyle = line;
        ctx.lineWidth = 1;
        ctx.fillStyle = muted;
        ctx.font = FONT.mono(10);
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        for (let decade = 1920; decade <= 2020; decade += 10) {
          const px = Math.round(x(decade - FIRST_YEAR)) + 0.5;
          ctx.beginPath();
          ctx.moveTo(px, pad.top);
          ctx.lineTo(px, height - pad.bottom);
          ctx.stroke();
          if (width >= 520 || decade % 20 === 0) ctx.fillText(width < 520 ? `'${String(decade).slice(2)}` : `${decade}`, px, height - 8);
        }

        // Bands, smoothed through midpoints, with a 2px gap of panel colour between them.
        const trace = (edge: number[], reverse: boolean) => {
          const idx = edge.map((_, i) => i);
          if (reverse) idx.reverse();
          const pts = idx.map((i) => [x(i), y(edge[i])]);
          if (!reverse) ctx.moveTo(pts[0][0], pts[0][1]);
          else ctx.lineTo(pts[0][0], pts[0][1]);
          for (let k = 1; k < pts.length - 1; k++) ctx.quadraticCurveTo(pts[k][0], pts[k][1], (pts[k][0] + pts[k + 1][0]) / 2, (pts[k][1] + pts[k + 1][1]) / 2);
          ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
        };
        for (let j = 0; j < ORDER.length; j++) {
          ctx.beginPath();
          trace(upper[j], false);
          trace(lower[j], true);
          ctx.closePath();
          ctx.fillStyle = token(FAMILIES[ORDER[j]].token, FALLBACK[ORDER[j]]);
          ctx.fill();
          ctx.strokeStyle = panel;
          ctx.lineWidth = 2;
          ctx.stroke();
        }

        // Direct labels inside the bands, only where they fit.
        ctx.font = FONT.body(width < 520 ? 11 : 13, 700);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = night;
        const stepX = (width - pad.left - pad.right) / (m - 1);
        const most = width < 520 ? 2 : 3;
        for (let j = 0; j < ORDER.length; j++) {
          const placed: { i: number; name: string }[] = [];
          for (const i of byThickness[j]) {
            if (placed.length >= most) break;
            const name = names[j][i];
            if (!name || placed.some((p) => Math.abs(p.i - i) < 28 || p.name === name)) continue;
            const tw = ctx.measureText(name).width;
            const cx = clamp(x(i), pad.left + tw / 2 + 4, width - pad.right - tw / 2 - 4);
            const cy = (y(upper[j][i]) + y(lower[j][i])) / 2;
            // The text must sit inside the band along its whole width, not just at its centre.
            const from = clamp(Math.floor((cx - tw / 2 - pad.left) / stepX), 0, m - 1);
            const to = clamp(Math.ceil((cx + tw / 2 - pad.left) / stepX), 0, m - 1);
            let fits = true;
            for (let k = from; k <= to && fits; k++) fits = y(lower[j][k]) + 1 <= cy - 7 && y(upper[j][k]) - 1 >= cy + 7;
            if (!fits) continue;
            ctx.fillText(name, cx, cy);
            placed.push({ i, name });
          }
        }

        // Your milestones.
        if (context.born) {
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = gold;
          ctx.fillStyle = gold;
          ctx.font = FONT.mono(10, 600);
          ctx.textBaseline = "alphabetic";
          for (const milestone of nerds.milestones(context.born)) {
            const px = Math.round(x(milestone.year - FIRST_YEAR)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(px, pad.top - 4);
            ctx.lineTo(px, height - pad.bottom);
            ctx.stroke();
            if (milestone.age === 0 || milestone.age === 16 || (width >= 520 && milestone.age !== 13 && milestone.age !== 19)) {
              ctx.textAlign = "center";
              ctx.fillText(milestone.age === 0 ? "you" : `${milestone.age}`, clamp(px, 14, width - 14), 14);
            }
          }
          ctx.setLineDash([]);
        }

        // Crosshair and tooltip.
        const active = pointer.inside ? clamp(Math.round(((pointer.x - pad.left) / (width - pad.left - pad.right)) * (m - 1)), 0, m - 1) + FIRST_YEAR : focus;
        if (active !== null) {
          const px = Math.round(x(active - FIRST_YEAR)) + 0.5;
          ctx.strokeStyle = text;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, pad.top - 4);
          ctx.lineTo(px, height - pad.bottom);
          ctx.stroke();
          const count = width < 520 ? 3 : 5;
          tip.show(px, pointer.inside ? pointer.y : height / 2, (box) => {
            box.append(el("p", "font-mono text-[12px] font-semibold text-nof-pink", `${active}`));
            for (const family of ORDER) {
              const names = nerds.top(active, count, (trend) => familyOf(trend.category) === family).map((trend) => trend.name);
              const row = el("p", "mt-1 flex gap-2");
              row.append(el("span", `mt-1.5 size-2 shrink-0 rounded-full ${DOT[family]}`), el("span", names.length ? "" : "text-nof-muted", names.join(", ") || "Nothing much"));
              box.append(row);
            }
          });
        } else tip.hide();
      },
    });

    return {
      update(params) {
        focus = params.year ? clamp(Number(params.year), FIRST_YEAR, NOW_YEAR) : null;
        st.draw();
      },
      destroy() {
        st.destroy();
        root.remove();
      },
    };
  },
};

export default view;
