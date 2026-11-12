// A sharp, resizing canvas with a frame loop that only runs while it's on screen.

export interface Frame {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  /** Seconds since the stage started. */
  time: number;
  /** Seconds since the last frame, capped so a background tab doesn't explode the physics. */
  dt: number;
}

export interface Pointer {
  x: number;
  y: number;
  down: boolean;
  inside: boolean;
}

export interface Stage {
  canvas: HTMLCanvasElement;
  pointer: Pointer;
  width: number;
  height: number;
  /** Draw once now, even if not animating. */
  draw(): void;
  destroy(): void;
}

export const reducedMotion = () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Make a canvas that fills `el`. `height` is a CSS height such as "min(72vh, 640px)".
 * `render` runs every frame while visible when `animate` is true, else on resize and draw().
 */
export function stage(el: HTMLElement, options: { height: string; animate?: boolean; label: string; render(frame: Frame, pointer: Pointer): void }): Stage {
  const canvas = document.createElement("canvas");
  canvas.className = "block w-full touch-pan-y select-none";
  canvas.style.height = options.height;
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", options.label);
  el.append(canvas);
  const ctx = canvas.getContext("2d")!;
  const pointer: Pointer = { x: -1, y: -1, down: false, inside: false };
  let width = 0;
  let height = 0;
  let visible = false;
  let raf = 0;
  let last = performance.now();
  const started = last;

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    api.width = width;
    api.height = height;
    paint(performance.now());
  };

  const paint = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!width || !height) return;
    ctx.save();
    options.render({ ctx, width, height, time: (now - started) / 1000, dt }, pointer);
    ctx.restore();
  };

  const loop = (now: number) => {
    paint(now);
    raf = visible && options.animate ? requestAnimationFrame(loop) : 0;
  };

  const local = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
  };
  const onMove = (event: PointerEvent) => {
    local(event);
    pointer.inside = true;
    if (!options.animate) paint(performance.now());
  };
  const onDown = (event: PointerEvent) => {
    local(event);
    pointer.down = true;
    pointer.inside = true;
    if (!options.animate) paint(performance.now());
  };
  const onUp = () => {
    pointer.down = false;
    if (!options.animate) paint(performance.now());
  };
  const onLeave = (event: PointerEvent) => {
    if (event.pointerType === "mouse") pointer.inside = false;
    pointer.down = false;
    if (!options.animate) paint(performance.now());
  };
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerdown", onDown);
  addEventListener("pointerup", onUp);
  canvas.addEventListener("pointerleave", onLeave);

  const resizer = new ResizeObserver(resize);
  resizer.observe(canvas);
  const watcher = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && options.animate && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(loop);
    }
  });
  watcher.observe(canvas);
  document.fonts?.ready.then(() => paint(performance.now()));

  const api: Stage = {
    canvas,
    pointer,
    width,
    height,
    draw: () => paint(performance.now()),
    destroy() {
      cancelAnimationFrame(raf);
      resizer.disconnect();
      watcher.disconnect();
      removeEventListener("pointerup", onUp);
      canvas.remove();
    },
  };
  return api;
}

/** Fonts for canvas text, matching the theme. */
export const FONT = {
  display: (size: number, weight = 700, italic = false) => `${italic ? "italic " : ""}${weight} ${size}px "Bodoni Moda", Didot, Georgia, serif`,
  body: (size: number, weight = 500) => `${weight} ${size}px "Instrument Sans", system-ui, sans-serif`,
  mono: (size: number, weight = 500) => `${weight} ${size}px "JetBrains Mono", ui-monospace, monospace`,
};
