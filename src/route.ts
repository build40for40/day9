import { inject, type InjectionKey, type Ref } from "vue";
import { FIRST_YEAR, NOW_YEAR } from "./data";

export const BORN_KEY = "nof-born";

export interface RouteApi {
  params: Ref<Record<string, string>>;
  go(next: Record<string, string | null>, push?: boolean): void;
  born: Ref<number | null>;
  setBorn(year: number | null): void;
}

export const routeKey: InjectionKey<RouteApi> = Symbol("route");
export const useRoute = () => inject(routeKey)!;

export const validBorn = (value: unknown) => {
  const year = Number(value);
  return Number.isInteger(year) && year >= FIRST_YEAR && year <= NOW_YEAR ? year : null;
};

/** A shared card link (?born=1988) wins for that visit; otherwise what this browser remembers. */
export function readBorn() {
  const fromLink = validBorn(new URLSearchParams(location.search).get("born"));
  if (fromLink) return fromLink;
  try {
    return validBorn(localStorage.getItem(BORN_KEY));
  } catch {
    return null;
  }
}
