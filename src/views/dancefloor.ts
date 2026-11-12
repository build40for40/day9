// The Dance Floor: the year's defining trends as dancers. Popular ones own the middle,
// fading ones are wallflowers, and how everyone moves follows the decade's dance.

import { FAMILIES, FIRST_YEAR, NOW_YEAR, clamp, familyOf, token, type Family, type Trend } from "../data";
import { FONT, reducedMotion, stage } from "../stage";
import type { View } from "../view";

type Style = "charleston" | "waltz" | "jitterbug" | "sockhop" | "twist" | "disco" | "cypher" | "mosh" | "indie" | "festival" | "phones";
const STYLES: Record<number, { style: Style; name: string; note: string }> = {
  1920: { style: "charleston", name: "The Charleston", note: "Knees, elbows, bad decisions" },
  1930: { style: "waltz", name: "The ballroom waltz", note: "In pairs, anticlockwise, nobody improvises" },
  1940: { style: "jitterbug", name: "The jitterbug", note: "Partners thrown about like luggage" },
  1950: { style: "sockhop", name: "The sock hop", note: "Two lines, polite gaps, a teacher watching" },
  1960: { style: "twist", name: "The twist", note: "Everyone solo, spinning on the spot" },
  1970: { style: "disco", name: "Disco", note: "Light-up floor, one finger to the ceiling" },
  1980: { style: "cypher", name: "The breakdance cypher", note: "A circle, and the year's biggest look spinning on its head" },
  1990: { style: "mosh", name: "The mosh pit", note: "Finally, the decade it belongs to" },
  2000: { style: "indie", name: "The indie club", note: "Sticky floor, everyone bouncing, nobody smiling" },
  2010: { style: "festival", name: "The festival", note: "Facing the stage, phones up, missing it all" },
  2020: { style: "phones", name: "The phone screen", note: "Everyone dancing alone, in a little rectangle" },
};
const styleFor = (year: number) => STYLES[clamp(Math.floor(year / 10) * 10, 1920, 2020)];

interface Dancer {
  trend: Trend;
  colour: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  fade: number;
  leaving: boolean;
  rank: number;
  presence: number;
  wall: boolean;
  fresh: boolean;
}

