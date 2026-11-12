// Her shape, 1920 to now: one women's daywear silhouette morphing through the decades.
// The keyframes are editorial, drawn from the decade in fashion articles, not measured.

import { FIRST_YEAR, NOW_YEAR, clamp, token } from "../data";
import { FONT, reducedMotion, stage } from "../stage";
import type { View } from "../view";

interface Shape {
  sh: number; // half shoulder width
  wy: number; // waist height
  ww: number; // half waist width
  hw: number; // half hip width
  hy: number; // hem height (1 = floor)
  hmw: number; // half hem width
  sp: number; // 1 = trousers
}

const KF: [number, Shape][] = [
  [1920, { sh: 0.105, wy: 0.45, ww: 0.085, hw: 0.092, hy: 0.66, hmw: 0.095, sp: 0 }],
  [1925, { sh: 0.11, wy: 0.46, ww: 0.085, hw: 0.095, hy: 0.7, hmw: 0.1, sp: 0 }],
  [1935, { sh: 0.1, wy: 0.36, ww: 0.062, hw: 0.085, hy: 0.95, hmw: 0.125, sp: 0 }],
  [1945, { sh: 0.14, wy: 0.36, ww: 0.068, hw: 0.09, hy: 0.72, hmw: 0.13, sp: 0 }],
  [1955, { sh: 0.1, wy: 0.35, ww: 0.05, hw: 0.17, hy: 0.8, hmw: 0.235, sp: 0 }],
  [1966, { sh: 0.095, wy: 0.41, ww: 0.092, hw: 0.096, hy: 0.55, hmw: 0.112, sp: 0 }],
  [1975, { sh: 0.1, wy: 0.37, ww: 0.065, hw: 0.09, hy: 0.985, hmw: 0.165, sp: 1 }],
  [1986, { sh: 0.165, wy: 0.38, ww: 0.072, hw: 0.085, hy: 0.63, hmw: 0.078, sp: 0 }],
  [1996, { sh: 0.085, wy: 0.36, ww: 0.064, hw: 0.08, hy: 0.93, hmw: 0.09, sp: 0 }],
  [2002, { sh: 0.09, wy: 0.45, ww: 0.08, hw: 0.09, hy: 0.985, hmw: 0.12, sp: 1 }],
  [2012, { sh: 0.09, wy: 0.38, ww: 0.07, hw: 0.085, hy: 0.965, hmw: 0.042, sp: 1 }],
  [2022, { sh: 0.125, wy: 0.37, ww: 0.095, hw: 0.115, hy: 0.99, hmw: 0.175, sp: 1 }],
];

type Anchor = "shoulder" | "waist" | "hip" | "hem";
const NOTES: { from: number; to: number; text: string; at: Anchor }[] = [
  { from: 1920, to: 1929, text: "Corset's gone. The waist drops to the hips and nobody looks back", at: "waist" },
  { from: 1930, to: 1939, text: "Bias cut. Hems head back down and curves come back in", at: "hip" },
  { from: 1940, to: 1946, text: "Rationing: square shoulders, short skirts, not a scrap of spare fabric", at: "shoulder" },
  { from: 1947, to: 1957, text: "Dior's New Look: a tiny waist and a skirt the size of a tent", at: "waist" },
  { from: 1958, to: 1963, text: "The shift dress loosens everything up", at: "hip" },
  { from: 1964, to: 1970, text: "Knees out in public. Grandmothers faint", at: "hem" },
  { from: 1971, to: 1979, text: "Flares, and trousers stop being a statement", at: "hem" },
  { from: 1980, to: 1990, text: "Shoulder pads. Office armour for the big meeting", at: "shoulder" },
  { from: 1991, to: 1999, text: "The slip dress. Minimalism, but make it a nightie", at: "hip" },
  { from: 2000, to: 2007, text: "Low rise. The waistband moves to somewhere around the hips", at: "waist" },
  { from: 2008, to: 2016, text: "Skinny jeans. Everything shrinks to the ankle", at: "hem" },
  { from: 2017, to: 2026, text: "Oversized and wide leg. Room to breathe at last", at: "hem" },
];

