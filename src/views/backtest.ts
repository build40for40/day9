// Marking our own homework: the forecast's backtest, as a calibration plot of what the
// model said against what happened, with the unflattering scores up top.

import { token } from "../data";
import { FONT, stage } from "../stage";
import type { View } from "../view";
import { el, figures, legend, pct, tooltip, withForecast } from "../viewkit";

const ENOUGH = 10;

const view: View = {
  id: "backtest",
  tab: "comebacks",
  title: "Marking our own homework",
  blurb: "We rewound the clock and made the forecast guess the past. It did not cover itself in glory",
  how: "Each dot is a batch of old guesses: across is what the model said, up is what happened. On the diagonal would be perfect. Hover a dot for its numbers.",
  sources: ["wikipedia"],
  order: 6,
  mount(host, context) {
    return withForecast(host, (file, root) => {
      const test = file.meta.backtest;
      const span = file.meta.horizon.length;
      const buckets = (test.calibration ?? []).filter((bucket) => bucket.guesses >= ENOUGH);
      const dropped = (test.calibration ?? []).filter((bucket) => bucket.guesses < ENOUGH).reduce((sum, bucket) => sum + bucket.guesses, 0);
      const coin = Math.abs(test.auc - 0.5) < 0.05;
      const shrug = test.skill <= 0 ? `No better than shrugging. ${pct(-test.skill)} worse, in fact.` : test.skill < 0.05 ? `Barely better than shrugging: ${pct(test.skill)} better, to be exact.` : `${pct(test.skill)} better than shrugging.`;

      root.append(
        el(
          "p",
          "max-w-3xl font-nof-display text-[22px] leading-snug font-bold sm:text-[26px]",
          `How good is the forecast? ${shrug} Hand it one trend that came back and one that didn't, and it picks the right one ${Math.round(test.auc * 100)}% of the time. A coin gets 50%.${coin ? " So it's a coin toss in a nice jacket." : ""}`,
        ),
        figures([
          [test.auc.toFixed(2), "ranking score (AUC). 0.5 is a coin, 1 is a psychic"],
          [pct(test.skill), `against always guessing the base rate (Brier ${test.brier} vs ${test.brierBaseRate}, lower is better)`],
          [pct(test.baseRate), `base rate: how often a resting trend really came back within ${span} years`],
          [`${test.guesses}`, "past guesses checked"],
        ]),
      );

      let st: ReturnType<typeof stage> | undefined;
      if (buckets.length) {
        const frame = el("div", "relative overflow-hidden rounded-xl border border-nof-line bg-nof-panel");
        root.append(frame);
        const tip = tooltip(frame);
        const top = Math.ceil((Math.max(...buckets.map((bucket) => Math.max(bucket.predicted, bucket.observed)), test.baseRate) * 1.2) / 0.05) * 0.05;
        const most = Math.max(...buckets.map((bucket) => bucket.guesses));

        st = stage(frame, {
          height: context.compact ? "clamp(280px, 76vw, 380px)" : "clamp(300px, 86vw, 460px)",
          label: `Calibration plot of ${test.guesses} backtest guesses in batches. ${buckets.map((bucket) => `When the model said about ${pct(bucket.predicted)}, ${pct(bucket.observed)} came back`).join(". ")}. The base rate is ${pct(test.baseRate)}.`,
          render({ ctx, width, height }, pointer) {
            const size = Math.min(width, height);
            const left = (width - size) / 2 + 48;
            const right = (width + size) / 2 - 16;
            const pad = { top: 16, bottom: 46 };
            const base = height - pad.bottom;
            const x = (p: number) => left + (p / top) * (right - left);
            const y = (p: number) => base - (p / top) * (base - pad.top);
            const panel = token("--color-nof-panel", "#17151d");
            const muted = token("--color-nof-muted", "#a39fae");
            const text = token("--color-nof-text", "#f2eee6");
            const orange = token("--color-nof-scenes", "#e2703a");
            ctx.fillStyle = panel;
            ctx.fillRect(0, 0, width, height);

            ctx.strokeStyle = token("--color-nof-line", "#302c3a");
            ctx.fillStyle = muted;
            ctx.font = FONT.mono(10);
            for (let p = 0; p <= top + 0.001; p += top > 0.4 ? 0.1 : 0.05) {
              const px = Math.round(x(p)) + 0.5;
              const py = Math.round(y(p)) + 0.5;
              ctx.beginPath();
              ctx.moveTo(px, pad.top);
              ctx.lineTo(px, base);
              ctx.moveTo(left, py);
              ctx.lineTo(right, py);
              ctx.stroke();
              ctx.textAlign = "center";
              ctx.textBaseline = "alphabetic";
              ctx.fillText(`${Math.round(p * 100)}%`, px, base + 15);
              ctx.textAlign = "right";
              ctx.textBaseline = "middle";
              ctx.fillText(`${Math.round(p * 100)}%`, left - 6, py);
            }
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText("what the model said", (left + right) / 2, height - 8);
            ctx.save();
            ctx.translate(left - 36, (pad.top + base) / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillText("what actually happened", 0, 0);
            ctx.restore();

            ctx.strokeStyle = text;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(x(0), y(0));
            ctx.lineTo(x(top), y(top));
            ctx.stroke();
            ctx.strokeStyle = orange;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(left, y(test.baseRate));
            ctx.lineTo(right, y(test.baseRate));
            ctx.stroke();
            ctx.setLineDash([]);

            let hover = -1;
            let reach = Infinity;
            const dot = (guesses: number) => Math.max(5, Math.sqrt(guesses / most) * (size / 22));
            for (const [i, bucket] of buckets.entries()) {
              const distance = Math.hypot(pointer.x - x(bucket.predicted), pointer.y - y(bucket.observed));
              if (pointer.inside && distance < dot(bucket.guesses) + 10 && distance < reach) [hover, reach] = [i, distance];
            }
            for (const [i, bucket] of buckets.entries()) {
              ctx.fillStyle = i === hover ? token("--color-nof-pink", "#ff6fa8") : token("--color-nof-clothes", "#5b8ef0");
              ctx.strokeStyle = panel;
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(x(bucket.predicted), y(bucket.observed), dot(bucket.guesses), 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }
            const bucket = buckets[hover];
            if (bucket) tip.show(x(bucket.predicted), y(bucket.observed) - dot(bucket.guesses), [`Guesses of ${pct(bucket.from)} to ${pct(bucket.to)}`, `${bucket.guesses} guesses. The model said ${pct(bucket.predicted)} on average, and ${pct(bucket.observed)} came back.`]);
            else tip.hide();
          },
        });

        root.append(
          legend([
            ["h-2.5 w-2.5 rounded-full bg-nof-clothes", "a batch of guesses, bigger means more of them"],
            ["w-5 border-t-2 border-nof-text", "perfect: said equals happened"],
            ["w-5 border-t-2 border-dashed border-nof-scenes", `base rate, ${pct(test.baseRate)}`],
          ]),
        );

        const said = buckets.map((bucket) => bucket.predicted);
        const seen = buckets.map((bucket) => bucket.observed);
        const over = buckets.map((bucket) => bucket.observed > bucket.predicted);
        const lean = over.every(Boolean)
          ? "It's too shy with the odds across the board."
          : !over.some(Boolean)
            ? "It's too cocky with the odds across the board."
            : over[0] && !over.at(-1)
              ? "It's too shy at the bottom and too cocky at the top."
              : "Some batches came in over, some under.";
        const flat = Math.max(...seen) - Math.min(...seen) < (Math.max(...said) - Math.min(...said)) / 2;
        root.append(
          el(
            "p",
            "max-w-3xl text-[15px] leading-relaxed text-nof-sub",
            `Whatever odds the model gave, from ${pct(Math.min(...said))} up to ${pct(Math.max(...said))}, between ${pct(Math.min(...seen))} and ${pct(Math.max(...seen))} of those trends came back. ${lean} A good forecast climbs the diagonal.${flat ? " This one mostly hugs the dashed line." : ""}${dropped ? ` ${dropped} guesses in batches smaller than ${ENOUGH} are left off, because that few can land anywhere.` : ""}`,
          ),
        );
      }

      if (!context.compact)
        root.append(
          el(
            "p",
            "max-w-3xl text-[12px] leading-relaxed text-nof-muted",
            `How the test works: stand in a past year knowing only the waves that had started by then, guess which out-of-fashion trends start a new wave within ${span} years, then check. Why it scores like this: the dates come from decade-level sections of Wikipedia articles, so plenty of waves "start" on a round year. The forecast is a talking point, not a prediction, and trends with a single wave never get a number at all.`,
          ),
        );

      return { destroy: () => st?.destroy() };
    });
  },
};

export default view;
