// The hero: a curtain of 107 stripes, one per year from 1920 to 2026, each dyed that
// year's colour, swaying and rippling where the pointer passes.

import { FIRST_YEAR, NOW_YEAR, token, type Nerds } from "./data";
import { FONT, reducedMotion, stage } from "./stage";

const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
};

export function curtain(el: HTMLElement, nerds: Nerds, height: string) {
  const count = NOW_YEAR - FIRST_YEAR + 1;
  const colours = Array.from({ length: count }, (_, k) => nerds.colour(FIRST_YEAR + k));
  const still = reducedMotion();
  const night = token("--color-nof-night", "#0e0d12");
  let t = 0;
  return stage(el, {
    height,
    animate: !still,
    label: "A curtain of 107 stripes, one for each year from 1920 to 2026, dyed in that year's colour",
    render({ ctx, width: w, height: h, dt }, pointer) {
      t += still ? 0 : dt;
      ctx.fillStyle = night;
      ctx.fillRect(0, 0, w, h);
      const sw = w / count;
      let hovered = -1;
      for (let k = 0; k < count; k++) {
        const x = k * sw;
        const hex = colours[k];
        const near = pointer.inside ? Math.exp(-(((x - pointer.x) / 90) ** 2)) : 0;
        if (pointer.inside && pointer.x >= x && pointer.x < x + sw) hovered = k;
        const sway = Math.sin(t * 1.3 + k * 0.17) * h * 0.035 + Math.sin(t * 0.6 + k * 0.05) * h * 0.03 + near * Math.sin(t * 7 + k * 0.6) * 26;
        const bottom = h * 0.9 + sway;
        const fill = ctx.createLinearGradient(0, 0, 0, bottom);
        fill.addColorStop(0, hex);
        fill.addColorStop(0.75, hex);
        fill.addColorStop(1, rgba(hex, 0));
        ctx.fillStyle = fill;
        const skew = Math.sin(t * 1.1 + k * 0.21) * 6 + near * 14;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + sw + 0.6, 0);
        ctx.lineTo(x + sw + 0.6 + skew, bottom);
        ctx.lineTo(x + skew, bottom);
        ctx.closePath();
        ctx.fill();
        // Fold shading.
        ctx.fillStyle = `rgba(0,0,0,${0.18 + 0.18 * Math.sin(t * 1.3 + k * 0.17)})`;
        ctx.fillRect(x, 0, sw * 0.35, bottom * 0.98);
      }
      if (hovered >= 0) {
        const year = FIRST_YEAR + hovered;
        const label = nerds.pantone(year)[0]?.name ?? nerds.decadeColours.get(Math.floor(year / 10) * 10)?.word ?? "";
        ctx.font = FONT.mono(12, 500);
        const text = `${year}${label ? ` · ${label}` : ""}`;
        const tw = ctx.measureText(text).width;
        const lx = Math.min(w - tw - 20, Math.max(8, pointer.x - tw / 2 - 8));
        const ly = Math.min(h - 40, pointer.y + 22);
        ctx.fillStyle = rgba(night, 0.85);
        ctx.fillRect(lx, ly, tw + 16, 24);
        ctx.fillStyle = token("--color-nof-text", "#f2eee6");
        ctx.textBaseline = "middle";
        ctx.fillText(text, lx + 8, ly + 12);
      }
    },
  });
}
