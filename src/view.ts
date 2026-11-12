// The contract every visualisation follows. A view is a plain module in src/nerds/views/
// whose default export is a View. The registry finds them by themselves, so adding a view
// never means editing a shared file.

import type { Nerds } from "./data";

export type Tab = "trends" | "shapes" | "comebacks" | "colour" | "world" | "museums" | "words";

export interface ViewContext {
  nerds: Nerds;
  /** The reader's birth year, if they told us. Only ever kept in their browser. */
  born: number | null;
  /** The view's own state from the URL, such as `year` or `trend`. */
  params: Record<string, string>;
  /** Write view state back to the URL so it can be shared. */
  setParam(key: string, value: string | null): void;
  /** Story mode: smaller, fewer controls, and driven by `params`. */
  compact?: boolean;
}

export interface Mounted {
  destroy(): void;
  /** Called when params change from outside, such as a story step. */
  update?(params: Record<string, string>): void;
}

export interface View {
  id: string;
  tab: Tab;
  title: string;
  /** One line under the title. Informal, funny, no dashes mid-sentence. */
  blurb: string;
  /** How to play with it, shown under the stage. */
  how?: string;
  /** Which sources it reads, by meta.sources id, for the credit line. */
  sources: string[];
  /** Lower comes first in its tab. */
  order?: number;
  mount(el: HTMLElement, context: ViewContext): Mounted;
}
