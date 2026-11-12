import { FAMILIES, FIRST_YEAR, NOW_YEAR, clamp, familyOf, token, type Family, type Trend } from "../data";
import { FONT, stage } from "../stage";
import type { View } from "../view";

const ORDER: Family[] = ["clothes", "scenes", "kit", "face"];
const DOT: Record<Family, string> = { clothes: "bg-nof-clothes", scenes: "bg-nof-scenes", kit: "bg-nof-kit", face: "bg-nof-face" };
const FALLBACK: Record<Family, string> = { clothes: "#5b8ef0", scenes: "#e2703a", kit: "#1fa583", face: "#a970da" };
const ROW = 18;
const SHORT: Record<Family, string> = { clothes: "Clothes", scenes: "Scenes", kit: "Shoes and bags", face: "Hair and face" };
const HEADER = 30;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function tooltip(parent: HTMLElement) {
  const box = el("div", "pointer-events-none absolute z-20 hidden max-w-[260px] rounded-lg border border-nof-line bg-nof-raised px-3 py-2 font-nof-body text-[13px] leading-snug text-nof-text shadow-lg");
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
      let top = y + 14;
      if (top + h > parent.clientHeight - 4) top = y - 14 - h;
      box.style.left = `${Math.max(4, left)}px`;
      box.style.top = `${Math.max(4, top)}px`;
    },
    hide: () => box.classList.add("hidden"),
  };
}

const firstYear = (trend: Trend) => Math.min(...trend.periods.map((period) => period.start), 9999);
const span = (a: number, b: number) => (a === b ? `${a}` : `${a} to ${b}`);

