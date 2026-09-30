import { describe, expect, it, vi } from "vitest";

import type { HomeProbe } from "../../application/load-home-content";
import { createHomeObservability } from "./home-observability";

const probe = (occurredAt: string): HomeProbe => ({
  context: { correlationId: "c" },
  fields: { source: "static" },
  name: "home.content.load.started",
  occurredAt,
  schemaVersion: 1,
});

describe("createHomeObservability", () => {
  it("fans each probe out to the recorder and to performance marks", () => {
    const mark = vi.fn();
    const observability = createHomeObservability({ mark });

    observability.publisher.publish(probe("t1"));

    expect(observability.recent()).toHaveLength(1);
    expect(mark).toHaveBeenCalledWith("home.content.load.started");
  });

  it("keeps only the most recent probes", () => {
    const observability = createHomeObservability({ recentLimit: 2 });

    for (const time of ["t1", "t2", "t3"]) {
      observability.publisher.publish(probe(time));
    }

    expect(observability.recent().map((p) => p.occurredAt)).toEqual([
      "t2",
      "t3",
    ]);
  });

  it("isolates a failing sink and records the failure", () => {
    const observability = createHomeObservability({
      mark: () => {
        throw new TypeError("marks unavailable");
      },
      recentLimit: 1,
    });

    observability.publisher.publish(probe("t1"));
    observability.publisher.publish(probe("t2"));

    expect(observability.recent()).toHaveLength(1);
    expect(observability.deliveryFailures()).toEqual([
      expect.objectContaining({
        errorType: "TypeError",
        sinkId: "performance",
      }),
    ]);
  });
});
