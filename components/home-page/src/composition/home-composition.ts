import { createHttpHomeContentSource } from "../adapters/content/http-home-content-source";
import { createHomeObservability } from "../adapters/observability/home-observability";
import type { HomeApplicationRuntime } from "../application/load-home-content";

/** Composition root for the browser: wires every port to its adapter once. */
export function createBrowserHomeRuntime(
  pageUrl: string,
): HomeApplicationRuntime {
  const observability = createHomeObservability({
    mark: (name) => {
      performance.mark(name);
    },
  });
  return {
    clock: { nowIso: () => new Date().toISOString() },
    ids: { nextCorrelationId: () => crypto.randomUUID() },
    probes: observability.publisher,
    source: createHttpHomeContentSource(
      new URL("content/home.json", pageUrl),
      (input, init) => fetch(input, init),
    ),
  };
}
