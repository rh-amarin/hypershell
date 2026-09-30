import type { HomeContentSource } from "../../application/load-home-content";

export class HomeContentHttpError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`Home page content request failed with HTTP ${String(status)}`);
    this.name = "HomeContentHttpError";
    this.status = status;
  }
}

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Reads the content document served next to the page. Retries are owned by
 * the TanStack Query caller, so this adapter makes exactly one request.
 */
export function createHttpHomeContentSource(
  documentUrl: URL,
  fetchImpl: FetchLike,
): HomeContentSource {
  return {
    async fetchDocument(signal) {
      const response = await fetchImpl(documentUrl, {
        cache: "no-store",
        credentials: "omit",
        headers: { accept: "application/json" },
        signal,
      });
      if (!response.ok) {
        throw new HomeContentHttpError(response.status);
      }
      return (await response.json()) as unknown;
    },
  };
}
