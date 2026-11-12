import { clean } from "./query";
import { INTENT_ENDPOINT, MAX_QUERY, SHOW_THRESHOLD, type ComponentScore, type IntentResult } from "./registry";

export class IntentError extends Error {}

interface ResolveOptions {
  signal?: AbortSignal;
  endpoint?: string;
  timeoutMs?: number;
  fetcher?: typeof fetch;
}

export async function resolveIntent(query: string, { signal, endpoint = INTENT_ENDPOINT, timeoutMs = 6000, fetcher = fetch }: ResolveOptions = {}): Promise<IntentResult> {
  const q = clean(query).slice(0, MAX_QUERY);
  if (!q) throw new IntentError("Nothing to search for");
  const timeout = AbortSignal.timeout(timeoutMs);
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ q }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new IntentError(`Intent answered ${response.status}`);
  return (await response.json()) as IntentResult;
}

export interface Picked {
  // Built components the search asked for, best first.
  show: ComponentScore[];
  // Ones it asked for that aren't built yet.
  comingSoon: ComponentScore[];
}

export function pickComponents(result: Pick<IntentResult, "components">, threshold = SHOW_THRESHOLD): Picked {
  const wanted = result.components.filter((c) => c.score >= threshold).toSorted((a, b) => b.score - a.score);
  return { show: wanted.filter((c) => c.available), comingSoon: wanted.filter((c) => !c.available) };
}

// Only the latest search's result is ever delivered. Older ones are cancelled and resolve to null.
export function createIntentResolver({ debounceMs = 0, ...options }: Omit<ResolveOptions, "signal"> & { debounceMs?: number } = {}) {
  let current: AbortController | undefined;
  return {
    async run(query: string): Promise<IntentResult | null> {
      current?.abort();
      const controller = new AbortController();
      current = controller;
      if (debounceMs) await new Promise((resolve) => setTimeout(resolve, debounceMs));
      if (controller.signal.aborted) return null;
      try {
        return await resolveIntent(query, { ...options, signal: controller.signal });
      } catch (error) {
        if (controller.signal.aborted) return null;
        throw error;
      }
    },
    cancel() {
      current?.abort();
    },
  };
}
