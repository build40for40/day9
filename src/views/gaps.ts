import { FIRST_YEAR, NOW_YEAR, clamp, token, type Trend } from "../data";
import { FONT, stage } from "../stage";
import type { View } from "../view";

const BIN = 5;

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
      let left = x + 14;
      if (left + w > parent.clientWidth - 4) left = x - 14 - w;
      box.style.left = `${Math.max(4, left)}px`;
      box.style.top = `${clamp(y - h - 10, 4, Math.max(4, parent.clientHeight - h - 4))}px`;
    },
    hide: () => box.classList.add("hidden"),
  };
}

const pct = (value: number) => `${Math.round(value * 100)}%`;

const view: View = {
  id: "gaps",
  tab: "comebacks",
  title: "How long until it's back?",
  blurb: "Every comeback Wikipedia has noticed, sorted by how long the trend sulked first",
  how: "Hover or tap a bar to see which trends took that long. Then pick a trend and get its odds.",
  sources: ["wikipedia"],
  order: 2,
  mount(host, context) {
    const { nerds } = context;
    const comebacks = nerds.waits().filter((w) => w.gap > 0);
    const stats = nerds.gapStats();
    const maxGap = Math.max(...stats.gaps);
    const bins = Array.from({ length: Math.ceil((maxGap + 1) / BIN) }, (_, i) => comebacks.filter((c) => c.gap >= i * BIN && c.gap < (i + 1) * BIN).sort((a, b) => a.gap - b.gap));
    const tallest = Math.max(...bins.map((bin) => bin.length));

    const root = el("div", "flex flex-col gap-5 font-nof-body text-nof-text");
    host.append(root);

    const head = el("div", "flex flex-wrap items-end gap-x-8 gap-y-2");
    const figure = (value: string, label: string) => {
      const box = el("div");
      box.append(el("p", "font-nof-display text-[44px] leading-none font-bold text-nof-gold", value), el("p", "mt-1 text-[13px] text-nof-muted", label));
      return box;
    };
    head.append(figure(`${stats.median}`, "years, the typical wait (median)"), figure(`${Math.round(stats.mean)}`, "years on average, dragged up by a few very patient ones"), figure(`${stats.count}`, "comebacks counted, wave to wave"));
    root.append(head);

    const frame = el("div", "relative overflow-hidden rounded-xl border border-nof-line bg-nof-panel");
    root.append(frame);
    const tip = tooltip(frame);
    let hoverBin = -1;

    const st = stage(frame, {
      height: context.compact ? "min(40vh, 300px)" : "min(44vh, 360px)",
      label: `Histogram of ${stats.count} fashion comebacks by years from one wave starting to the next. Median ${stats.median} years.`,
      render({ ctx, width, height }, pointer) {
        const pad = { left: 34, right: 14, top: 30, bottom: 34 };
        const bw = (width - pad.left - pad.right) / bins.length;
        const x = (gap: number) => pad.left + (gap / BIN) * bw;
        const y = (count: number) => height - pad.bottom - (count / tallest) * (height - pad.top - pad.bottom);
        const panel = token("--color-nof-panel", "#17151d");
        const line = token("--color-nof-line", "#302c3a");
        const muted = token("--color-nof-muted", "#a39fae");
        const text = token("--color-nof-text", "#f2eee6");
        const gold = token("--color-nof-gold", "#e8c27a");
        const pink = token("--color-nof-pink", "#ff6fa8");
        ctx.fillStyle = panel;
        ctx.fillRect(0, 0, width, height);

        // Recessive gridlines.
        ctx.strokeStyle = line;
        ctx.fillStyle = muted;
        ctx.font = FONT.mono(10);
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        const step = tallest > 30 ? 10 : 5;
        for (let c = 0; c <= tallest; c += step) {
          const py = Math.round(y(c)) + 0.5;
          ctx.beginPath();
          ctx.moveTo(pad.left, py);
          ctx.lineTo(width - pad.right, py);
          ctx.stroke();
          ctx.fillText(`${c}`, pad.left - 6, py);
        }
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        const tick = width < 520 ? 20 : 10;
        for (let gap = 0; gap <= bins.length * BIN; gap += tick) ctx.fillText(`${gap}`, x(gap), height - pad.bottom + 16);
        ctx.fillText("years between the original and the comeback", (pad.left + width - pad.right) / 2, height - 4);

        hoverBin = pointer.inside && pointer.x > pad.left && pointer.x < width - pad.right ? Math.floor((pointer.x - pad.left) / bw) : -1;
        for (const [i, bin] of bins.entries()) {
          if (!bin.length) continue;
          ctx.fillStyle = i === hoverBin ? pink : gold;
          const top = y(bin.length);
          ctx.beginPath();
          ctx.roundRect(x(i * BIN) + 1, top, Math.max(1, bw - 2), height - pad.bottom - top, [4, 4, 0, 0]);
          ctx.fill();
        }

        // Median and mean.
        const marker = (gap: number, label: string, row: number) => {
          const px = Math.round(x(gap)) + 0.5;
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = text;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(px, pad.top - 6 + row * 12);
          ctx.lineTo(px, height - pad.bottom);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = text;
          ctx.font = FONT.mono(11, 600);
          ctx.textAlign = "left";
          ctx.fillText(label, px + 4, pad.top - 10 + row * 12);
        };
        marker(stats.median, `median ${stats.median}`, 0);
        marker(stats.mean, `mean ${Math.round(stats.mean)}`, 1);

        if (hoverBin >= 0 && bins[hoverBin]?.length) {
          const bin = bins[hoverBin];
          tip.show(x(hoverBin * BIN + BIN / 2), y(bin.length), (box) => {
            box.append(el("p", "font-mono text-[12px] font-semibold text-nof-pink", `${hoverBin * BIN} to ${hoverBin * BIN + BIN - 1} years · ${bin.length} comeback${bin.length === 1 ? "" : "s"}`));
            for (const c of bin.slice(0, 7)) box.append(el("p", "mt-1", `${c.subject}: on in ${c.from}, back in ${c.to}`));
            if (bin.length > 7) box.append(el("p", "mt-1 text-nof-muted", `and ${bin.length - 7} more`));
          });
        } else tip.hide();
      },
    });

    // Is it back yet?
    const candidates = nerds.trends.filter((trend) => trend.periods.length).sort((a, b) => a.name.localeCompare(b.name));
    const panel = el("section", "rounded-xl border border-nof-line bg-nof-panel p-4 sm:p-6");
    root.append(panel);
    panel.append(el("h3", "font-nof-display text-[28px] leading-tight font-bold", "Is it back yet?"));
    const field = el("label", "mt-3 flex flex-col gap-1 text-[13px] text-nof-muted");
    field.append(el("span", "", "Pick a trend from your loft"));
    const select = el("select", "w-full max-w-md rounded-lg border border-nof-line bg-nof-raised px-3 py-2.5 text-[15px] text-nof-text focus:border-nof-pink focus:outline-none");
    for (const trend of candidates) {
      const option = el("option", "", trend.name);
      option.value = trend.id;
      select.append(option);
    }
    field.append(select);
    panel.append(field);
    const answer = el("div", "mt-5");
    panel.append(answer);
    panel.append(el("p", "mt-4 text-[12px] leading-relaxed text-nof-muted", `How the odds work: of the ${stats.count} comebacks Wikipedia writes about, we look at the ones that had already stayed away this long, and count how many came back within the next 5 or 10 years. It's history, not a promise.`));

    const show = (trend: Trend) => {
      answer.replaceChildren();
      let last = 0;
      for (let year = FIRST_YEAR; year <= NOW_YEAR; year++) if (nerds.presence(trend, year) > 0.5) last = year;
      const onNow = nerds.presence(trend, NOW_YEAR) > 0.5 || last >= NOW_YEAR - 1;
      if (!last) {
        answer.append(el("p", "text-[15px] text-nof-sub", "We can't find a year it was properly on, so we can't call it. Very niche of you."));
        return;
      }
      const since = NOW_YEAR - last;
      const grid = el("div", "grid grid-cols-3 gap-3");
      const big = (value: string, label: string, accent = false) => {
        const box = el("div", "rounded-lg bg-nof-raised px-3 py-3");
        box.append(el("p", `font-nof-display text-[34px] leading-none font-bold sm:text-[44px] ${accent ? "text-nof-pink" : "text-nof-text"}`, value), el("p", "mt-1 text-[12px] leading-snug text-nof-muted", label));
        return box;
      };
      if (onNow) {
        grid.append(big("Now", "it's on right now", true), big(`${trend.periods.length}`, "times it's been on"), big(`${nerds.waits().filter((c) => c.trend === trend.id).length}`, "comebacks on record"));
        answer.append(grid, el("p", "mt-4 font-nof-display text-[20px] italic text-nof-sub", "It's on right now. Wear it before it isn't."));
        return;
      }
      const five = nerds.comebackOdds(since, 5);
      const ten = nerds.comebackOdds(since, 10);
      grid.append(big(`${since}`, `years since it was last on, in ${last}`), big(pct(five), "chance it's back within 5 years", true), big(pct(ten), "within 10 years"));
      answer.append(grid);
      const verdict = ten >= 0.5 ? "Dig it out of the loft. Its moment is coming." : ten >= 0.25 ? "Keep it in the loft, but near the front." : since > maxGap ? "Older than any comeback on record. Museum, not wardrobe." : "Charity shop. Honestly.";
      answer.append(el("p", "mt-4 font-nof-display text-[20px] italic text-nof-sub", verdict));
      if (context.born && last >= context.born) answer.append(el("p", "mt-1 text-[14px] text-nof-muted", `It was last on when you were ${last - context.born}.`));
    };

    const pick = (id: string | undefined) => {
      const trend = (id && nerds.byId.get(id)) || nerds.byId.get("go-go-boots") || candidates[0];
      select.value = trend.id;
      show(trend);
    };
    select.addEventListener("change", () => {
      context.setParam("trend", select.value);
      pick(select.value);
    });
    pick(context.params.trend);

    return {
      update(params) {
        pick(params.trend);
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
