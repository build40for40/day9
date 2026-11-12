import { createApp, h, reactive } from "vue";
import type { Dataset } from "../globe/data";
import TrendGlobe from "../globe/TrendGlobe.vue";
import type { View } from "../view";

const read = (params: Record<string, string>) => ({ trend: params.trend ?? null, year: Number(params.year) || null });

const view: View = {
  id: "globe",
  tab: "world",
  order: 1,
  title: "Who wore it where?",
  blurb: "A century of trends pinned to the places that wore them, plus a guess at what comes back by 2029",
  how: "Drag the globe, scrub the years and tap a picture for its story. The last three years are a forecast, so take them with a pinch of salt.",
  sources: ["wikipedia", "ngram", "vam"],
  mount(root, context) {
    const focus = reactive(read(context.params));
    const host = document.createElement("div");
    host.className = context.compact ? "h-[440px]" : "h-[78svh] min-h-[560px]";
    root.append(host);
    const app = createApp({
      render: () =>
        h(TrendGlobe, {
          dataset: context.nerds.data as unknown as Dataset,
          focusTrend: focus.trend,
          focusYear: focus.year,
          onYear: (year: number) => context.setParam("year", String(year)),
          onTrend: (id: string | null) => context.setParam("trend", id),
        }),
    });
    app.mount(host);
    return {
      destroy: () => app.unmount(),
      update: (params) => Object.assign(focus, read(params)),
    };
  },
};

export default view;
