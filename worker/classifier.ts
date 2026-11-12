// Structured decisions only: scores and choices about text, never generated text.
// Instructions can be an object, to carry the item a question is about alongside the question itself.
type Instructions = string | Record<string, unknown>;

export type Question =
  | { type: "score"; instructions: Instructions; criteria: string[] }
  | { type: "choice"; instructions: Instructions; criteria: Record<string, string | null> }
  | { type: "noul"; instructions: Instructions; criteria?: { true: string; false: string } };

export type Answer =
  | { type: "score"; score: number; confidence: number }
  | { type: "choice"; choice: string; confidence: number; probabilities: Record<string, number> }
  | { type: "noul"; noul: number };

export interface Classifier {
  version: string;
  ask(state: unknown, questions: Record<string, Question>, signal?: AbortSignal): Promise<{ model: string; answers: Record<string, Answer> }>;
}

export class ClassifierError extends Error {}

interface JevOptions {
  apiKey: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  retries?: number;
  fetcher?: typeof fetch;
  log?: (body: string) => void;
}

// https://docs.typesafe.ai/api
// Every request body is logged, so `npm run wrangler -- tail` shows exactly what was asked.
export function jevClassifier({ apiKey, baseUrl = "https://api.typesafe.ai", model = "jev-latest", timeoutMs = 2000, retries = 1, fetcher = fetch, log = console.debug }: JevOptions): Classifier {
  return {
    version: model,
    async ask(state, questions, signal) {
      const body = JSON.stringify({ model, state, questions });
      log(body);
      const deadline = Date.now() + timeoutMs;
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        const left = deadline - Date.now();
        if (left <= 0) break;
        try {
          const timeout = AbortSignal.timeout(left);
          const response = await fetcher(new URL("/v1/systemone", baseUrl), {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
            body,
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
          });
          if (response.ok) return (await response.json()) as { model: string; answers: Record<string, Answer> };
          lastError = new ClassifierError(`Classifier answered ${response.status}`);
          if (response.status < 500 && response.status !== 429) break;
        } catch (error) {
          lastError = error;
          if (signal?.aborted) break;
        }
      }
      throw lastError instanceof Error ? lastError : new ClassifierError("Classifier timed out");
    },
  };
}
