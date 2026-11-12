// "How late are the books?": for every trend whose mentions in British books have peaked,
// the years from a wave starting to that peak.

import { token, type Trend } from "../data";
import { binned, bookLag, median, waveBefore, type BookLag } from "../forecast";
import { FONT, stage } from "../stage";
import type { View } from "../view";
import { el, figures, legend, names, tooltip, trendPicker, withForecast, yrs } from "../viewkit";

const BIN = 5;

const view: View = {
  id: "lag",
  tab: "words",
  title: "How late are the books?",
  blurb: "The years between a look hitting the street and British books banging on about it most",
  how: "Hover or tap a bar to see which trends were written up that late. Pick a trend to see its own delay.",
  sources: ["ngram", "wikipedia"],
  order: 2,
  mount(host, context) {
    const { nerds } = context;
    return withForecast(host, (file, root) => {
      const { from, to } = nerds.data.series.ngramYears;
      const lagOf = (trend: Trend) => (trend.ngram?.["en-GB"]?.length ? bookLag(nerds.shape(trend, "en-GB"), from, file.trends[trend.id]?.waves ?? []) : null);
      const all = nerds.trends.map((trend) => ({ trend, lag: lagOf(trend) }));
      const measured = all.filter((entry): entry is { trend: Trend; lag: BookLag } => !!entry.lag);
      const settled = measured.filter((entry) => !entry.lag.climbing);
      const climbing = measured.length - settled.length;
      const typical = Math.round(median(settled.map((entry) => entry.lag.lag)));
      const late = settled.filter((entry) => entry.lag.lag > 0).length;
      // The same sum with the peak in every possible year, to show how much of the delay the method makes up by itself.
      const hat = Math.round(
        median(
          settled.flatMap((entry) => {
            const waves = file.trends[entry.trend.id].waves;
            return Array.from({ length: to - 1 - from }, (_, i) => from + i - waveBefore(waves, from + i));
          }),
        ),
      );
      const real = typical - hat >= 3;
      const bins = binned(settled, (entry) => entry.lag.lag, BIN);
      const low = bins[0]?.low ?? 0;
      const high = (bins.at(-1)?.low ?? 0) + BIN;
      const tallest = Math.max(1, ...bins.map((bin) => bin.items.length));
      let marked: number | undefined;

      root.append(
        el(
          "p",
          "max-w-3xl font-nof-display text-[22px] leading-snug font-bold sm:text-[26px]",
          typical > 0
            ? `Books lag clothes: the writing peaks a typical ${yrs(typical)} after the wave kicks off, and ${late} of ${settled.length} trends peaked in print after they hit the street. Pull the peak year out of a hat and you'd get ${yrs(hat)}, so ${real ? "the lag is real, just smaller than it looks." : "don't read much into it."}`
            : `Plot twist: the writing typically peaks ${typical < 0 ? `${yrs(-typical)} before` : "the same year"} the wave kicks off. Only ${late} of ${settled.length} trends peaked in print after they hit the street.`,
        ),
        figures([
          [`${typical}`, "years from a wave starting to its peak in British books, typically"],
          [`${hat}`, "years if the books peaked in a year picked out of a hat. The gap between the two is the real lag"],
          [`${climbing}`, `more with no peak yet: books were still warming up when the data stops in ${to}`],
        ]),
      );

      const frame = el("div", "relative overflow-hidden rounded-xl border border-nof-line bg-nof-panel");
      root.append(frame);
      const tip = tooltip(frame);

      const st = stage(frame, {
        height: context.compact ? "min(40vh, 300px)" : "min(46vh, 380px)",
        label: `Histogram of ${settled.length} trends by years from a wave starting to the peak of its mentions in British books. Typical delay ${yrs(typical)}.`,
        render({ ctx, width, height }, pointer) {
          const pad = { left: 34, right: 14, top: 28, bottom: 44 };
          const base = height - pad.bottom;
          const x = (lag: number) => pad.left + ((lag - low) / (high - low || 1)) * (width - pad.left - pad.right);
          const y = (count: number) => base - (count / tallest) * (base - pad.top);
          const muted = token("--color-nof-muted", "#a39fae");
          const text = token("--color-nof-text", "#f2eee6");
          const pink = token("--color-nof-pink", "#ff6fa8");
          ctx.fillStyle = token("--color-nof-panel", "#17151d");
          ctx.fillRect(0, 0, width, height);

          ctx.strokeStyle = token("--color-nof-line", "#302c3a");
          ctx.fillStyle = muted;
          ctx.font = FONT.mono(10);
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          for (let count = 0; count <= tallest; count += tallest > 30 ? 10 : 5) {
            const py = Math.round(y(count)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(pad.left, py);
            ctx.lineTo(width - pad.right, py);
            ctx.stroke();
            ctx.fillText(`${count}`, pad.left - 6, py);
          }
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          const tick = width < 520 ? 40 : 20;
          for (let lag = Math.ceil(low / tick) * tick; lag <= high; lag += tick) ctx.fillText(`${lag}`, x(lag), base + 24);
          ctx.fillText(width < 520 ? "years from wave start to peak in books" : "years from a wave starting to its peak in British books", (pad.left + width - pad.right) / 2, height - 5);

          const bw = x(low + BIN) - x(low);
          const hover = pointer.inside && pointer.x > pad.left && pointer.x < width - pad.right && pointer.y < base ? Math.floor((pointer.x - pad.left) / bw) : -1;
          for (const [i, bin] of bins.entries()) {
            if (!bin.items.length) continue;
            ctx.fillStyle = i === hover ? pink : bin.low < 0 ? token("--color-nof-scenes", "#e2703a") : token("--color-nof-clothes", "#5b8ef0");
            ctx.beginPath();
            ctx.roundRect(x(bin.low) + 1, y(bin.items.length), Math.max(1, bw - 2), base - y(bin.items.length), [3, 3, 0, 0]);
            ctx.fill();
          }

          const rule = (lag: number, label: string, dash: number[], align: CanvasTextAlign) => {
            const px = Math.round(x(lag)) + 0.5;
            ctx.strokeStyle = text;
            ctx.lineWidth = 1.5;
            ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(px, pad.top - 8);
            ctx.lineTo(px, base);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = text;
            ctx.font = FONT.mono(10, 600);
            ctx.textAlign = align;
            ctx.fillText(label, px + (align === "left" ? 5 : -5), pad.top - 12);
          };
          if (low < 0) rule(0, "on time", [], "right");
          rule(typical + 0.5, `typical ${typical}`, [4, 4], "left");
          ctx.globalAlpha = 0.6;
          rule(hat + 0.5, "", [1, 4], "left");
          ctx.globalAlpha = 1;

          if (marked !== undefined) {
            const px = x(marked + 0.5);
            ctx.fillStyle = text;
            ctx.beginPath();
            ctx.moveTo(px, base + 2);
            ctx.lineTo(px + 5, base + 11);
            ctx.lineTo(px - 5, base + 11);
            ctx.closePath();
            ctx.fill();
          }

          const bin = bins[hover];
          if (bin?.items.length) tip.show(x(bin.low + BIN / 2), y(bin.items.length), [`${bin.low} to ${bin.low + BIN - 1} years · ${bin.items.length} trend${bin.items.length === 1 ? "" : "s"}`, names(bin.items.map((entry) => entry.trend))]);
          else tip.hide();
        },
      });

      root.append(
        legend([
          ["h-2.5 w-2.5 rounded-sm bg-nof-clothes", "books peaked after the wave began"],
          ["h-2.5 w-2.5 rounded-sm bg-nof-scenes", "books got there first"],
          ["w-5 border-t-2 border-dashed border-nof-text", "the typical delay"],
          ["w-5 border-t-2 border-dotted border-nof-muted", `the delay a random peak year would show, ${yrs(hat)}`],
          ["h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-nof-text", "your trend"],
        ]),
      );

      const picker = trendPicker(nerds.trends, "Check one trend", "Nobody in particular");
      const verdict = el("p", "text-[15px] leading-relaxed text-nof-sub");
      if (!context.compact)
        root.append(
          picker.field,
          verdict,
          el(
            "p",
            "max-w-3xl text-[12px] leading-relaxed text-nof-muted",
            `${climbing} trends are missing because books were still writing about them more every year when the data stops in ${to}, so they have no peak yet. Another ${all.length - measured.length} have no book curve at all. And some words moonlight (Paisley is also a town), which is where the silliest bars at either end come from. Each delay counts from the latest wave that had started by the time the books peaked.`,
          ),
        );

      const pick = (id: string | undefined) => {
        const entry = all.find((candidate) => candidate.trend.id === id);
        picker.select.value = entry ? entry.trend.id : "";
        marked = entry?.lag && !entry.lag.climbing ? entry.lag.lag : undefined;
        if (!entry) verdict.textContent = "";
        else if (!entry.lag) verdict.textContent = `${entry.trend.name} has no British book curve, so there's nothing to time.`;
        else if (entry.lag.climbing) verdict.textContent = `${entry.trend.name}: books were still writing more about it every year when the data stops in ${to}, so it has no peak to measure yet.`;
        else {
          const { waveStart, peak, lag } = entry.lag;
          verdict.textContent = `${entry.trend.name}: the wave started in ${waveStart} and British books peaked in ${peak}. ${lag > 0 ? `${yrs(lag)} late.` : lag < 0 ? `The books got there ${yrs(-lag)} early, which is suspicious.` : "Bang on time, for once."}`;
        }
        st.draw();
      };
      const onChange = () => {
        context.setParam("trend", picker.select.value || null);
        pick(picker.select.value);
      };
      picker.select.addEventListener("change", onChange);
      pick(context.params.trend ?? "miniskirt");

      return {
        update: (params) => pick(params.trend),
        destroy() {
          picker.select.removeEventListener("change", onChange);
          st.destroy();
        },
      };
    });
  },
};

export default view;
