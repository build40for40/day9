// A small hover card for SVG charts, positioned inside the chart's box.

export function tip(host: HTMLElement) {
  const el = document.createElement("div");
  el.className = "pointer-events-none absolute z-10 max-w-72 rounded-xl border border-nof-line bg-nof-night/95 px-3 py-2 text-sm text-nof-sub opacity-0 shadow-2xl transition-opacity";
  el.setAttribute("role", "status");
  host.append(el);
  return {
    show(event: PointerEvent, html: string) {
      el.innerHTML = html;
      el.style.opacity = "1";
      const box = host.getBoundingClientRect();
      const x = event.clientX - box.left;
      const y = event.clientY - box.top;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      el.style.left = `${Math.max(8, Math.min(box.width - w - 8, x + 14 > box.width - w - 8 ? x - w - 14 : x + 14))}px`;
      el.style.top = `${Math.max(8, Math.min(box.height - h - 8, y - h - 12 < 8 ? y + 16 : y - h - 12))}px`;
    },
    hide() {
      el.style.opacity = "0";
    },
  };
}

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
