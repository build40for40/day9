// The bits of DOM the forecast and book views share.

import { clamp, type Trend } from "./data";
import { loadForecast, type ForecastFile } from "./forecast";
import type { Mounted } from "./view";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const pct = (value: number) => {
  const v = value * 100;
  return `${Math.abs(v) < 10 ? +v.toFixed(1) : Math.round(v)}%`;
};
export const yrs = (n: number) => `${n} year${Math.abs(n) === 1 ? "" : "s"}`;

export function tooltip(parent: HTMLElement) {
  const box = el("div", "pointer-events-none absolute z-20 hidden w-max max-w-[260px] rounded-lg border border-nof-line bg-nof-raised px-3 py-2 font-nof-body text-[13px] leading-snug text-nof-text shadow-lg");
  parent.append(box);
  return {
    show(x: number, y: number, lines: string[]) {
      box.replaceChildren(...lines.map((line, i) => el("p", i ? "mt-1 text-nof-sub" : "font-mono text-[12px] font-semibold text-nof-pink", line)));
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

export const names = (trends: Trend[], most = 6) => {
  const unique = [...new Set(trends.map((trend) => trend.name))];
  return unique.slice(0, most).join(", ") + (unique.length > most ? ` and ${unique.length - most} more` : "");
};

export function figures(entries: [value: string, label: string][]) {
  const row = el("div", "flex flex-wrap items-end gap-x-8 gap-y-3");
  for (const [value, label] of entries) {
    const box = el("div", "max-w-[220px]");
    box.append(el("p", "font-nof-display text-[40px] leading-none font-bold text-nof-gold sm:text-[44px]", value), el("p", "mt-1 text-[13px] leading-snug text-nof-muted", label));
    row.append(box);
  }
  return row;
}

/** A key under a chart. Each swatch is a Tailwind class list for a small inline block. */
export function legend(items: [swatch: string, label: string][]) {
  const row = el("div", "flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-nof-sub");
  for (const [swatch, label] of items) {
    const item = el("span", "flex items-center gap-1.5");
    item.append(el("span", `inline-block shrink-0 ${swatch}`), el("span", "", label));
    row.append(item);
  }
  return row;
}

export function trendPicker(trends: Trend[], label: string, none?: string) {
  const field = el("label", "flex max-w-md flex-col gap-1 text-[13px] text-nof-muted");
  field.append(el("span", "", label));
  const select = el("select", "w-full rounded-lg border border-nof-line bg-nof-raised px-3 py-2.5 text-[15px] text-nof-text focus:border-nof-pink focus:outline-none");
  if (none) select.append(new Option(none, ""));
  for (const trend of trends.toSorted((a, b) => a.name.localeCompare(b.name))) select.append(new Option(trend.name, trend.id));
  field.append(select);
  return { field, select };
}

/** Mounts a view that needs forecast.json: a holding line until it lands, then `build`. */
export function withForecast(host: HTMLElement, build: (file: ForecastFile, root: HTMLElement) => Mounted): Mounted {
  const root = el("div", "flex flex-col gap-5 font-nof-body text-nof-text");
  const holding = el("p", "py-16 text-center font-nof-display text-xl italic text-nof-muted", "Polishing the crystal ball…");
  root.append(holding);
  host.append(root);
  let mounted: Mounted | undefined;
  let gone = false;
  let waiting: Record<string, string> | undefined;
  loadForecast().then(
    (file) => {
      if (gone) return;
      holding.remove();
      mounted = build(file, root);
      if (waiting) mounted.update?.(waiting);
    },
    () => {
      holding.textContent = "The forecast didn't turn up. Give the page a refresh.";
    },
  );
  return {
    update(params) {
      if (mounted) mounted.update?.(params);
      else waiting = params;
    },
    destroy() {
      gone = true;
      mounted?.destroy();
      root.remove();
    },
  };
}
