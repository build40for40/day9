// The comeback odds board for the forecast years: who is due, who is in and fading,
// who is resting, and the ones nobody can call. Everything gold and dashed is a guess.

import type { Trend } from "../data";
import { median, type TrendForecast } from "../forecast";
import type { View } from "../view";
import { el, names, pct, trendPicker, withForecast } from "../viewkit";

const GUESS = "border border-dashed border-nof-gold bg-nof-gold/20";

interface Row {
  trend: Trend;
  forecast: TrendForecast;
}

const spans = (forecast: TrendForecast, now: number) => forecast.waves.map(([start, end]) => (end >= now ? `${start} to now` : start === end ? `${start}` : `${start} to ${end}`)).join(", ");

const view: View = {
  id: "comeback-odds",
  tab: "comebacks",
  title: "Comeback odds board",
  blurb: "Who's due, who's fading and who's fast asleep. A guess, clearly labelled as one",
  how: "Switch the year, tap any row to pin a trend, or pick one from the list. Gold and dashed means forecast, never fact.",
  sources: ["wikipedia"],
  order: 3,
  mount(host, context) {
    const { nerds } = context;
    return withForecast(host, (file, root) => {
      const { now, horizon, backtest } = file.meta;
      const last = horizon.at(-1)!;
      const rows: Row[] = nerds.trends.filter((trend) => file.trends[trend.id]).map((trend) => ({ trend, forecast: file.trends[trend.id] }));
      const out = rows.filter((row) => row.forecast.status === "out");
      const stillIn = rows.filter((row) => row.forecast.status === "in");
      const unknown = rows.filter((row) => row.forecast.status === "unknown");
      const likely = out.filter((row) => row.forecast.verdict === "likely").length;
      const short = context.compact ? 6 : 12;
      let year = last;
      let focus: Row | undefined;

      const salt = el("p", "rounded-xl border border-dashed border-nof-gold px-4 py-3 text-[14px] leading-relaxed text-nof-sub");
      salt.append(
        el("strong", "text-nof-gold", "Pinch of salt. "),
        `Everything on this board is a guess about ${horizon[0]} to ${last}, not a record. Tested on the past, the model picks the real comeback out of a pair ${Math.round(backtest.auc * 100)}% of the time. A coin gets 50%. `,
      );
      if (!context.compact) {
        const link = el("a", "font-semibold text-nof-text underline hover:text-nof-pink", "See how it marked its own homework");
        link.href = "?tab=explore&view=backtest";
        salt.append(link);
      }
      root.append(salt);

      const controls = el("div", "flex flex-wrap items-end gap-x-6 gap-y-3");
      const years = el("div", "flex rounded-full border border-nof-line bg-nof-panel p-1 text-[13px] font-semibold");
      years.setAttribute("role", "radiogroup");
      years.setAttribute("aria-label", "Forecast year");
      const yearButtons = horizon.map((y) => {
        const button = el("button", "rounded-full px-3.5 py-1.5", `By ${y}`);
        button.type = "button";
        button.setAttribute("role", "radio");
        button.addEventListener("click", () => {
          context.setParam("year", String(y));
          year = y;
          render();
        });
        years.append(button);
        return button;
      });
      const picker = trendPicker(rows.map((row) => row.trend), "Look one trend up", "Nobody in particular");
      picker.field.classList.add("min-w-[220px]", "flex-1");
      controls.append(years, picker.field);
      const body = el("div", "flex flex-col gap-6");
      root.append(controls, body);

      const section = (title: string, sub: string) => {
        const box = el("section", "rounded-xl border border-nof-line bg-nof-panel p-4 sm:p-5");
        box.append(el("h3", "font-nof-display text-[24px] leading-tight font-bold", title), el("p", "mt-1 mb-3 max-w-2xl text-[13px] leading-relaxed text-nof-muted", sub));
        return box;
      };

      const setFocus = (id: string | null) => {
        context.setParam("trend", id);
        focus = rows.find((row) => row.trend.id === id);
        render();
      };

      const bars = (list: Row[], value: (row: Row) => number, scale: number) => {
        const wrap = el("div", "flex flex-col");
        for (const row of list) {
          const on = row === focus;
          const button = el("button", `grid w-full grid-cols-[minmax(0,8.5rem)_1fr_3.25rem] items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-nof-raised sm:grid-cols-[minmax(0,11rem)_1fr_3.25rem] ${on ? "bg-nof-raised ring-1 ring-nof-pink" : ""}`);
          button.type = "button";
          button.setAttribute("aria-pressed", String(on));
          const track = el("span", "block h-3");
          const bar = el("span", `block h-full rounded-r ${GUESS}`);
          bar.style.width = `${Math.max(1, (value(row) / scale) * 100)}%`;
          track.append(bar);
          button.append(el("span", `truncate text-[13px] ${on ? "font-semibold text-nof-text" : "text-nof-sub"}`, row.trend.name), track, el("span", "text-right font-mono text-[12px] text-nof-gold", pct(value(row))));
          button.addEventListener("click", () => setFocus(on ? null : row.trend.id));
          wrap.append(button);
        }
        return wrap;
      };
      const withFocus = (sorted: Row[]) => (focus && sorted.includes(focus) && !sorted.slice(0, short).includes(focus) ? [...sorted.slice(0, short), focus] : sorted.slice(0, short));

      const card = (row: Row) => {
        const { trend, forecast } = row;
        const box = el("section", "rounded-xl border border-nof-pink bg-nof-panel p-4 sm:p-5");
        box.append(el("h3", "font-nof-display text-[26px] leading-tight font-bold", trend.name), el("p", "mt-1 text-[13px] text-nof-muted", `On record: ${spans(forecast, now)}`));
        const guess = el("p", "mt-3 text-[15px] leading-relaxed text-nof-sub");
        if (forecast.status === "unknown")
          guess.textContent = `One wave only${forecast.inNow ? ", and it's still going" : ""}. No gap means no cycle, and no cycle means no number. So we're not giving you one.`;
        else if (forecast.status === "in")
          guess.append(el("strong", "font-mono text-[20px] text-nof-gold", pct(forecast.stillIn?.[year] ?? 0)), ` chance it's still in fashion by the end of ${year}. It's on right now, so there's no comeback to bet on.`);
        else {
          const rank = out.toSorted((a, b) => (b.forecast.comebackBy?.[year] ?? 0) - (a.forecast.comebackBy?.[year] ?? 0)).indexOf(row) + 1;
          guess.append(
            el("strong", "font-mono text-[20px] text-nof-gold", pct(forecast.comebackBy?.[year] ?? 0)),
            ` chance a new wave starts by the end of ${year}, which makes it number ${rank} of ${out.length} resting trends and a "${forecast.verdict}". The model's best guess for its return is ${forecast.medianReturn}, though anywhere from ${forecast.returnRange?.[0]} to ${forecast.returnRange?.[1]} wouldn't surprise it.`,
          );
        }
        box.append(guess);
        return box;
      };

      const resting = () => {
        const box = section("Having a rest", `Every out-of-fashion trend, stacked at the year the model reckons it most likely returns. Half of them aren't expected before ${Math.round(median(out.map((row) => row.forecast.medianReturn ?? 0)))}.`);
        const byYear = new Map<number, Row[]>();
        for (const row of out) byYear.set(row.forecast.medianReturn!, [...(byYear.get(row.forecast.medianReturn!) ?? []), row]);
        const first = Math.min(...byYear.keys());
        const final = Math.max(...byYear.keys());
        const most = Math.max(...[...byYear.values()].map((list) => list.length));
        const readout = el("p", "mt-3 min-h-10 text-[13px] leading-snug text-nof-sub", "Tap a bar to see who's pencilled in.");
        const chart = el("div", "flex h-32 items-end gap-px sm:gap-1");
        const axis = el("div", "mt-1 flex gap-px font-mono text-[10px] text-nof-muted sm:gap-1");
        for (let y = first; y <= final; y++) {
          const list = byYear.get(y) ?? [];
          const bar = el("button", `min-w-0 flex-1 rounded-t ${list.length ? GUESS : ""} ${focus && list.includes(focus) ? "bg-nof-gold/60" : ""} hover:bg-nof-gold/50`);
          bar.type = "button";
          bar.style.height = `${Math.max(2, (list.length / most) * 100)}%`;
          bar.setAttribute("aria-label", `${y}: ${list.length} trends`);
          const show = () => (readout.textContent = list.length ? `${y}: ${list.length} trend${list.length === 1 ? "" : "s"} pencilled in, including ${names(list.map((row) => row.trend), 8)}.` : `${y}: nobody. A quiet year, allegedly.`);
          bar.addEventListener("click", show);
          bar.addEventListener("pointerenter", show);
          chart.append(bar);
          axis.append(el("span", "min-w-0 flex-1 overflow-visible text-center whitespace-nowrap", (y - first) % 5 === 0 ? `${y}` : ""));
        }
        box.append(chart, axis, readout);
        return box;
      };

      const render = () => {
        for (const [i, button] of yearButtons.entries()) {
          const on = horizon[i] === year;
          button.setAttribute("aria-checked", String(on));
          button.className = `rounded-full px-3.5 py-1.5 ${on ? "bg-nof-gold text-nof-night" : "text-nof-sub hover:text-nof-text"}`;
        }
        picker.select.value = focus?.trend.id ?? "";
        const back = (row: Row) => row.forecast.comebackBy?.[year] ?? 0;
        const stay = (row: Row) => row.forecast.stillIn?.[year] ?? 0;
        const due = out.toSorted((a, b) => back(b) - back(a));
        const fading = stillIn.toSorted((a, b) => stay(a) - stay(b));
        const tip = due[0];

        const headline = el(
          "p",
          "max-w-3xl font-nof-display text-[22px] leading-snug font-bold sm:text-[26px]",
          `${likely} look due, ${stillIn.length} are in and fading, ${out.length - likely} are resting and ${unknown.length} are anyone's guess.${tip ? ` Hottest tip by ${year}: ${tip.trend.name.toLowerCase()}, at ${pct(back(tip))}. Even that's a long shot.` : ""}`,
        );
        const dueBox = section("Due a comeback", `Chance a new wave starts by the end of ${year}, for trends that are out right now. "Due" means ${pct(file.meta.bands.likely)} or more by ${last}, so nobody here is a banker.`);
        dueBox.append(bars(withFocus(due), back, Math.max(0.05, ...out.map((row) => row.forecast.comebackBy?.[last] ?? 0))));
        const parts: HTMLElement[] = [headline];
        if (focus) parts.push(card(focus));
        if (context.compact) parts.push(dueBox);
        else {
          const inBox = section("In now, and wobbling", `Chance each current trend is still in fashion by the end of ${year}. These are the ${short} shakiest of ${stillIn.length}. The model only goes on how long each has been in, so they all land between ${pct(Math.min(...stillIn.map(stay)))} and ${pct(Math.max(...stillIn.map(stay)))}.`);
          inBox.append(bars(withFocus(fading), stay, 1));
          const pair = el("div", "grid gap-6 lg:grid-cols-2");
          pair.append(dueBox, inBox);
          const shrug = section("No idea, honestly", "One wave only. No gap means no cycle, and no cycle means no number. Anyone who gives you one is making it up.");
          const chips = el("div", "flex flex-wrap gap-2");
          for (const row of unknown) {
            const chip = el("button", `rounded-full border border-dashed px-3 py-1 text-[13px] hover:border-nof-text ${row === focus ? "border-nof-pink text-nof-text" : "border-nof-muted text-nof-sub"}`, `${row.trend.name} ?`);
            chip.type = "button";
            chip.addEventListener("click", () => setFocus(row.trend.id));
            chips.append(chip);
          }
          shrug.append(chips);
          parts.push(pair, resting(), shrug);
        }
        body.replaceChildren(...parts);
      };

      const read = (params: Record<string, string>) => {
        year = horizon.includes(Number(params.year)) ? Number(params.year) : last;
        focus = rows.find((row) => row.trend.id === params.trend);
        render();
      };
      const onChange = () => setFocus(picker.select.value || null);
      picker.select.addEventListener("change", onChange);
      read(context.params);

      return {
        update: read,
        destroy: () => picker.select.removeEventListener("change", onChange),
      };
    });
  },
};

export default view;