const view: View = {
  id: "board",
  tab: "trends",
  title: "The Big Board",
  blurb: "Every trend we could find, when it was on, in one very long scroll",
  how: "Scroll the rows, drag the pink line along the years, tap a row for its card.",
  sources: ["wikipedia"],
  order: 1,
  mount(host, context) {
    const { nerds } = context;
    const comebacks = new Map<string, { from: number; to: number }[]>();
    for (const revival of nerds.comebacks()) if (revival.trend) comebacks.set(revival.trend, [...(comebacks.get(revival.trend) ?? []), { from: revival.from, to: revival.to }]);
    const all = nerds.trends.filter((trend) => trend.periods.length).sort((a, b) => firstYear(a) - firstYear(b) || a.name.localeCompare(b.name));

    const families = new Set<Family>(ORDER);
    let query = "";
    let rows = all;
    let cursor = clamp(Number(context.params.year) || 1966, FIRST_YEAR, NOW_YEAR);
    let selected: string | null = context.params.trend ?? null;
    let hover = -1;

    const root = el("div", "flex flex-col gap-3 font-nof-body text-nof-text");
    host.append(root);

    // Controls: search and family chips.
    const controls = el("div", "flex flex-wrap items-center gap-2");
    const search = el("input", "min-w-0 flex-1 basis-full sm:basis-40 rounded-full border border-nof-line bg-nof-panel px-4 py-2 text-[15px] text-nof-text placeholder:text-nof-muted focus:border-nof-pink focus:outline-none");
    search.type = "search";
    search.placeholder = "Find a trend: flares, goth, bob…";
    search.setAttribute("aria-label", "Find a trend");
    controls.append(search);
    const chips = ORDER.map((family) => {
      const chip = el("button", "inline-flex items-center gap-2 rounded-full border border-nof-line px-3 py-1.5 text-[13px] text-nof-sub transition aria-[pressed=false]:opacity-45");
      chip.type = "button";
      chip.setAttribute("aria-pressed", "true");
      chip.title = FAMILIES[family].label;
      chip.append(el("span", `size-2.5 rounded-full ${DOT[family]}`), el("span", "", SHORT[family]));
      chip.addEventListener("click", () => {
        if (families.has(family) && families.size > 1) families.delete(family);
        else families.add(family);
        for (const [i, c] of chips.entries()) c.setAttribute("aria-pressed", String(families.has(ORDER[i])));
        refilter();
      });
      return chip;
    });
    controls.append(...chips);
    if (!context.compact) root.append(controls);

    // The board: a sticky canvas over a tall spacer, so the page scrolls natively and we only draw what's visible.
    const frame = el("div", "relative");
    const height = context.compact ? "min(56vh, 460px)" : "min(70vh, 640px)";
    const scroller = el("div", "relative overflow-y-auto overscroll-contain rounded-xl border border-nof-line bg-nof-panel");
    scroller.style.height = height;
    const sticky = el("div", "sticky top-0");
    const spacer = el("div");
    scroller.append(sticky, spacer);
    frame.append(scroller);
    root.append(frame);
    const tip = tooltip(frame);

    const card = el("article", "rounded-xl border border-nof-line bg-nof-panel p-4 sm:p-5");
    root.append(card);

    let pointerType = "mouse";
    let dragging = false;
    let downAt: { x: number; y: number } | null = null;

    const colours = () => Object.fromEntries(ORDER.map((family) => [family, token(FAMILIES[family].token, FALLBACK[family])])) as Record<Family, string>;
    let paint = colours();

    const geometry = (width: number) => {
      const labelW = width < 520 ? 112 : 196;
      const x0 = labelW + 10;
      const x1 = width - 12;
      const x = (year: number) => x0 + ((year - FIRST_YEAR) / (NOW_YEAR - FIRST_YEAR)) * (x1 - x0);
      const yearAt = (px: number) => clamp(Math.round(FIRST_YEAR + ((px - x0) / (x1 - x0)) * (NOW_YEAR - FIRST_YEAR)), FIRST_YEAR, NOW_YEAR);
      return { labelW, x0, x1, x, yearAt };
    };

    const st = stage(sticky, {
      height: `calc(${height} - 2px)`,
      label: "Every fashion trend from 1920 to now as a row of bars showing when it was in style",
      render({ ctx, width, height: h }, pointer) {
        const g = geometry(width);
        const top = scroller.scrollTop;
        const panel = token("--color-nof-panel", "#17151d");
        const raised = token("--color-nof-raised", "#211e29");
        const line = token("--color-nof-line", "#302c3a");
        const muted = token("--color-nof-muted", "#a39fae");
        const text = token("--color-nof-text", "#f2eee6");
        const pink = token("--color-nof-pink", "#ff6fa8");
        const gold = token("--color-nof-gold", "#e8c27a");
        ctx.fillStyle = panel;
        ctx.fillRect(0, 0, width, h);

        // Decade grid.
        ctx.strokeStyle = line;
        ctx.lineWidth = 1;
        for (let decade = 1920; decade <= 2020; decade += 10) {
          const x = Math.round(g.x(decade)) + 0.5;
          ctx.beginPath();
          ctx.moveTo(x, HEADER);
          ctx.lineTo(x, h);
          ctx.stroke();
        }

        hover = pointer.inside && pointer.y > HEADER && !dragging ? Math.floor((pointer.y - HEADER + top) / ROW) : -1;
        if (hover >= rows.length) hover = -1;

        const first = Math.max(0, Math.floor(top / ROW));
        const last = Math.min(rows.length - 1, first + Math.ceil((h - HEADER) / ROW) + 1);
        const barH = ROW - 7;
        for (let i = first; i <= last; i++) {
          const trend = rows[i];
          const y = HEADER + i * ROW - top;
          if (i === hover || trend.id === selected) {
            ctx.fillStyle = raised;
            ctx.fillRect(0, y, width, ROW);
          }
          const on = nerds.presence(trend, cursor) > 0.5;
          ctx.fillStyle = trend.id === selected ? pink : on ? text : muted;
          ctx.font = FONT.body(width < 520 ? 11 : 12, on || trend.id === selected ? 600 : 500);
          ctx.textBaseline = "middle";
          let name = trend.name;
          while (ctx.measureText(name).width > g.labelW - 6 && name.length > 4) name = `${name.slice(0, -2)}…`;
          ctx.fillText(name, 8, y + ROW / 2);
          const colour = paint[familyOf(trend.category)];
          for (const period of trend.periods) {
            const a = g.x(clamp(period.start, FIRST_YEAR, NOW_YEAR));
            const b = Math.max(a + 3, g.x(clamp(period.end + 1, FIRST_YEAR, NOW_YEAR)));
            ctx.globalAlpha = period.region === "global" ? 0.75 : 1;
            ctx.fillStyle = colour;
            ctx.beginPath();
            ctx.roundRect(a, y + (ROW - barH) / 2, b - a, barH, 3);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // Your milestones.
        if (context.born) {
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = gold;
          ctx.fillStyle = gold;
          ctx.font = FONT.mono(10, 600);
          ctx.textBaseline = "bottom";
          const narrow = width < 520;
          for (const [k, m] of nerds.milestones(context.born).filter((m) => m.age === 0 || m.age === 16).entries()) {
            const x = Math.round(g.x(m.year)) + 0.5;
            ctx.beginPath();
            ctx.moveTo(x, HEADER);
            ctx.lineTo(x, h);
            ctx.stroke();
            ctx.textAlign = x > width - 70 ? "right" : "left";
            const label = narrow ? (m.age === 0 ? " you " : " 16 ") : m.age === 0 ? " you're born " : " you're 16 ";
            ctx.fillText(label, x, h - 4 - (narrow ? k * 12 : 0));
          }
          ctx.setLineDash([]);
          ctx.textAlign = "left";
        }

        // Header with decades.
        ctx.fillStyle = panel;
        ctx.fillRect(0, 0, width, HEADER);
        ctx.fillStyle = line;
        ctx.fillRect(0, HEADER - 1, width, 1);
        ctx.fillStyle = muted;
        ctx.font = FONT.mono(10);
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";
        const step = width < 520 ? 20 : 10;
        for (let decade = 1920; decade <= 2020; decade += step) ctx.fillText(width < 520 ? `'${String(decade).slice(2)}` : `${decade}`, g.x(decade), HEADER / 2);
        ctx.textAlign = "left";
        ctx.font = FONT.mono(10, 600);
        ctx.fillText(`${rows.length} trends`, 8, HEADER / 2);

        // The year cursor.
        const cx = Math.round(g.x(cursor + 0.5)) + 0.5;
        ctx.strokeStyle = pink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx, HEADER - 4);
        ctx.lineTo(cx, h);
        ctx.stroke();
        const count = rows.filter((trend) => nerds.presence(trend, cursor) > 0.5).length;
        const label = `${cursor} · ${count} on`;
        ctx.font = FONT.mono(11, 700);
        const lw = ctx.measureText(label).width + 14;
        const lx = clamp(cx - lw / 2, 2, width - lw - 2);
        ctx.fillStyle = pink;
        ctx.beginPath();
        ctx.roundRect(lx, 4, lw, HEADER - 9, 10);
        ctx.fill();
        ctx.fillStyle = token("--color-nof-pink-ink", "#1f0612");
        ctx.textAlign = "center";
        ctx.fillText(label, lx + lw / 2, HEADER / 2 - 0.5);
        ctx.textAlign = "left";

        // Hover tooltip, mouse only: on touch the card does the job.
        if (hover >= 0 && pointerType === "mouse") {
          const trend = rows[hover];
          tip.show(pointer.x, pointer.y, (box) => {
            box.append(el("p", "font-semibold", trend.name));
            box.append(el("p", "text-nof-muted", trend.periods.map((p) => span(p.start, p.end)).join(", ")));
            box.append(el("p", "mt-1 text-[12px] text-nof-sub", "Tap for the full card"));
          });
        } else tip.hide();
      },
    });

    const layout = () => {
      const total = HEADER + rows.length * ROW + 8;
      spacer.style.height = `${Math.max(0, total - scroller.clientHeight)}px`;
    };

    const renderCard = () => {
      card.replaceChildren();
      const trend = selected ? nerds.byId.get(selected) : undefined;
      if (!trend) {
        card.append(el("p", "text-[15px] text-nof-muted", "Tap any row for its card: what it was, when it was on, and where Wikipedia says so."));
        return;
      }
      const family = familyOf(trend.category);
      const head = el("div", "flex flex-wrap items-baseline justify-between gap-2");
      head.append(el("h3", "font-nof-display text-[26px] leading-tight font-bold", trend.name));
      const tag = el("span", "inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.14em] text-nof-muted");
      tag.append(el("span", `size-2.5 rounded-full ${DOT[family]}`), el("span", "", `${trend.category} · ${trend.gender}`));
      head.append(tag);
      card.append(head);
      if (trend.description) card.append(el("p", "mt-2 text-[15px] leading-relaxed text-nof-sub", trend.description));

      const stats = el("dl", "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4");
      const comeback = comebacks.get(trend.id) ?? [];
      const stat = (label: string, value: string) => {
        const box = el("div", "rounded-lg bg-nof-raised px-3 py-2");
        box.append(el("dt", "text-[11px] uppercase tracking-[0.12em] text-nof-muted", label), el("dd", "font-mono text-[15px] font-semibold text-nof-text", value));
        stats.append(box);
      };
      stat("First seen", firstYear(trend) >= FIRST_YEAR ? `${firstYear(trend)}` : `before ${FIRST_YEAR}`);
      stat("Times on", `${trend.periods.length}`);
      stat("Comebacks", `${comeback.length}`);
      stat("Where", trend.regions.map((r) => (r === "global" ? "everywhere" : r)).join(", "));
      card.append(stats);

      const periods = el("p", "mt-3 text-[14px] text-nof-sub");
      periods.textContent = `On: ${trend.periods.map((p) => `${span(p.start, p.end)}${p.region === "global" ? "" : ` (${p.region})`}`).join(", ")}`;
      card.append(periods);
      if (comeback.length) card.append(el("p", "mt-1 text-[14px] text-nof-sub", `Came back: ${comeback.map((c) => `${c.from} look, back in ${c.to}`).join("; ")}`));

      const source = trend.sources[0];
      if (source) {
        const quote = el("blockquote", "mt-4 border-l-2 border-nof-pink pl-3 text-[14px] leading-relaxed text-nof-sub italic", `“${source.quote}”`);
        const link = el("a", "mt-1 inline-block text-[13px] text-nof-pink underline underline-offset-2", `Wikipedia: ${source.article}`);
        link.href = source.url;
        link.target = "_blank";
        link.rel = "noopener";
        card.append(quote, link);
      }
    };

    const refilter = () => {
      const q = query.trim().toLowerCase();
      rows = all.filter((trend) => families.has(familyOf(trend.category)) && (!q || trend.name.toLowerCase().includes(q) || trend.aliases.some((alias) => alias.toLowerCase().includes(q))));
      layout();
      st.draw();
    };

    const scrollTo = (id: string) => {
      const i = rows.findIndex((trend) => trend.id === id);
      if (i >= 0) scroller.scrollTop = Math.max(0, i * ROW - (scroller.clientHeight - HEADER) / 2);
    };

    search.addEventListener("input", () => {
      query = search.value;
      refilter();
    });
    scroller.addEventListener("scroll", () => st.draw(), { passive: true });

    const canvas = st.canvas;
    const local = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };
    canvas.addEventListener("pointerdown", (event) => {
      pointerType = event.pointerType;
      const p = local(event);
      const g = geometry(st.width);
      if (p.y < HEADER || Math.abs(p.x - g.x(cursor + 0.5)) < 12) {
        dragging = true;
        canvas.setPointerCapture(event.pointerId);
        cursor = g.yearAt(p.x);
        st.draw();
      } else downAt = p;
    });
    canvas.addEventListener("pointermove", (event) => {
      pointerType = event.pointerType;
      if (!dragging) return;
      cursor = geometry(st.width).yearAt(local(event).x);
      st.draw();
    });
    const finish = (event: PointerEvent) => {
      if (dragging) {
        dragging = false;
        context.setParam("year", String(cursor));
        st.draw();
        return;
      }
      if (!downAt) return;
      const p = local(event);
      if (Math.hypot(p.x - downAt.x, p.y - downAt.y) < 8 && p.y > HEADER) {
        const i = Math.floor((p.y - HEADER + scroller.scrollTop) / ROW);
        if (rows[i]) {
          selected = rows[i].id;
          context.setParam("trend", selected);
          renderCard();
          st.draw();
        }
      }
      downAt = null;
    };
    canvas.addEventListener("pointerup", finish);
    canvas.addEventListener("pointercancel", () => {
      dragging = false;
      downAt = null;
    });

    const themeWatch = new MutationObserver(() => {
      paint = colours();
      st.draw();
    });
    themeWatch.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });

    requestAnimationFrame(() => {
      layout();
      if (selected) scrollTo(selected);
      st.draw();
    });
    renderCard();

    return {
      update(params) {
        if (params.year) cursor = clamp(Number(params.year) || cursor, FIRST_YEAR, NOW_YEAR);
        if (params.trend && params.trend !== selected) {
          selected = params.trend;
          renderCard();
          scrollTo(selected);
        }
        st.draw();
      },
      destroy() {
        themeWatch.disconnect();
        st.destroy();
        root.remove();
      },
    };
  },
};

export default view;