const ease = (t: number) => t * t * (3 - 2 * t);
function shapeAt(year: number): Shape {
  const y = clamp(year, KF[0][0], KF[KF.length - 1][0]);
  let i = 0;
  while (i < KF.length - 2 && KF[i + 1][0] <= y) i++;
  const [ya, a] = KF[i];
  const [yb, b] = KF[i + 1];
  const t = ease(clamp((y - ya) / (yb - ya), 0, 1));
  const out = {} as Shape;
  for (const key of Object.keys(a) as (keyof Shape)[]) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

function bodyPath(g: CanvasRenderingContext2D, s: Shape, X: (x: number) => number, Y: (y: number) => number) {
  const hip = Math.min(s.hy - 0.05, s.wy + 0.09);
  const crotch = s.hy + (Math.min(hip + 0.07, s.hy) - s.hy) * s.sp;
  const gap = Math.max(0, s.hmw * 0.3) * s.sp;
  const left: [number, number][] = [[-0.028, 0.135], [-s.sh, 0.175], [-s.sh * 0.78, 0.25], [-s.ww, s.wy], [-s.hw, hip], [-s.hmw, s.hy]];
  const pts = left.concat([[-gap, s.hy], [0, crotch], [gap, s.hy]], left.slice().reverse().map(([x, y]) => [-x, y] as [number, number]));
  g.beginPath();
  g.moveTo(X(pts[0][0]), Y(pts[0][1]));
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const sharp = (i >= 6 && i <= 8) || i === 5 || i === 9;
    if (sharp) g.lineTo(X(x1), Y(y1));
    else g.quadraticCurveTo(X(x0), Y(y0), X((x0 + x1) / 2), Y((y0 + y1) / 2));
  }
  g.lineTo(X(pts[pts.length - 1][0]), Y(pts[pts.length - 1][1]));
  g.closePath();
}

