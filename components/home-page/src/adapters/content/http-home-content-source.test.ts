import { describe, expect, it, vi } from "vitest";

import {
  HomeContentHttpError,
  createHttpHomeContentSource,
} from "./http-home-content-source";

const documentUrl = new URL("https://home.example.com/content/home.json");

describe("createHttpHomeContentSource", () => {
  it("requests the document once without credentials or caching", async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(Response.json({ schemaVersion: 1 })),
    );
    const source = createHttpHomeContentSource(documentUrl, fetchImpl);
    const signal = new AbortController().signal;

    await expect(source.fetchDocument(signal)).resolves.toEqual({
      schemaVersion: 1,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(documentUrl, {
      cache: "no-store",
      credentials: "omit",
      headers: { accept: "application/json" },
      signal,
    });
  });

  it("turns an HTTP failure into a typed error", async () => {
    const source = createHttpHomeContentSource(documentUrl, () =>
      Promise.resolve(new Response("missing", { status: 404 })),
    );

    const failure = source.fetchDocument(new AbortController().signal);

    await expect(failure).rejects.toBeInstanceOf(HomeContentHttpError);
    await expect(failure).rejects.toMatchObject({ status: 404 });
  });

  it("propagates cancellation from fetch", async () => {
    const abortError = new DOMException("aborted", "AbortError");
    const source = createHttpHomeContentSource(documentUrl, () =>
      Promise.reject(abortError),
    );

    await expect(
      source.fetchDocument(new AbortController().signal),
    ).rejects.toBe(abortError);
  });
});
