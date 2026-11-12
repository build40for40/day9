// The comeback spiral: the century wound into laps of the model's typical wait, so a trend
// on a perfect cycle would start every wave on the same spoke.

import { FAMILIES, FIRST_YEAR, familyOf, token, type Family, type Trend } from "../data";
import { offBeat, waveGaps } from "../forecast";
import { FONT, stage } from "../stage";
import type { View } from "../view";
import { el, legend, names, pct, tooltip, trendPicker, withForecast } from "../viewkit";

const NEAR = 3;
const BAR: Record<Family, string> = { clothes: "bg-nof-clothes", scenes: "bg-nof-scenes", kit: "bg-nof-kit", face: "bg-nof-face" };

const view: View = {
  id: "spiral",
  tab: "comebacks",
  title: "The comeback spiral",
  blurb: "A hundred years wound up like a clock spring, to see if fashion keeps time",
  how: "Pick a trend to draw its waves in colour. If it ran like clockwork, they'd all start on its spoke. Hover a dot to see who started that year.",
  sources: ["wikipedia"],
  order: 5,
  mount(host, context) {
    const { nerds } = context;
    return withForecast(host, (file, root) => {
      const lap = file.meta.params.medianGapYears;
      const now = file.meta.now;
      const last = file.meta.horizon.at(-1) ?? now;
      const known = nerds.trends.filter((trend) => file.trends[trend.id]);
      const gaps = waveGaps(file.trends);
      const onBeat = gaps.filter((gap) => offBeat(gap.gap, lap) <= NEAR).length / (gaps.length || 1);
      const blind = Math.min(1, (2 * NEAR) / lap);

      const starts = new Map<number, Trend[]>();
      for (const trend of known) for (const [start] of file.trends[trend.id].waves) starts.set(start, [...(starts.get(start) ?? []), trend]);
      const busiest = Math.max(1, ...[...starts.values()].map((list) => list.length));

      const steadiest = known
        .map((trend) => {
          const waves = file.trends[trend.id].waves;
          const own = waves.slice(1).map((wave, i) => offBeat(wave[0] - waves[i][0], lap));
          return { trend, waves: waves.length, off: own.reduce((a, b) => a + b, 0) / (own.length || 1) };
        })
        .filter((entry) => entry.waves >= 3)
        .sort((a, b) => a.off - b.off)[0]?.trend;
      let picked: Trend | undefined;

      root.append(
        el(
          "p",
          "max-w-3xl font-nof-display text-[22px] leading-snug font-bold sm:text-[26px]",
          `Wind the century into ${lap} year laps and ${pct(onBeat)} of comebacks start within ${NEAR} years of the spoke they left from. Darts thrown blindfolded would score ${pct(blind)}. ${onBeat > blind * 1.15 ? "So there's a beat, just a faint one." : "So no, fashion doesn't keep time."}`,
        ),
      );

      const frame = el("div", "relative overflow-hidden rounded-xl border border-nof-line bg-nof-panel");
      root.append(frame);
      const tip = tooltip(frame);

      const st = stage(frame, {
        height: context.compact ? "clamp(300px, 80vw, 420px)" : "clamp(320px, 92vw, 580px)",
        label: `Spiral timeline from ${FIRST_YEAR} to ${last}, one lap every ${lap} years, with a dot for each year sized by how many waves started then. ${pct(onBeat)} of comebacks start within ${NEAR} years of a whole number of laps.`,
        render({ ctx, width, height }, pointer) {
          const size = Math.min(width, height);
          const cx = width / 2;
          const cy = height / 2;
          const outer = size / 2 - 28;
          const inner = 14;
          const angle = (year: number) => (2 * Math.PI * (year - FIRST_YEAR)) / lap - Math.PI / 2;
          const radius = (year: number) => inner + ((outer - inner) * (year - FIRST_YEAR)) / (last - FIRST_YEAR);
          const at = (year: number, off = 0): [number, number] => [cx + (radius(year) + off) * Math.cos(angle(year)), cy + (radius(year) + off) * Math.sin(angle(year))];
          const trace = (from: number, to: number) => {
            ctx.beginPath();
            for (let year = from; year <= to + 0.001; year += 0.25) year === from ? ctx.moveTo(...at(year)) : ctx.lineTo(...at(year));
            ctx.stroke();
          };
          const panel = token("--color-nof-panel", "#17151d");
          const muted = token("--color-nof-muted", "#a39fae");
          const text = token("--color-nof-text", "#f2eee6");
          const outlined = (label: string, x: number, y: number, colour: string) => {
            ctx.lineWidth = 4;
            ctx.strokeStyle = panel;
            ctx.strokeText(label, x, y);
            ctx.fillStyle = colour;
            ctx.fillText(label, x, y);
          };
          ctx.fillStyle = panel;
          ctx.fillRect(0, 0, width, height);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";

          ctx.globalAlpha = 0.45;
          ctx.strokeStyle = muted;
          ctx.lineWidth = 1;
          trace(FIRST_YEAR, now);
          ctx.globalAlpha = 1;
          ctx.strokeStyle = token("--color-nof-gold", "#e8c27a");
          ctx.lineWidth = 2.5;
          ctx.setLineDash([2, 6]);
          trace(now, last);
          ctx.setLineDash([]);

          const waves = picked ? file.trends[picked.id].waves : [];
          if (waves.length) {
            const a = angle(waves[0][0]);
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = text;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx + inner * Math.cos(a), cy + inner * Math.sin(a));
            ctx.lineTo(cx + (outer + 10) * Math.cos(a), cy + (outer + 10) * Math.sin(a));
            ctx.stroke();
            ctx.globalAlpha = 1;
          }

          let hover: number | undefined;
          let reach = 14;
          const biggest = Math.max(6, size / 50);
          for (const [year, list] of starts) {
            const [px, py] = at(year);
            const distance = Math.hypot(pointer.x - px, pointer.y - py);
            if (pointer.inside && distance < reach) [hover, reach] = [year, distance];
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = muted;
            ctx.beginPath();
            ctx.arc(px, py, Math.max(2, Math.sqrt(list.length / busiest) * biggest), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;

          ctx.font = FONT.mono(10);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          for (let year = FIRST_YEAR; year < now; year += size < 420 ? 20 : 10) outlined(`${year}`, ...at(year, -11), muted);
          outlined(`${last}`, ...at(last, 13), token("--color-nof-gold", "#e8c27a"));

          if (picked && waves.length) {
            const colour = token(FAMILIES[familyOf(picked.category)].token, "#5b8ef0");
            ctx.strokeStyle = colour;
            ctx.lineWidth = 6;
            for (const [start, end] of waves) trace(start, Math.min(end + 1, now + 1));
            ctx.font = FONT.mono(11, 600);
            for (const [start] of waves) {
              const [px, py] = at(start);
              ctx.fillStyle = colour;
              ctx.strokeStyle = panel;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(px, py, 5.5, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
              outlined(`${start}`, ...at(start, 16), text);
            }
          }

          if (hover !== undefined) {
            const list = starts.get(hover)!;
            const [px, py] = at(hover);
            ctx.strokeStyle = token("--color-nof-pink", "#ff6fa8");
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, Math.max(2, Math.sqrt(list.length / busiest) * biggest) + 2, 0, Math.PI * 2);
            ctx.stroke();
            tip.show(px, py, [`${hover} · ${list.length} wave${list.length === 1 ? "" : "s"} started`, names(list)]);
          } else tip.hide();
        },
      });

      const key = el("div");
      const picker = trendPicker(known, "Follow one trend round the spiral");
      const verdict = el("p", "text-[15px] leading-relaxed text-nof-sub");
      root.append(key);
      if (!context.compact) root.append(picker.field, verdict);

      const pick = (id: string | undefined) => {
        picked = (id && file.trends[id] ? nerds.byId.get(id) : undefined) ?? steadiest ?? known[0];
        if (!picked) return;
        picker.select.value = picked.id;
        const waves = file.trends[picked.id].waves;
        key.replaceChildren(
          legend([
            ["h-2.5 w-2.5 rounded-full bg-nof-muted", "waves starting that year, bigger means more"],
            [`h-1.5 w-5 rounded-full ${BAR[familyOf(picked.category)]}`, `${picked.name} in fashion`],
            ["w-5 border-t border-nof-text", `the spoke ${picked.name} first started on`],
            ["w-5 border-t-2 border-dotted border-nof-gold", `${now + 1} to ${last}, which hasn't happened yet`],
          ]),
        );
        const off = waves.slice(1).map((wave, i) => Math.round(offBeat(wave[0] - waves[i][0], lap)));
        verdict.textContent = off.length
          ? `${picked.name} kicked off in ${waves.map((wave) => wave[0]).join(", ")}. Clockwork would put each start a whole lap after the last one. It missed by ${off.join(", ")} ${off.length === 1 && off[0] === 1 ? "year" : "years"}.`
          : `${picked.name} has only had one wave, starting in ${waves[0][0]}, so there's no lap to check.`;
        st.draw();
      };
      const onChange = () => {
        context.setParam("trend", picker.select.value);
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