function alpha(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function wrap(g: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width > max && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const hemWord = (hy: number) => (hy < 0.6 ? "mini" : hy < 0.75 ? "knee" : hy < 0.87 ? "midi" : hy < 0.96 ? "ankle" : "floor");
const waistWord = (wy: number) => (wy > 0.43 ? "dropped" : wy > 0.395 ? "low" : "natural");

const view: View = {
  id: "silhouette",
  tab: "shapes",
  order: 1,
  title: "Her shape, 1920 to now",
  blurb: "The typical women's daywear silhouette, decade by decade. Watch the waist wander and the hem panic",
  how: "Drag across the figure to scrub through time. The faint outlines are where she was a few years ago",
  sources: [],
  mount(el, context) {
    const { nerds } = context;
    const ink = token("--color-nof-text", "#f2eee6");
    const muted = token("--color-nof-muted", "#a39fae");
    const pink = token("--color-nof-pink", "#ff6fa8");
    const night = token("--color-nof-night", "#0e0d12");
    const line = token("--color-nof-line", "#302c3a");
    const motion = !reducedMotion();

    const start = Number(context.params.year);
    let year = Number.isFinite(start) && start >= FIRST_YEAR ? clamp(start, FIRST_YEAR, NOW_YEAR) : 1948;
    let target = year;
    let playing = !context.params.year && motion;
    let dragging = false;
    const milestones = context.born ? nerds.milestones(context.born) : [];

    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-3";
    el.append(wrapper);
    const canvasBox = document.createElement("div");
    canvasBox.className = "overflow-hidden rounded-2xl border border-nof-line bg-nof-night";
    wrapper.append(canvasBox);

    const scene = stage(canvasBox, {
      height: context.compact ? "clamp(360px, 58vh, 520px)" : "clamp(440px, 72vh, 640px)",
      animate: true,
      label: "A women's silhouette changing shape from 1920 to today, with measurements of shoulder, waist and hem",
      render({ ctx: g, width: w, height: h, dt }, pointer) {
        if (dragging && pointer.inside) target = FIRST_YEAR + clamp(pointer.x / w, 0, 1) * (NOW_YEAR - FIRST_YEAR);
        else if (playing) {
          target += dt * 3.4;
          if (target > NOW_YEAR) target = FIRST_YEAR;
        }
        year = dragging || playing ? year + (target - year) * Math.min(1, dt * 12) : target;
        if (playing && target === FIRST_YEAR) year = FIRST_YEAR;
        syncControls();

        g.fillStyle = night;
        g.fillRect(0, 0, w, h);
        const narrow = w < 560;
        const H = Math.min(h * 0.82, w * 1.35);
        const top = h * 0.07;
        const cx = narrow ? w * 0.56 : w * 0.5;
        const X = (x: number) => cx + x * H;
        const Y = (y: number) => top + y * H;

        // Pattern paper.
        g.strokeStyle = alpha(ink, 0.035);
        g.lineWidth = 1;
        for (let gx = cx % 24; gx < w; gx += 24) {
          g.beginPath();
          g.moveTo(gx, 0);
          g.lineTo(gx, h);
          g.stroke();
        }
        for (let gy = 0; gy < h; gy += 24) {
          g.beginPath();
          g.moveTo(0, gy);
          g.lineTo(w, gy);
          g.stroke();
        }

        // Ghosts of the last sixteen years.
        for (let k = 4; k >= 1; k--) {
          const ghost = year - k * 4;
          if (ghost < FIRST_YEAR) continue;
          bodyPath(g, shapeAt(ghost), X, Y);
          g.strokeStyle = alpha(nerds.colour(ghost), 0.55 - k * 0.1);
          g.lineWidth = 1.2;
          g.stroke();
        }

        const s = shapeAt(year);
        const colour = nerds.colour(year);
        if (s.sp < 0.5 && s.hy < 0.97) {
          g.strokeStyle = alpha(ink, 0.55);
          g.lineWidth = 1.4;
          for (const lx of [-0.03, 0.03]) {
            g.beginPath();
            g.moveTo(X(lx), Y(s.hy));
            g.lineTo(X(lx * 0.8), Y(0.99));
            g.stroke();
          }
        }
        g.strokeStyle = alpha(ink, 0.6);
        g.lineWidth = 1.4;
        for (const side of [-1, 1]) {
          g.beginPath();
          g.moveTo(X(side * s.sh * 0.96), Y(0.18));
          g.quadraticCurveTo(X(side * (s.sh + 0.03)), Y(0.32), X(side * (s.hw + 0.03)), Y(0.47));
          g.stroke();
        }
        bodyPath(g, s, X, Y);
        const fill = g.createLinearGradient(0, Y(0.13), 0, Y(s.hy));
        fill.addColorStop(0, alpha(colour, 0.75));
        fill.addColorStop(1, colour);
        g.fillStyle = fill;
        g.fill();
        g.strokeStyle = ink;
        g.lineWidth = 2;
        g.stroke();
        g.beginPath();
        g.arc(X(0), Y(0.065), H * 0.052, 0, Math.PI * 2);
        g.stroke();
        g.beginPath();
        g.moveTo(X(0), Y(0.117));
        g.lineTo(X(0), Y(0.135));
        g.stroke();

        // Measurements, like a pattern cutter's drawing.
        const label = (text: string, x: number, y: number, align: CanvasTextAlign = "left", colourText = pink, size = 10) => {
          g.font = FONT.mono(size);
          const tw = g.measureText(text).width;
          const left = align === "left" ? clamp(x, 6, w - tw - 6) : align === "right" ? clamp(x - tw, 6, w - tw - 6) : clamp(x - tw / 2, 6, w - tw - 6);
          g.textAlign = "left";
          g.textBaseline = "middle";
          g.fillStyle = colourText;
          g.fillText(text, left, y);
        };
        g.strokeStyle = pink;
        g.fillStyle = pink;
        g.lineWidth = 1;
        const dim = (x1: number, y1: number, x2: number, y2: number) => {
          g.beginPath();
          g.moveTo(x1, y1);
          g.lineTo(x2, y2);
          g.stroke();
          for (const [a, b] of [[x1, y1], [x2, y2]]) {
            g.beginPath();
            g.arc(a, b, 2.2, 0, Math.PI * 2);
            g.fill();
          }
        };
        dim(X(-s.sh), Y(0.145), X(s.sh), Y(0.145));
        label(`shoulder ${(s.sh * 200).toFixed(0)}`, X(s.sh) + 10, Y(0.15));
        dim(X(-s.ww), Y(s.wy), X(s.ww), Y(s.wy));
        label(`waist ${waistWord(s.wy)}`, X(Math.max(s.hw, s.sh)) + 10, Y(s.wy) + 4);
        dim(X(-s.hmw), Y(s.hy) + 10, X(s.hmw), Y(s.hy) + 10);
        label(`hem ${hemWord(s.hy)}`, X(s.hmw) + 10, Y(s.hy) + 14);
        g.setLineDash([3, 4]);
        g.strokeStyle = pink;
        g.beginPath();
        g.moveTo(Math.max(8, X(-0.32)), Y(s.hy));
        g.lineTo(X(-s.hmw) - 6, Y(s.hy));
        g.stroke();
        g.setLineDash([]);
        label(narrow ? `${Math.round((1 - s.hy) * 100)}% leg` : `${Math.round((1 - s.hy) * 100)}% leg showing`, Math.max(8, X(-0.32)), Y(s.hy) - 8);

        // The note pinned to the figure for this era.
        const note = NOTES.find((n) => year >= n.from && year < n.to + 1);
        if (note) {
          const anchor =
            note.at === "shoulder" ? [X(-s.sh), Y(0.175)] : note.at === "waist" ? [X(-s.ww), Y(s.wy)] : note.at === "hip" ? [X(-s.hw), Y(Math.min(s.hy - 0.05, s.wy + 0.09))] : [X(-s.hmw), Y(s.hy)];
          const boxW = narrow ? Math.min(w * 0.4, 170) : Math.min(w * 0.26, 240);
          const size = narrow ? 13 : 15;
          g.font = FONT.display(size, 500, true);
          const lines = wrap(g, note.text, boxW);
          const bx = 14;
          const by = narrow ? 44 : 58;
          const lead = size * 1.25;
          g.fillStyle = ink;
          g.textAlign = "left";
          g.textBaseline = "top";
          lines.forEach((text, i) => g.fillText(text, bx, by + i * lead));
          const endY = by + lines.length * lead + 4;
          g.strokeStyle = alpha(ink, 0.5);
          g.lineWidth = 1;
          g.setLineDash([2, 3]);
          g.beginPath();
          g.moveTo(bx, endY);
          g.lineTo(Math.min(bx + boxW * 0.6, anchor[0] - 20), endY);
          g.lineTo(anchor[0] - 4, anchor[1]);
          g.stroke();
          g.setLineDash([]);
          g.fillStyle = ink;
          g.beginPath();
          g.arc(anchor[0] - 4, anchor[1], 3, 0, Math.PI * 2);
          g.fill();
        }

        // Header: who this is.
        label("WOMEN'S DAYWEAR · TYPICAL SILHOUETTE", 14, 22, "left", muted, narrow ? 9 : 10);
        label(dragging ? "scrubbing" : narrow ? "" : "drag to scrub", w - 14, 22, "right", muted, 10);

        // Year, outfit type and a colour strip timeline with the reader's milestones.
        const yearSize = clamp(w * 0.12, 44, 140);
        g.font = FONT.display(yearSize, 700);
        g.fillStyle = ink;
        g.textAlign = "left";
        g.textBaseline = "alphabetic";
        g.fillText(String(Math.floor(year)), 14, h - 34);
        label(`${s.sp > 0.5 ? "trousers" : "dress"} · ${Math.floor(year / 10) * 10}s`, 16, h - 16, "left", muted);
        const stripX = narrow ? w * 0.52 : w * 0.55;
        const stripW = w - stripX - 14;
        const span = NOW_YEAR - FIRST_YEAR + 1;
        for (let k = 0; k < span; k++) {
          g.fillStyle = nerds.colour(FIRST_YEAR + k);
          g.fillRect(stripX + (k * stripW) / span, h - 22, stripW / span + 0.5, 6);
        }
        for (const m of milestones) {
          const mx = stripX + ((m.year - FIRST_YEAR) * stripW) / span;
          g.fillStyle = pink;
          g.fillRect(mx - 0.5, h - 32, 1.5, 6);
        }
        g.fillStyle = ink;
        g.fillRect(stripX + ((year - FIRST_YEAR) * stripW) / span - 1, h - 28, 2, 18);
        const mine = milestones.find((m) => Math.abs(m.year - year) < 0.6);
        if (mine) label(`you: ${mine.label.toLowerCase()}`, stripX, h - 40, "left", pink);
        g.strokeStyle = line;
      },
    });

    // Grabbing the figure shouldn't scroll the page on a phone.
    const onTouch = (event: TouchEvent) => {
      if (dragging) event.preventDefault();
    };
    scene.canvas.addEventListener("touchmove", onTouch, { passive: false });
    const onDown = () => {
      dragging = true;
      playing = false;
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      year = target;
      context.setParam("year", String(Math.round(year)));
    };
    scene.canvas.addEventListener("pointerdown", onDown);
    addEventListener("pointerup", onUp);

    // Controls: play, a slider for keyboards, and your years.
    const controls = document.createElement("div");
    controls.className = "flex flex-wrap items-center gap-3";
    wrapper.append(controls);
    const play = document.createElement("button");
    play.type = "button";
    play.className = "rounded-full border border-nof-line bg-nof-panel px-4 py-2 font-nof-body text-sm font-semibold text-nof-text hover:border-nof-pink";
    play.addEventListener("click", () => {
      playing = !playing;
      if (playing && !motion) playing = false;
      syncControls();
    });
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(FIRST_YEAR);
    slider.max = String(NOW_YEAR);
    slider.step = "1";
    slider.className = "min-w-40 flex-1 accent-nof-pink";
    slider.setAttribute("aria-label", "Year");
    slider.addEventListener("input", () => {
      playing = false;
      target = year = Number(slider.value);
    });
    slider.addEventListener("change", () => context.setParam("year", slider.value));
    if (motion) controls.append(play);
    controls.append(slider);

    if (milestones.length) {
      const chips = document.createElement("div");
      chips.className = "flex flex-wrap gap-2";
      const title = document.createElement("span");
      title.className = "self-center font-nof-body text-xs font-semibold uppercase tracking-widest text-nof-muted";
      title.textContent = "My years";
      chips.append(title);
      for (const m of milestones) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "rounded-full border border-nof-line px-3 py-1.5 font-nof-body text-xs text-nof-sub hover:border-nof-pink hover:text-nof-text";
        chip.textContent = `${m.label} · ${m.year}`;
        chip.addEventListener("click", () => {
          playing = false;
          target = year = m.year;
          context.setParam("year", String(m.year));
        });
        chips.append(chip);
      }
      wrapper.append(chips);
    }

    if (!context.compact) {
      const credit = document.createElement("p");
      credit.className = "font-nof-body text-xs text-nof-muted";
      credit.textContent =
        "Editor's drawing, not a measurement: one typical women's daywear shape per era, keyed by hand from Wikipedia's decade in fashion articles. Real wardrobes were messier.";
      wrapper.append(credit);
    }

    let shown = "";
    function syncControls() {
      const label = playing ? "Pause" : "Play";
      if (label !== shown) {
        play.textContent = label;
        shown = label;
      }
      const rounded = String(Math.round(year));
      if (slider.value !== rounded && document.activeElement !== slider) slider.value = rounded;
    }
    syncControls();

    return {
      update(params) {
        const next = Number(params.year);
        if (Number.isFinite(next) && params.year) {
          playing = false;
          target = year = clamp(next, FIRST_YEAR, NOW_YEAR);
        }
      },
      destroy() {
        removeEventListener("pointerup", onUp);
        scene.destroy();
        wrapper.remove();
      },
    };
  },
};

export default view;