function alpha(hex: string, a: number) {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const view: View = {
  id: "dancefloor",
  tab: "trends",
  order: 2,
  title: "The Dance Floor",
  blurb: "Each year's big trends hit the floor. The popular ones own the middle, and the dance changes with the decade",
  how: "Grab a dancer and fling it. Tap one to see what it is, tap the floor to pause, or drag the slider to change the year",
  sources: ["wikipedia", "vam", "met"],
  mount(el, context) {
    const { nerds } = context;
    const ink = token("--color-nof-text", "#f2eee6");
    const muted = token("--color-nof-muted", "#a39fae");
    const pink = token("--color-nof-pink", "#ff6fa8");
    const night = token("--color-nof-night", "#0e0d12");
    const panel = token("--color-nof-panel", "#17151d");
    const colours = Object.fromEntries((Object.keys(FAMILIES) as Family[]).map((f) => [f, token(FAMILIES[f].token, "#888888")])) as Record<Family, string>;
    const motion = !reducedMotion();
    const amp = motion ? 1 : 0;

    const fromParams = Number(context.params.year);
    let year = Number.isFinite(fromParams) && context.params.year ? clamp(fromParams, FIRST_YEAR, NOW_YEAR) : clamp(context.born ? context.born + 16 : 1966, FIRST_YEAR, NOW_YEAR);
    let playing = motion && !context.params.year;
    let shownYear = -1;
    const dancers = new Map<string, Dancer>();
    let grabbed: Dancer | null = null;
    let grabTrail: { x: number; y: number; t: number }[] = [];
    let downAt: { x: number; y: number } | null = null;
    let t = 0;

    const wrapper = document.createElement("div");
    wrapper.className = "flex flex-col gap-3";
    el.append(wrapper);
    const box = document.createElement("div");
    box.className = "overflow-hidden rounded-2xl border border-nof-line bg-nof-night";
    wrapper.append(box);

    function cast(w: number, h: number) {
      const y = Math.floor(year);
      if (y === shownYear) return;
      shownYear = y;
      const top = nerds.top(y, 14);
      const keep = new Set(top.map((trend) => trend.id));
      const first = dancers.size === 0;
      for (const d of dancers.values()) if (!keep.has(d.trend.id)) d.leaving = true;
      top.forEach((trend, rank) => {
        let d = dancers.get(trend.id);
        if (!d) {
          const edge = hash(trend.id.length * 7 + rank) * 4;
          const along = hash(rank * 13 + trend.name.length);
          const x = edge < 1 ? along * w : edge < 2 ? w + 20 : edge < 3 ? along * w : -20;
          const yy = edge < 1 ? -20 : edge < 2 ? along * h : edge < 3 ? h + 20 : along * h;
          d = { trend, colour: colours[familyOf(trend.category)], x, y: yy, vx: 0, vy: 0, r: 4, phase: hash(rank + trend.id.length * 3) * Math.PI * 2, fade: 0, leaving: false, rank, presence: 0, wall: false, fresh: first };
          dancers.set(trend.id, d);
        }
        d.leaving = false;
        d.rank = rank;
        d.presence = nerds.presence(trend, y);
        d.wall = d.presence < 0.45;
      });
      syncControls();
    }

    const scene = stage(box, {
      height: context.compact ? "clamp(360px, 60vh, 540px)" : "clamp(440px, 74vh, 680px)",
      animate: true,
      label: "A dance floor where each year's biggest fashion trends dance in the style of the decade",
      render({ ctx: g, width: w, height: h, dt }, pointer) {
        t += dt;
        if (playing && !grabbed) {
          year += dt * 0.7;
          if (year >= NOW_YEAR + 1) year = FIRST_YEAR;
        }
        cast(w, h);
        const { style, name, note } = styleFor(year);
        const cx = w / 2;
        const cy = h / 2 + 10;
        const F = Math.min(w, h);
        const sc = clamp(F / 520, 0.78, 1.35);
        const yearColour = nerds.colour(Math.floor(year));

        // Who's dancing and who's holding up the wall.
        const all = [...dancers.values()];
        const active = all.filter((d) => !d.leaving && !d.wall).sort((a, b) => a.rank - b.rank);
        const walls = all.filter((d) => !d.leaving && d.wall).sort((a, b) => a.rank - b.rank);
        const k = Math.max(1, active.length);
        const cols = w < 520 ? 3 : 5;
        const cellW = (w - 24) / cols;
        const rowsN = Math.ceil(k / cols);
        const cellH = Math.min((h - 110) / Math.max(1, rowsN), cellW * 1.6);
        const phoneTop = 70 + Math.max(0, (h - 100 - rowsN * cellH) / 2);

        const targetOf = (d: Dancer, i: number): [number, number] => {
          const ph = d.phase;
          const spiral = (): [number, number] => {
            const radius = F * 0.05 + (i / k) * F * 0.3;
            const a = i * 2.39996 + 0.6;
            return [cx + Math.cos(a) * radius * (w > h ? 1.3 : 1), cy + Math.sin(a) * radius];
          };
          switch (style) {
            case "charleston": {
              const [x, y] = spiral();
              return [x + Math.sin(t * 8 + ph) * 7 * sc * amp, y - Math.abs(Math.sin(t * 4 + ph)) * 10 * sc * amp];
            }
            case "waltz":
            case "jitterbug": {
              const pair = Math.floor(i / 2);
              const side = i % 2;
              const pairs = Math.ceil(k / 2);
              const centre: [number, number] =
                pair === 0
                  ? [cx, cy]
                  : [
                      cx + Math.cos((pair / Math.max(1, pairs - 1)) * Math.PI * 2 + (style === "waltz" ? t * 0.22 * amp : 0)) * F * 0.3 * (w > h ? 1.3 : 1),
                      cy + Math.sin((pair / Math.max(1, pairs - 1)) * Math.PI * 2 + (style === "waltz" ? t * 0.22 * amp : 0)) * F * 0.3,
                    ];
              if (style === "waltz") {
                const spin = t * 2.2 * amp + 0.35 * Math.sin(t * 6.6) * amp + side * Math.PI + pair;
                return [centre[0] + Math.cos(spin) * 16 * sc, centre[1] + Math.sin(spin) * 16 * sc];
              }
              if (side === 0) return centre;
              const reach = (22 + (1 + Math.sin(t * 3 + pair)) * 22 * amp) * sc;
              const a = t * 3 * amp + pair * 1.7;
              return [centre[0] + Math.cos(a) * reach, centre[1] + Math.sin(a) * reach];
            }
            case "sockhop": {
              const row = i % 2;
              const slot = Math.floor(i / 2);
              const n = Math.ceil(k / 2);
              const order = slot % 2 ? -Math.ceil(slot / 2) : Math.ceil(slot / 2);
              const gap = Math.min((w - 60) / Math.max(1, n), 90 * sc);
              const step = Math.sin(t * 3) * 14 * sc * amp * (row ? -1 : 1);
              return [cx + order * gap, cy + (row ? 1 : -1) * F * 0.16 + step];
            }
            case "twist": {
              const [x, y] = spiral();
              return [x + Math.sin(t * 7 + ph) * 3 * amp, y + Math.sin(t * 0.9 + ph) * 6 * sc * amp];
            }
            case "disco": {
              const tile = F / 8;
              const [sx, sy] = spiral();
              const beat = Math.floor(t * 2 * amp + ph * 3);
              const dx = Math.round(hash(beat + i * 9) * 2 - 1);
              const dy = Math.round(hash(beat * 3 + i) * 2 - 1);
              const gx = Math.round((sx - cx) / tile) + dx;
              const gy = Math.round((sy - cy) / tile) + dy;
              return [cx + gx * tile, cy + gy * tile];
            }
            case "cypher": {
              if (i === 0) return [cx, cy];
              const a = ((i - 1) / Math.max(1, k - 1)) * Math.PI * 2 - Math.PI / 2;
              const radius = F * 0.3 + Math.sin(t * 4 + ph) * 4 * amp;
              return [cx + Math.cos(a) * radius * (w > h ? 1.25 : 1), cy + Math.sin(a) * radius];
            }
            case "mosh": {
              const wander = F * 0.12 * (0.3 + i / k);
              return [cx + Math.cos(t * 0.7 + ph * 5) * wander * amp, cy + Math.sin(t * 0.9 + ph * 3) * wander * amp];
            }
            case "indie": {
              const per = Math.max(3, Math.round(Math.sqrt(k * (w / h))));
              const row = Math.floor(i / per);
              const col = i % per;
              const gap = 40 * sc;
              const x = cx + (col - (per - 1) / 2) * gap + (row % 2) * gap * 0.5;
              const y = cy + (row - (Math.ceil(k / per) - 1) / 2) * gap * 0.9;
              return [x + Math.sin(t * 1.3 + ph) * 4 * amp, y - Math.abs(Math.sin(t * 5 + ph * 0.2)) * 9 * sc * amp];
            }
            case "festival": {
              const per = Math.max(3, Math.floor((w - 40) / (54 * sc)));
              const row = Math.floor(i / per);
              const col = i % per;
              const rowCount = Math.min(per, k - row * per);
              const gap = Math.min((w - 40) / Math.max(1, rowCount), 70 * sc);
              const jump = Math.max(0, Math.sin(t * 4 + row * 0.6)) ** 6 * 12 * sc * amp;
              return [cx + (col - (rowCount - 1) / 2) * gap + Math.sin(t * 1.4 + ph) * 3 * amp, h * 0.36 + row * 58 * sc - jump];
            }
            case "phones": {
              const col = i % cols;
              const row = Math.floor(i / cols);
              return [12 + cellW * (col + 0.5), phoneTop + cellH * (row + 0.5)];
            }
          }
        };

        // Move everyone.
        const wallSpots = (j: number, m: number): [number, number] => {
          const inset = 22;
          const pw = w - inset * 2;
          const ph = h - inset * 2 - 40;
          const perimeter = pw + ph * 2;
          let s = ((j + 0.5) / Math.max(1, m)) * perimeter;
          if (s < ph) return [inset, inset + 40 + s];
          s -= ph;
          if (s < pw) return [inset + s, h - inset];
          s -= pw;
          return [w - inset, h - inset - s];
        };
        active.forEach((d, i) => {
          const [tx, ty] = targetOf(d, i);
          const size = style === "phones" ? Math.min(cellW, cellH) * 0.16 : (10 + d.presence * 11 + ((k - i) / k) * 8) * sc * (style === "sockhop" && w < 520 ? 0.72 : 1);
          d.r += (size - d.r) * Math.min(1, dt * 4);
          if (d.fresh) Object.assign(d, { x: tx, y: ty, r: size, fade: 1, fresh: false });
          if (d !== grabbed) {
            const rate = style === "mosh" ? 1.6 : 5;
            d.x += (tx - d.x) * Math.min(1, dt * rate);
            d.y += (ty - d.y) * Math.min(1, dt * rate);
          }
          if (style === "mosh" && motion && d !== grabbed) {
            d.vx += (Math.random() - 0.5) * 90 * dt * sc;
            d.vy += (Math.random() - 0.5) * 90 * dt * sc;
          }
        });
        walls.forEach((d, j) => {
          const [tx, ty] = wallSpots(j, walls.length);
          d.r += (6 * sc - d.r) * Math.min(1, dt * 4);
          if (d.fresh) Object.assign(d, { x: tx, y: ty, r: 6 * sc, fade: 1, fresh: false });
          if (d !== grabbed) {
            d.x += (tx + Math.sin(t * 0.8 + d.phase) * 2 * amp - d.x) * Math.min(1, dt * 2.5);
            d.y += (ty - d.y) * Math.min(1, dt * 2.5);
          }
        });
        for (const d of all) {
          d.fade = clamp(d.fade + (d.leaving ? -dt * 1.5 : dt * 2), 0, 1);
          if (d.leaving) {
            const dx = d.x - cx;
            const dy = d.y - cy;
            const len = Math.hypot(dx, dy) || 1;
            d.x += (dx / len) * 120 * dt;
            d.y += (dy / len) * 120 * dt;
            if (d.fade <= 0) dancers.delete(d.trend.id);
          }
          if (d === grabbed) continue;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.vx *= Math.pow(0.04, dt);
          d.vy *= Math.pow(0.04, dt);
          if (d.x < d.r) (d.x = d.r), (d.vx = Math.abs(d.vx) * 0.6);
          if (d.x > w - d.r) (d.x = w - d.r), (d.vx = -Math.abs(d.vx) * 0.6);
          if (d.y < d.r) (d.y = d.r), (d.vy = Math.abs(d.vy) * 0.6);
          if (d.y > h - d.r) (d.y = h - d.r), (d.vy = -Math.abs(d.vy) * 0.6);
        }
        if (grabbed) {
          grabbed.x = pointer.x;
          grabbed.y = pointer.y;
        }
        if (style !== "phones") {
          const margin = style === "sockhop" ? 14 * sc : 2;
          const list = all.filter((d) => !d.leaving);
          for (let pass = 0; pass < 2; pass++)
            for (let i = 0; i < list.length; i++)
              for (let j = i + 1; j < list.length; j++) {
                const a = list[i];
                const b = list[j];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const dist = Math.hypot(dx, dy) || 0.01;
                const min = a.r + b.r + margin;
                if (dist < min) {
                  const push = (min - dist) / 2;
                  const nx = dx / dist;
                  const ny = dy / dist;
                  if (a !== grabbed) (a.x -= nx * push), (a.y -= ny * push);
                  if (b !== grabbed) (b.x += nx * push), (b.y += ny * push);
                  if (style === "mosh" || a === grabbed || b === grabbed) {
                    const kick = 60 * sc;
                    if (a !== grabbed) (a.vx -= nx * kick), (a.vy -= ny * kick);
                    if (b !== grabbed) (b.vx += nx * kick), (b.vy += ny * kick);
                  }
                }
              }
        }

        // Backdrop.
        g.fillStyle = night;
        g.fillRect(0, 0, w, h);
        if (style === "disco") {
          const tile = F / 8;
          const beat = Math.floor(t * 2 * amp);
          for (let gx = -Math.ceil(cx / tile) - 1; gx <= Math.ceil(cx / tile) + 1; gx++)
            for (let gy = -Math.ceil(cy / tile) - 1; gy <= Math.ceil((h - cy) / tile) + 1; gy++) {
              const lit = hash(gx * 31 + gy * 17 + beat * 7) > 0.7;
              const choices = [yearColour, colours.clothes, colours.scenes, colours.kit, colours.face];
              g.fillStyle = lit ? alpha(choices[Math.floor(hash(gx * 5 + gy * 11 + beat) * choices.length)], 0.2) : alpha(ink, 0.03);
              g.fillRect(cx + gx * tile - tile / 2 + 1.5, cy + gy * tile - tile / 2 + 1.5, tile - 3, tile - 3);
            }
        }
        if (style === "festival") {
          g.fillStyle = panel;
          g.fillRect(w * 0.12, 64, w * 0.76, 18);
          for (let b = 0; b < 6; b++) {
            const bx = w * 0.15 + (b / 5) * w * 0.7;
            const swing = Math.sin(t * 1.2 * amp + b) * 0.5;
            const beam = g.createLinearGradient(bx, 82, bx + swing * h * 0.5, h);
            beam.addColorStop(0, alpha(b % 2 ? yearColour : ink, 0.22));
            beam.addColorStop(1, alpha(ink, 0));
            g.fillStyle = beam;
            g.beginPath();
            g.moveTo(bx - 4, 82);
            g.lineTo(bx + swing * h * 0.5 - 50, h);
            g.lineTo(bx + swing * h * 0.5 + 50, h);
            g.lineTo(bx + 4, 82);
            g.fill();
          }
        }
        g.font = FONT.display(Math.min(w * 0.34, h * 0.55), 700);
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = alpha(yearColour, 0.22);
        g.fillText(String(Math.floor(year)), cx, cy);
        const glow = g.createRadialGradient(cx, cy, 0, cx, cy, F * 0.55);
        glow.addColorStop(0, alpha(yearColour, 0.14));
        glow.addColorStop(1, alpha(yearColour, 0));
        g.fillStyle = glow;
        g.fillRect(0, 0, w, h);
        if (style === "indie") {
          g.fillStyle = alpha(night, 0.35);
          g.fillRect(0, 0, w, h);
          const sx = cx + Math.sin(t * 0.6 * amp) * w * 0.3;
          const spot = g.createRadialGradient(sx, cy, 0, sx, cy, F * 0.3);
          spot.addColorStop(0, alpha(ink, 0.1));
          spot.addColorStop(1, alpha(ink, 0));
          g.fillStyle = spot;
          g.fillRect(0, 0, w, h);
        }

        // Dancers.
        const placed: [number, number, number, number][] = [];
        const label = (text: string, x: number, y: number, size = 11, colour = ink) => {
          g.font = FONT.body(size, 600);
          g.textAlign = "center";
          g.textBaseline = "top";
          const short = text.length > 20 ? `${text.slice(0, 19)}…` : text;
          const tw = g.measureText(short).width;
          const lx = clamp(x, tw / 2 + 4, w - tw / 2 - 4);
          const box: [number, number, number, number] = [lx - tw / 2 - 2, y - 1, lx + tw / 2 + 2, y + size + 2];
          if (placed.some((p) => box[0] < p[2] && box[2] > p[0] && box[1] < p[3] && box[3] > p[1])) return;
          placed.push(box);
          g.lineWidth = 3;
          g.strokeStyle = night;
          g.strokeText(short, lx, y);
          g.fillStyle = colour;
          g.fillText(short, lx, y);
        };
        const order = [...walls, ...active.slice().reverse(), ...all.filter((d) => d.leaving)];
        for (const d of order) {
          const i = active.indexOf(d);
          g.globalAlpha = d.fade * (d.wall || d.leaving ? 0.5 : 1);
          if (style === "phones" && i >= 0) {
            const pw = Math.min(cellW * 0.62, cellH * 0.52);
            const phH = pw * 1.75;
            const px = d.x - pw / 2;
            const py = d.y - phH / 2 - 6;
            g.fillStyle = panel;
            g.strokeStyle = alpha(ink, 0.35);
            g.lineWidth = 1.5;
            g.beginPath();
            g.roundRect(px, py, pw, phH, 8);
            g.fill();
            g.stroke();
            g.fillStyle = alpha(d.colour, 0.12);
            g.fillRect(px + 3, py + 8, pw - 6, phH - 16);
          }
          let x = d.x;
          let y = d.y;
          let sx = 1;
          if (style === "phones" && i >= 0) {
            const move = i % 4;
            const beat = t * 4 * amp + d.phase;
            if (move === 0) y -= Math.abs(Math.sin(beat)) * d.r * 0.9;
            if (move === 1) x += Math.sin(beat * 0.7) * d.r * 0.9;
            if (move === 2) sx = Math.cos(beat * 0.8);
            if (move === 3) {
              g.strokeStyle = d.colour;
              g.lineWidth = 2;
              g.beginPath();
              g.moveTo(x + d.r * 0.7, y - d.r * 0.2);
              g.lineTo(x + d.r * 1.6, y - d.r * (1.2 + Math.sin(beat * 1.5) * 0.6));
              g.stroke();
            }
          }
          if (style === "twist" && i >= 0) sx = 0.6 + 0.4 * Math.abs(Math.cos(t * 6 * amp + d.phase));
          if (style === "cypher" && i === 0) {
            g.strokeStyle = alpha(d.colour, 0.6);
            g.lineWidth = 2;
            for (let a = 0; a < 3; a++) {
              const start = t * 7 * amp + (a * Math.PI * 2) / 3;
              g.beginPath();
              g.arc(x, y, d.r + 8 + a * 4, start, start + 1.2);
              g.stroke();
            }
            sx = Math.cos(t * 9 * amp);
          }
          if (style === "charleston" && i >= 0) {
            g.strokeStyle = alpha(d.colour, 0.8);
            g.lineWidth = 2;
            const kick = Math.sin(t * 8 * amp + d.phase) * 0.7;
            for (const side of [-1, 1]) {
              const a = Math.PI / 2 + side * (0.35 + side * kick);
              g.beginPath();
              g.moveTo(x, y + d.r * 0.8);
              g.lineTo(x + Math.cos(a) * d.r * 1.5, y + d.r * 0.8 + Math.sin(a) * d.r * 1.5);
              g.stroke();
            }
          }
          if (style === "disco" && i >= 0 && Math.floor(t * 2 * amp + d.phase) % 2) {
            g.strokeStyle = d.colour;
            g.lineWidth = 2;
            g.beginPath();
            g.moveTo(x + d.r * 0.6, y - d.r * 0.6);
            g.lineTo(x + d.r * 1.6, y - d.r * 1.8);
            g.stroke();
          }
          if (style === "festival" && i >= 0) {
            const lx = x + Math.sin(t * 1.5 * amp + d.phase) * d.r * 0.6;
            const ly = y - d.r * 2.1;
            const halo = g.createRadialGradient(lx, ly, 0, lx, ly, d.r * 1.4);
            halo.addColorStop(0, alpha(ink, 0.45));
            halo.addColorStop(1, alpha(ink, 0));
            g.fillStyle = halo;
            g.fillRect(lx - d.r * 1.5, ly - d.r * 1.5, d.r * 3, d.r * 3);
            g.fillStyle = ink;
            g.fillRect(lx - 2.5, ly - 4, 5, 8);
          }
          g.save();
          g.translate(x, y);
          g.scale(Math.max(0.08, Math.abs(sx)), 1);
          const body = g.createRadialGradient(-d.r * 0.35, -d.r * 0.4, d.r * 0.1, 0, 0, d.r);
          body.addColorStop(0, alpha(ink, 0.9));
          body.addColorStop(0.35, d.colour);
          body.addColorStop(1, d.colour);
          g.fillStyle = body;
          g.beginPath();
          g.arc(0, 0, d.r, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = alpha(ink, d === grabbed ? 0.9 : 0.2);
          g.lineWidth = d === grabbed ? 2 : 1;
          g.stroke();
          g.restore();
          g.globalAlpha = d.fade;
          if (style === "phones" && i >= 0) {
            const pw = Math.min(cellW * 0.62, cellH * 0.52);
            label(d.trend.name, d.x, d.y + pw * 0.875 - 2, w < 520 ? 10 : 11);
          } else if (i >= 0 && i < (w < 520 ? 6 : 8)) label(d.trend.name, x, style === "sockhop" && i % 2 === 0 ? y - d.r - 16 : y + d.r + 4, w < 520 ? 10 : 11);
          g.globalAlpha = 1;
        }

        // Heads-up: year and dance.
        g.textAlign = "left";
        g.textBaseline = "alphabetic";
        g.fillStyle = ink;
        g.font = FONT.display(w < 520 ? 20 : 26, 600, true);
        g.fillText(name, 14, 32);
        g.font = FONT.mono(w < 520 ? 9 : 10);
        g.fillStyle = muted;
        g.fillText(`${Math.floor(year)} · ${note}`.slice(0, Math.floor((w - 28) / (w < 520 ? 5.6 : 6.2))), 14, 50);
        g.textAlign = "right";
        g.fillStyle = playing ? muted : pink;
        if (w >= 520) g.fillText(playing ? "tap the floor to pause" : "paused · tap the floor to play", w - 14, 22);
        if (walls.length && style !== "phones") {
          g.textAlign = "right";
          g.fillStyle = muted;
          g.fillText("wallflowers on the edge", w - 14, h - 10);
        }
        const span = NOW_YEAR - FIRST_YEAR + 1;
        g.fillStyle = alpha(ink, 0.08);
        g.fillRect(14, h - 4, w - 28, 2);
        g.fillStyle = pink;
        g.fillRect(14, h - 4, ((year - FIRST_YEAR) / span) * (w - 28), 2);
        syncControls();
      },
    });

    // Grab, fling and tap.
    const canvas = scene.canvas;
    const hit = (x: number, y: number) =>
      [...dancers.values()]
        .filter((d) => !d.leaving)
        .sort((a, b) => Math.hypot(a.x - x, a.y - y) - a.r - (Math.hypot(b.x - x, b.y - y) - b.r))
        .find((d) => Math.hypot(d.x - x, d.y - y) < d.r + 10);
    canvas.addEventListener("pointerdown", (event) => {
      const { x, y } = scene.pointer;
      downAt = { x, y };
      grabbed = hit(x, y) ?? null;
      if (grabbed) {
        grabTrail = [{ x, y, t: performance.now() }];
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch {
          // Capture is a nicety.
        }
      }
    });
    canvas.addEventListener("pointermove", () => {
      if (!grabbed) return;
      grabTrail.push({ x: scene.pointer.x, y: scene.pointer.y, t: performance.now() });
      if (grabTrail.length > 6) grabTrail.shift();
    });
    canvas.addEventListener(
      "touchmove",
      (event) => {
        if (grabbed) event.preventDefault();
      },
      { passive: false },
    );
    const release = () => {
      if (!downAt) return;
      const moved = Math.hypot(scene.pointer.x - downAt.x, scene.pointer.y - downAt.y);
      if (grabbed) {
        if (moved < 6) showCaption(grabbed.trend);
        else if (grabTrail.length > 1) {
          const a = grabTrail[0];
          const b = grabTrail[grabTrail.length - 1];
          const s = Math.max(0.016, (b.t - a.t) / 1000);
          grabbed.vx = clamp((b.x - a.x) / s, -1600, 1600);
          grabbed.vy = clamp((b.y - a.y) / s, -1600, 1600);
        }
      } else if (moved < 6 && motion) {
        playing = !playing;
        syncControls();
      }
      grabbed = null;
      downAt = null;
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);

    // Controls below the floor.
    const controls = document.createElement("div");
    controls.className = "flex flex-wrap items-center gap-3";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "rounded-full border border-nof-line bg-nof-panel px-4 py-2 font-nof-body text-sm font-semibold text-nof-text hover:border-nof-pink";
    play.addEventListener("click", () => {
      playing = !playing && motion;
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
      year = Number(slider.value);
    });
    slider.addEventListener("change", () => context.setParam("year", slider.value));
    const yearOut = document.createElement("span");
    yearOut.className = "w-12 font-nof-display text-xl font-bold text-nof-text tabular-nums";
    if (motion) controls.append(play);
    controls.append(slider, yearOut);
    wrapper.append(controls);

    if (context.born && !context.compact) {
      const chips = document.createElement("div");
      chips.className = "flex flex-wrap gap-2";
      for (const m of nerds.milestones(context.born)) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "rounded-full border border-nof-line px-3 py-1.5 font-nof-body text-xs text-nof-sub hover:border-nof-pink hover:text-nof-text";
        chip.textContent = `${m.label} · ${m.year}`;
        chip.addEventListener("click", () => {
          playing = false;
          year = m.year;
          context.setParam("year", String(m.year));
          syncControls();
        });
        chips.append(chip);
      }
      wrapper.append(chips);
    }

    const caption = document.createElement("p");
    caption.className = "min-h-10 font-nof-body text-sm text-nof-sub";
    caption.setAttribute("aria-live", "polite");
    wrapper.append(caption);
    function showCaption(trend?: Trend) {
      caption.replaceChildren();
      if (!trend) {
        caption.textContent = "Tap a dancer to find out who it is. Colour is the family: clothes, scenes, shoes and accessories, or hair and make-up.";
        return;
      }
      const name = document.createElement("strong");
      name.className = "font-semibold text-nof-text";
      name.textContent = trend.name;
      caption.append(name, `. ${trend.description} `, `(${FAMILIES[familyOf(trend.category)].label.toLowerCase()})`);
    }
    showCaption();

    let lastLabel = "";
    function syncControls() {
      const text = playing ? "Pause" : "Play";
      if (text !== lastLabel) {
        play.textContent = text;
        lastLabel = text;
      }
      const rounded = String(Math.floor(year));
      if (slider.value !== rounded && document.activeElement !== slider) slider.value = rounded;
      if (yearOut.textContent !== rounded) yearOut.textContent = rounded;
    }
    syncControls();

    return {
      update(params) {
        const next = Number(params.year);
        if (params.year && Number.isFinite(next)) {
          year = clamp(next, FIRST_YEAR, NOW_YEAR);
          playing = false;
          syncControls();
        }
      },
      destroy() {
        scene.destroy();
        wrapper.remove();
      },
    };
  },
};

export default view;
