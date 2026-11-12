// "What the museums kept": V&A and Met womenswear by decade, then the real V&A pieces
// behind the trends of whichever decade you pick.

import { NOW_YEAR, decadeOf, type Example, type Trend } from "../data";
import type { View } from "../view";

const DECADES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const view: View = {
  id: "museum",
  tab: "museums",
  title: "What the museums kept",
  blurb: "Two great wardrobes, the V&A's and the Met's, counted decade by decade",
  how: "Tap a decade to open its wardrobe. Every piece links to the museum's own page.",
  sources: ["vam", "met"],
  order: 1,
  mount(root, context) {
    const { nerds } = context;
    const vam = nerds.data.series.vamByDecade;
    const met = nerds.data.series.metByDecade;
    const max = Math.max(...DECADES.map((d) => Math.max(vam[d] ?? 0, met[d] ?? 0)));

    // Every V&A example, tagged with the trend it illustrates.
    const pieces = new Map<string, { example: Example; trends: Trend[] }>();
    for (const trend of nerds.trends)
      for (const example of trend.examples) {
        const entry = pieces.get(example.id) ?? { example, trends: [] };
        entry.trends.push(trend);
        pieces.set(example.id, entry);
      }
    const inDecade = (decade: number) =>
      [...pieces.values()]
        .filter(({ example }) => decadeOf(example.year) === decade)
        .sort((a, b) => a.example.year - b.example.year || nerds.fame(b.trends[0]) - nerds.fame(a.trends[0]));

    const youDecade = context.born ? decadeOf(Math.min(NOW_YEAR, context.born + 16)) : null;
    const start = Number(context.params.decade);
    let decade = DECADES.includes(start) ? start : youDecade && DECADES.includes(youDecade) && inDecade(youDecade).length ? youDecade : 1960;

    const wrap = el("div", "flex flex-col gap-4");
    root.append(wrap);

    const chart = el("div", "rounded-2xl border border-nof-line bg-nof-night p-4 sm:p-5");
    const legend = el("div", "mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-nof-body text-xs text-nof-sub");
    legend.innerHTML =
      '<span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm bg-nof-clothes"></span>V&amp;A womenswear</span>' +
      '<span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-2.5 rounded-sm bg-nof-scenes"></span>The Met, Costume Institute</span>';
    chart.append(legend);
    const bars = el("div", "flex h-48 items-end gap-1 sm:h-56 sm:gap-2");
    bars.setAttribute("role", "tablist");
    bars.setAttribute("aria-label", "Pick a decade");
    chart.append(bars);
    const tip = el("p", "mt-3 min-h-5 font-mono text-[11px] text-nof-muted");
    chart.append(tip);
    wrap.append(chart);

    const caveat = el(
      "p",
      "font-nof-body text-xs leading-relaxed text-nof-muted",
      "Bias alert: museums collect couture, famous names and whatever survived the moths, so these counts show what curators kept, not what your nan wore. And they mostly stop collecting after 2000, so the drop at the end is about museums, not fashion.",
    );
    if (!context.compact) wrap.append(caveat);

    const heading = el("div", "flex items-baseline justify-between gap-3");
    const title = el("h3", "font-nof-display text-2xl font-bold text-nof-text");
    const count = el("p", "font-mono text-xs text-nof-muted");
    heading.append(title, count);
    wrap.append(heading);
    const grid = el("ul", "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4");
    wrap.append(grid);
    const credit = el("p", "font-nof-body text-[11px] leading-relaxed text-nof-muted");
    credit.innerHTML =
      'Images and records © Victoria and Albert Museum, London, shown for non-commercial use with credit. Met counts from <a class="underline hover:text-nof-text" href="https://github.com/metmuseum/openaccess" target="_blank" rel="noopener">The Met Open Access</a> (CC0). The Met\'s pictures aren\'t free to use, so they\'re counted, not shown.';
    wrap.append(credit);

    const describe = (d: number) => {
      let text = `${d}s · V&A ${vam[d] ?? 0} pieces · Met ${met[d] ?? 0} pieces`;
      if (youDecade === d) text += " · your teens";
      return text;
    };

    const renderBars = () => {
      bars.replaceChildren(
        ...DECADES.map((d) => {
          const on = d === decade;
          const button = el(
            "button",
            `group flex h-full min-w-0 flex-1 flex-col items-stretch justify-end gap-1 rounded-lg px-0.5 pb-0.5 pt-1 transition-colors ${on ? "bg-nof-raised" : "hover:bg-nof-panel"}`,
          );
          button.type = "button";
          button.setAttribute("role", "tab");
          button.setAttribute("aria-selected", String(on));
          button.setAttribute("aria-label", describe(d));
          const pair = el("div", "flex min-h-0 flex-1 items-end justify-center gap-0.5 sm:gap-1");
          const bar = (value: number, colour: string) => {
            const b = el("span", `block w-full max-w-4 rounded-t ${colour} ${on ? "opacity-100" : "opacity-70 group-hover:opacity-100"}`);
            b.style.height = `${Math.max(1.5, (value / max) * 100)}%`;
            return b;
          };
          pair.append(bar(vam[d] ?? 0, "bg-nof-clothes"), bar(met[d] ?? 0, "bg-nof-scenes"));
          const label = el("span", `text-center font-mono text-[10px] sm:text-[11px] ${on ? "font-bold text-nof-text" : "text-nof-muted"}`, `'${String(d).slice(2)}`);
          button.append(pair, label);
          if (youDecade === d) {
            const you = el("span", "text-center font-mono text-[9px] font-bold uppercase text-nof-pink", "you");
            button.append(you);
          }
          button.addEventListener("click", () => pick(d));
          button.addEventListener("pointerenter", () => (tip.textContent = describe(d)));
          button.addEventListener("focus", () => (tip.textContent = describe(d)));
          return button;
        }),
      );
      tip.textContent = describe(decade);
    };

    const renderGrid = () => {
      const list = inDecade(decade);
      title.textContent = `The ${decade}s wardrobe`;
      count.textContent = list.length ? `${list.length} piece${list.length === 1 ? "" : "s"}` : "";
      if (!list.length) {
        grid.replaceChildren(
          el("li", "col-span-full rounded-2xl border border-dashed border-nof-line p-6 text-center font-nof-body text-sm text-nof-muted", "The museums barely kept anything from this decade yet. Give them time, they're still deciding if it was good."),
        );
        return;
      }
      grid.replaceChildren(
        ...list.slice(0, context.compact ? 8 : 40).map(({ example, trends }) => {
          const li = el("li", "");
          const a = el("a", "group flex h-full flex-col overflow-hidden rounded-2xl border border-nof-line bg-nof-panel transition-colors hover:border-nof-muted");
          a.setAttribute("href", example.url);
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener");
          const pic = el("div", "aspect-[3/4] overflow-hidden bg-nof-raised");
          const img = el("img", "h-full w-full object-cover transition-transform duration-500 group-hover:scale-105");
          img.loading = "lazy";
          img.decoding = "async";
          img.src = example.image.replace("!800,", "!400,");
          img.alt = `${example.title}${example.designer ? ` by ${example.designer}` : ""}, ${example.year}`;
          img.addEventListener("error", () => pic.replaceChildren(el("div", "grid h-full place-items-center p-3 text-center font-nof-body text-xs text-nof-muted", "Picture's gone walkabout")));
          pic.append(img);
          const body = el("div", "flex flex-1 flex-col gap-0.5 p-3 font-nof-body");
          body.append(el("p", "text-sm font-semibold leading-snug text-nof-text", example.title));
          const who = [example.designer, example.place].filter(Boolean).join(", ");
          if (who) body.append(el("p", "text-xs text-nof-sub", who));
          let yearLine = String(example.year);
          if (context.born) {
            const age = example.year - context.born;
            yearLine += age < 0 ? ` · ${-age} years before you` : ` · you were ${age}`;
          }
          body.append(el("p", "font-mono text-[11px] text-nof-muted", yearLine));
          const tags = el("p", "mt-auto pt-2 text-[11px] text-nof-pink", trends.slice(0, 2).map((t) => t.name).join(" · "));
          body.append(tags);
          a.append(pic, body);
          li.append(a);
          return li;
        }),
      );
    };

    const pick = (d: number, user = true) => {
      decade = d;
      if (user) context.setParam("decade", String(d));
      renderBars();
      renderGrid();
    };

    renderBars();
    renderGrid();

    return {
      destroy() {
        root.replaceChildren();
      },
      update(params) {
        const d = Number(params.decade);
        if (DECADES.includes(d) && d !== decade) pick(d, false);
      },
    };
  },
};

export default view;
