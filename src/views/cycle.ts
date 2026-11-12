// The "20 to 30 year cycle" on trial: every wait between two waves of the same trend,
// against the claim and against the curve the forecast model fitted to them.

import { token } from "../data";
import { lognormalPdf, median, waveGaps } from "../forecast";
import { FONT, stage } from "../stage";
import type { View } from "../view";
import { el, figures, legend, names, pct, tooltip, trendPicker, withForecast, yrs } from "../viewkit";

const BIN = 5;
const CLAIM = { from: 20, to: 30 };

const view: View = {
  id: "cycle",
  tab: "comebacks",
  title: "The 20 year rule, on trial",
  blurb: "Fashion writers swear everything returns after 20 to 30 years. We counted",
  how: "Hover or tap a bar to see who waited that long. Pick a trend to mark its own waits along the bottom.",
  sources: ["wikipedia"],
  order: 4,
  mount(host, context) {
    const { nerds } = context;
    return withForecast(host, (file, root) => {
      const { logMu, logSd, medianGapYears } = file.meta.params;
      const gaps = waveGaps(file.trends).filter((gap) => nerds.byId.has(gap.id));
      const inClaim = (gap: number) => gap >= CLAIM.from && gap <= CLAIM.to;
      const share = gaps.filter((gap) => inClaim(gap.gap)).length / (gaps.length || 1);
      const typical = median(gaps.map((gap) => gap.gap));
      const cameBack = new Set(gaps.map((gap) => gap.id)).size;
      const top = Math.ceil((Math.max(40, ...gaps.map((gap) => gap.gap)) + 1) / BIN) * BIN;
      const bins = Array.from({ length: top / BIN }, (_, i) => gaps.filter((gap) => gap.gap >= i * BIN && gap.gap < (i + 1) * BIN));
      const curve = Array.from({ length: top * 2 }, (_, i) => ({ x: (i + 1) / 2, y: lognormalPdf((i + 1) / 2, logMu, logSd) * gaps.length * BIN }));
      const tallest = Math.max(...bins.map((bin) => bin.length), ...curve.map((point) => point.y));
      let marked: number[] = [];

      root.append(
        el("p", "max-w-3xl font-nof-display text-[22px] leading-snug font-bold sm:text-[26px]", `${share < 0.5 ? "Only " : ""}${pct(share)} of comebacks land in the famous ${CLAIM.from} to ${CLAIM.to} year window. The typical wait is ${yrs(typical)}, give or take a lot.`),
        figures([
          [pct(share), `of waits were ${CLAIM.from} to ${CLAIM.to} years`],
          [`${typical}`, "years, the typical wait from one wave starting to the next"],
          [`${gaps.length}`, `waits counted, across ${cameBack} trends that came back at least once`],
        ]),
      );

      const frame = el("div", "relative overflow-hidden rounded-xl border border-nof-line bg-nof-panel");
      root.append(frame);
      const tip = tooltip(frame);

      const st = stage(frame, {
        height: context.compact ? "min(40vh, 300px)" : "min(46vh, 380px)",
        label: `Histogram of ${gaps.length} waits between one wave of a trend and the next. ${pct(share)} fall between ${CLAIM.from} and ${CLAIM.to} years. The model's fitted curve has its median at ${medianGapYears} years.`,
        render({ ctx, width, height }, pointer) {
          const pad = { left: 34, right: 14, top: 40, bottom: 44 };
          const base = height - pad.bottom;
          const x = (gap: number) => pad.left + (gap / top) * (width - pad.left - pad.right);
          const y = (count: number) => base - (count / tallest) * (base - pad.top);
          const muted = token("--color-nof-muted", "#a39fae");
          const text = token("--color-nof-text", "#f2eee6");
          const gold = token("--color-nof-gold", "#e8c27a");
          const pink = token("--color-nof-pink", "#ff6fa8");
          ctx.fillStyle = token("--color-nof-panel", "#17151d");
          ctx.fillRect(0, 0, width, height);

          ctx.fillStyle = pink;
          ctx.font = FONT.mono(10, 600);
          ctx.textBaseline = "alphabetic";
          ctx.textAlign = "left";
          ctx.fillText(`the ${CLAIM.from} to ${CLAIM.to} year claim`, Math.min(x(CLAIM.from), width - pad.right - 150), 14);

          ctx.strokeStyle = token("--color-nof-line", "#302c3a");
          ctx.fillStyle = muted;
          ctx.font = FONT.mono(10);
          ctx.textAlign = "right";
          ctx.textBaseline = "middle";
          const step = tallest > 120 ? 50 : tallest > 40 ? 20 : 5;
          for (let count = 0; count <= tallest; count += step) {
            const py = Math.round(y(count)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(pad.left, py);
            ctx.lineTo(width - pad.right, py);
            ctx.stroke();
            ctx.fillText(`${count}`, pad.left - 6, py);
          }
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          for (let gap = 0; gap <= top; gap += width < 520 ? 20 : 10) ctx.fillText(`${gap}`, x(gap), base + 24);
          ctx.fillText("years from one wave starting to the next", (pad.left + width - pad.right) / 2, height - 5);

          const bw = x(BIN) - x(0);
          const hover = pointer.inside && pointer.x > pad.left && pointer.x < width - pad.right && pointer.y < base ? Math.floor((pointer.x - pad.left) / bw) : -1;
          for (const [i, bin] of bins.entries()) {
            if (!bin.length) continue;
            ctx.fillStyle = i === hover ? pink : token("--color-nof-clothes", "#5b8ef0");
            ctx.beginPath();
            ctx.roundRect(x(i * BIN) + 1, y(bin.length), Math.max(1, bw - 2), base - y(bin.length), [3, 3, 0, 0]);
            ctx.fill();
          }

          ctx.globalAlpha = 0.22;
          ctx.fillStyle = pink;
          ctx.fillRect(x(CLAIM.from), pad.top, x(CLAIM.to + 1) - x(CLAIM.from), base - pad.top);
          ctx.globalAlpha = 1;

          ctx.strokeStyle = gold;
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 4]);
          ctx.beginPath();
          for (const [i, point] of curve.entries()) i ? ctx.lineTo(x(point.x), y(point.y)) : ctx.moveTo(x(point.x), y(point.y));
          ctx.stroke();
          const mx = Math.round(x(medianGapYears)) + 0.5;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 4]);
          ctx.beginPath();
          ctx.moveTo(mx, 30);
          ctx.lineTo(mx, base);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = gold;
          ctx.font = FONT.mono(10, 600);
          const medianLabel = `model median ${medianGapYears}`;
          const fits = mx - 5 - ctx.measureText(medianLabel).width > 4;
          ctx.textAlign = fits ? "right" : "left";
          ctx.fillText(medianLabel, mx + (fits ? -5 : 5), 30);

          ctx.fillStyle = text;
          for (const gap of marked) {
            const px = x(gap + 0.5);
            ctx.beginPath();
            ctx.moveTo(px, base + 2);
            ctx.lineTo(px + 5, base + 11);
            ctx.lineTo(px - 5, base + 11);
            ctx.closePath();
            ctx.fill();
          }

          const bin = bins[hover];
          if (bin?.length) tip.show(x(hover * BIN + BIN / 2), y(bin.length), [`${hover * BIN} to ${hover * BIN + BIN - 1} years · ${bin.length} comeback${bin.length === 1 ? "" : "s"}`, names(bin.map((gap) => nerds.byId.get(gap.id)!))]);
          else tip.hide();
        },
      });

      root.append(
        legend([
          ["h-2.5 w-2.5 rounded-sm bg-nof-clothes", "waits on record"],
          ["w-5 border-t-2 border-dashed border-nof-gold", "the curve the forecast model fitted"],
          ["h-2.5 w-2.5 rounded-sm bg-nof-pink/30", `the ${CLAIM.from} to ${CLAIM.to} year claim`],
          ["h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-nof-text", "your trend's waits"],
        ]),
      );

      const picker = trendPicker(nerds.trends.filter((trend) => file.trends[trend.id]), "Mark one trend's waits", "Nobody in particular");
      const verdict = el("p", "text-[15px] leading-relaxed text-nof-sub");
      if (!context.compact)
        root.append(
          picker.field,
          verdict,
          el("p", "max-w-3xl text-[12px] leading-relaxed text-nof-muted", "A wait runs from the start of one spell in fashion to the start of the next, with spells that overlap in different countries merged into one. The comeback clock counts the revivals Wikipedia names instead, so its numbers are its own."),
        );

      const pick = (id: string | undefined) => {
        const trend = id ? nerds.byId.get(id) : undefined;
        const waves = (trend && file.trends[trend.id]?.waves) || [];
        marked = waves.slice(1).map((wave, i) => wave[0] - waves[i][0]);
        picker.select.value = trend && waves.length ? trend.id : "";
        if (!trend || !waves.length) verdict.textContent = "";
        else if (!marked.length) verdict.textContent = `${trend.name} has had one wave, so there's no wait to mark. Ask again in ${yrs(Math.round(medianGapYears))}.`;
        else {
          const hits = marked.filter(inClaim).length;
          verdict.textContent = `${trend.name} waited ${marked.join(", ")} years between waves. ${hits ? `${hits} of ${marked.length} ${hits === 1 ? "lands" : "land"} in the window.` : "Not one lands in the window."}`;
        }
        st.draw();
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
          st.destroy();
        },
      };
    });
  },
};

export default view;
