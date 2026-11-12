import type { View } from "./view";

const modules = import.meta.glob<{ default: View }>("./views/*.ts", { eager: true });

export const VIEWS: View[] = Object.values(modules)
  .map((module) => module.default)
  .filter(Boolean)
  .sort((a, b) => (a.order ?? 50) - (b.order ?? 50) || a.title.localeCompare(b.title));

export const viewById = (id: string) => VIEWS.find((view) => view.id === id);
