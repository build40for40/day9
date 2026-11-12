import { COLOUR_WORDS, FIRST_YEAR, NOW_YEAR, clamp, token, years } from "../data";
import { FONT, stage } from "../stage";
import type { View } from "../view";

const DECADES = [1920, 1930, 1940, 1950, 1960, 1970, 1980, 1990, 2000, 2010, 2020];

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function tooltip(parent: HTMLElement) {
  const box = el("div", "pointer-events-none absolute z-20 hidden w-max max-w-[260px] rounded-lg border border-nof-line bg-nof-raised px-3 py-2 font-nof-body text-[13px] leading-snug text-nof-text shadow-lg");
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
      box.style.top = `${clamp(y - h / 2, 4, Math.max(4, parent.clientHeight - h - 4))}px`;
    },
    hide: () => box.classList.add("hidden"),
  };
}

/** Relative luminance, to pick dark or light text on a swatch. */
function light(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35;
}

const view: View = {
  id: "colour",
  tab: "colour",
  title: "A century in colour",
  blurb: "One stripe per year, dyed in the colour that year couldn't stop wearing",
  how: "Hover or tap a stripe for its colour and where it comes from. The bars below show every colour the V&A wrote down, decade by decade.",
  sources: ["vam", "pantone"],
  order: 1,
  mount(host, context) {
    const { nerds } = context;
    const all = years();
    const words = Object.keys(nerds.data.colours.vam).filter((word) => COLOUR_WORDS[word]);
    const decadeRows = DECADES.map((decade) => {
      const counts = words.map((word) => ({ word, count: nerds.data.colours.vam[word][decade] ?? 0 })).filter((entry) => entry.count > 0);
      const total = counts.reduce((sum, entry) => sum + entry.count, 0);
      return { decade, total, counts: counts.sort((a, b) => b.count - a.count) };
    });

    const root = el("div", "flex flex-col gap-3 font-nof-body text-nof-text");
    host.append(root);

    const key = el("ul", "flex flex-col gap-1 text-[13px] text-nof-sub sm:flex-row sm:gap-6");
    const keyItem = (strong: string, rest: string) => {
      const item = el("li");
      item.append(el("span", "font-semibold text-nof-text", strong), document.createTextNode(` ${rest}`));
      return item;
    };
    key.append(keyItem("1920 to 1999:", "the colour V&A curators mention more that decade than any other, blended year to year."), keyItem("2000 on:", "Pantone's Colour of the Year. A marketing pick, not a measurement."));
    root.append(key);

    const top = el("div", "relative overflow-hidden rounded-xl border border-nof-line bg-nof-panel");
    root.append(top);
    const topTip = tooltip(top);
    let selected: number | null = context.params.year ? clamp(Number(context.params.year), FIRST_YEAR, NOW_YEAR) : null;

    const stripes = stage(top, {
      height: context.compact ? "min(40vh, 280px)" : "min(46vh, 380px)",
      label: "A stripe for every year from 1920 to now, coloured by that year's signature colour",
      render({ ctx, width, height }, pointer) {
        const pad = { left: 0, right: 0, top: 0, bottom: context.born ? 40 : 26 };
        const sw = width / all.length;
        const band = height - pad.bottom;
        const panel = token("--color-nof-panel", "#17151d");
        const muted = token("--color-nof-muted", "#a39fae");
        const text = token("--color-nof-text", "#f2eee6");
        const gold = token("--color-nof-gold", "#e8c27a");
        const night = token("--color-nof-night", "#0e0d12");
        ctx.fillStyle = panel;
        ctx.fillRect(0, 0, width, height);

        for (const [i, year] of all.entries()) {
          const pantone = nerds.pantone(year);
          const x = i * sw;
          if (pantone.length > 1) {
            // Pantone picked two that year: split the stripe.
            pantone.forEach((entry, k) => {
              ctx.fillStyle = entry.hex;
              ctx.fillRect(x, (band / pantone.length) * k, sw + 0.6, band / pantone.length + 0.6);
            });
          } else {
            ctx.fillStyle = nerds.colour(year);
            ctx.fillRect(x, 0, sw + 0.6, band);
          }
        }

        // Decade labels on little dark tags so they read over any colour.
        const narrow = width < 520;
        ctx.textAlign = "left";
        ctx.textBaseline = "top";
        for (const [k, decade] of DECADES.entries()) {
          const x = (decade - FIRST_YEAR) * sw;
          // On a phone, tags step across three rows so neighbours never collide.
          const row = narrow ? k % 3 : 0;
          const signature = nerds.decadeColours.get(decade);
          const lines = [narrow ? `'${String(decade).slice(2)}s` : `${decade}s`, decade >= 2000 ? "Pantone" : signature ? `${signature.word} ×${signature.lift.toFixed(1)}` : ""];
          ctx.font = FONT.mono(narrow ? 9 : 10, 600);
          const w = Math.max(...lines.map((line) => ctx.measureText(line).width)) + 10;
          const tx = clamp(x + 3, 2, width - w - 2);
          ctx.globalAlpha = 0.82;
          ctx.fillStyle = night;
          ctx.beginPath();
          const ty = 6 + row * 34;
          ctx.roundRect(tx, ty, w, 30, 6);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.fillStyle = text;
          ctx.fillText(lines[0], tx + 5, ty + 4);
          ctx.fillStyle = muted;
          ctx.fillText(lines[1], tx + 5, ty + 16);
        }

        // The museum to marketing seam.
        const seam = (2000 - FIRST_YEAR) * sw;
        ctx.strokeStyle = night;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(seam, narrow ? 108 : 40);
        ctx.lineTo(seam, band);
        ctx.stroke();
        ctx.fillStyle = muted;
        ctx.font = FONT.mono(10);
        ctx.textBaseline = "alphabetic";
        ctx.textAlign = "right";
        ctx.fillText("V&A descriptions", seam - 6, band + 16);
        ctx.textAlign = "left";
        ctx.fillText("Pantone", seam + 6, band + 16);

        if (context.born) {
          ctx.fillStyle = gold;
          ctx.font = FONT.mono(10, 600);
          ctx.textAlign = "center";
          for (const m of nerds.milestones(context.born).filter((m) => m.age === 0 || m.age === 16)) {
            const x = (m.year - FIRST_YEAR + 0.5) * sw;
            ctx.beginPath();
            ctx.moveTo(x, band + 22);
            ctx.lineTo(x - 4, band + 28);
            ctx.lineTo(x + 4, band + 28);
            ctx.fill();
            ctx.fillText(m.age === 0 ? "you" : "16", clamp(x, 12, width - 12), band + 39);
          }
        }

        const year = pointer.inside && pointer.y < band ? FIRST_YEAR + clamp(Math.floor(pointer.x / sw), 0, all.length - 1) : selected;
        if (year !== null) {
          const x = (year - FIRST_YEAR) * sw;
          ctx.strokeStyle = text;
          ctx.lineWidth = 2;
          ctx.strokeRect(x, 1, sw, band - 2);
          const pantone = nerds.pantone(year);
          const signature = nerds.decadeColours.get(Math.floor(year / 10) * 10);
          topTip.show(x + sw / 2, band / 2, (box) => {
            box.append(el("p", "font-mono text-[12px] font-semibold text-nof-pink", `${year}`));
            if (pantone.length) {
              for (const entry of pantone) box.append(el("p", "font-semibold", `${entry.name} · ${entry.hex}`));
              box.append(el("p", "mt-1 text-[12px] text-nof-muted", "Pantone's Colour of the Year"));
            } else if (year >= 2000) {
              box.append(el("p", "", "No Pantone pick, so we carry last year's on"));
            } else if (signature) {
              box.append(el("p", "font-semibold", `${nerds.colour(year)}`));
              box.append(el("p", "mt-1 text-[12px] text-nof-muted", `A blend towards the ${Math.floor(year / 10) * 10}s signature, ${signature.word}, which V&A descriptions mention ${signature.lift.toFixed(1)} times as often as usual`));
            }
          });
        } else topTip.hide();
      },
    });

    // Every colour word, per decade.
    root.append(el("h3", "mt-4 font-nof-display text-[24px] leading-tight font-bold", "What the curators wrote down"));
    root.append(el("p", "text-[13px] text-nof-muted", "Each bar is one decade of V&A womenswear, split by the colour words in its descriptions. Black wins every decade, which is why the stripes above use the colour each decade over-indexes on instead. After 2000 the museum barely collects, so those bars are tiny samples."));
    const bottom = el("div", "relative overflow-hidden rounded-xl border border-nof-line bg-nof-panel");
    root.append(bottom);
    const bottomTip = tooltip(bottom);

    const bars = stage(bottom, {
      height: context.compact ? "min(40vh, 300px)" : "min(48vh, 400px)",
      label: "Stacked bars of colour words in V&A womenswear descriptions per decade",
      render({ ctx, width, height }, pointer) {
        const pad = { left: 10, right: 10, top: 12, bottom: 40 };
        const n = decadeRows.length;
        const slot = (width - pad.left - pad.right) / n;
        const bw = Math.min(56, slot - 8);
        const panel = token("--color-nof-panel", "#17151d");
        const muted = token("--color-nof-muted", "#a39fae");
        const text = token("--color-nof-text", "#f2eee6");
        ctx.fillStyle = panel;
        ctx.fillRect(0, 0, width, height);
        const h = height - pad.top - pad.bottom;
        let hit: { decade: number; word: string; count: number; total: number } | null = null;
        let hitAt = { x: 0, y: 0 };
        for (const [i, row] of decadeRows.entries()) {
          const x = pad.left + i * slot + (slot - bw) / 2;
          let y = pad.top;
          for (const entry of row.counts) {
            const sh = (entry.count / row.total) * h;
            ctx.fillStyle = COLOUR_WORDS[entry.word];
            ctx.fillRect(x, y, bw, Math.max(0, sh - 2));
            if (entry.word === "black" || entry.word === "navy") {
              // Dark swatches need an edge, or they vanish into the night.
              ctx.strokeStyle = muted;
              ctx.lineWidth = 1;
              ctx.strokeRect(x + 0.5, y + 0.5, bw - 1, Math.max(0, sh - 3));
            }
            if (pointer.inside && pointer.x >= x && pointer.x <= x + bw && pointer.y >= y && pointer.y < y + sh) {
              hit = { decade: row.decade, word: entry.word, count: entry.count, total: row.total };
              hitAt = { x: x + bw / 2, y: y + sh / 2 };
              ctx.strokeStyle = text;
              ctx.lineWidth = 2;
              ctx.strokeRect(x - 1, y - 1, bw + 2, sh);
            }
            if (sh > 15 && bw > 34) {
              ctx.fillStyle = light(COLOUR_WORDS[entry.word]) ? "#141218" : "#f6f3ee";
              ctx.font = FONT.mono(9, 600);
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText(entry.word, x + bw / 2, y + sh / 2 - 1);
            }
            y += sh;
          }
          ctx.fillStyle = muted;
          ctx.font = FONT.mono(width < 520 ? 9 : 10);
          ctx.textAlign = "center";
          ctx.textBaseline = "alphabetic";
          ctx.fillText(width < 520 ? `'${String(row.decade).slice(2)}` : `${row.decade}s`, x + bw / 2, height - pad.bottom + 16);
          ctx.fillText(`${row.total}`, x + bw / 2, height - pad.bottom + 30);
        }
        if (hit) {
          const found = hit;
          bottomTip.show(hitAt.x, hitAt.y, (box) => {
            box.append(el("p", "font-mono text-[12px] font-semibold text-nof-pink", `${found.decade}s`));
            box.append(el("p", "font-semibold", `${found.word}: ${found.count} mentions`));
            box.append(el("p", "text-nof-muted", `${Math.round((found.count / found.total) * 100)}% of the decade's colour words`));
          });
        } else bottomTip.hide();
      },
    });
    root.append(el("p", "text-[12px] text-nof-muted", "Numbers under each bar are colour mentions that decade. Labels sit inside a colour when it's big enough; hover for the rest."));

    return {
      update(params) {
        selected = params.year ? clamp(Number(params.year), FIRST_YEAR, NOW_YEAR) : null;
        stripes.draw();
      },
      destroy() {
        stripes.destroy();
        bars.destroy();
        root.remove();
      },
    };
  },
};

export default view;
