import { describe, expect, it } from "vitest";

import { sampleDocument } from "../domain/home-content.fixture";
import {
  HomeContentUnavailableError,
  loadHomeContent,
  type HomeApplicationRuntime,
  type HomeProbe,
} from "./load-home-content";

function runtimeWith(fetchDocument: (signal: AbortSignal) => Promise<unknown>) {
  const probes: HomeProbe[] = [];
  const runtime: HomeApplicationRuntime = {
    clock: { nowIso: () => "2026-09-30T09:00:00.000Z" },
    ids: { nextCorrelationId: () => "correlation-1" },
    probes: { publish: (probe) => probes.push(probe) },
    source: { fetchDocument },
  };
  return { probes, runtime };
}

function terminal(probes: readonly HomeProbe[]) {
  const completed = probes.filter(
    (probe) => probe.name === "home.content.load.completed",
  );
  expect(completed).toHaveLength(1);
  const [probe] = completed;
  if (!probe) {
    throw new Error("missing terminal probe");
  }
  return probe;
}

describe("loadHomeContent", () => {
  it("returns validated content and reports success once", async () => {
    const { probes, runtime } = runtimeWith(() =>
      Promise.resolve(sampleDocument()),
    );

    const content = await loadHomeContent(
      runtime,
      new AbortController().signal,
    );

    expect(content.instances).toHaveLength(2);
    expect(probes[0]?.name).toBe("home.content.load.started");
    expect(terminal(probes).fields).toEqual({
      failureReason: null,
      incidentCount: 1,
      instanceCount: 2,
      outcome: "succeeded",
    });
    expect(
      probes.every((p) => p.context.correlationId === "correlation-1"),
    ).toBe(true);
  });

  it("rejects invalid content whole", async () => {
    const { probes, runtime } = runtimeWith(() =>
      Promise.resolve({ schemaVersion: 1 }),
    );

    await expect(
      loadHomeContent(runtime, new AbortController().signal),
    ).rejects.toMatchObject({ reason: "invalid-content" });
    expect(terminal(probes).fields).toMatchObject({
      failureReason: "invalid-content",
      outcome: "failed",
    });
  });

  it("reports an unavailable source as a failure", async () => {
    const { probes, runtime } = runtimeWith(() =>
      Promise.reject(new Error("HTTP 503")),
    );

    const failure = loadHomeContent(runtime, new AbortController().signal);

    await expect(failure).rejects.toBeInstanceOf(HomeContentUnavailableError);
    await expect(failure).rejects.toMatchObject({ reason: "unavailable" });
    expect(terminal(probes).fields.outcome).toBe("failed");
  });

  it("reports cancellation without calling it a failure", async () => {
    const controller = new AbortController();
    const abortError = new DOMException("aborted", "AbortError");
    const { probes, runtime } = runtimeWith(() => {
      controller.abort();
      return Promise.reject(abortError);
    });

    await expect(loadHomeContent(runtime, controller.signal)).rejects.toBe(
      abortError,
    );
    expect(terminal(probes).fields).toMatchObject({
      failureReason: null,
      outcome: "cancelled",
    });
  });
});
