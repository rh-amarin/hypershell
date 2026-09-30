import type {
  DomainProbe,
  DomainProbeContext,
  DomainProbePublisher,
} from "@openshift-online/hypershell-domain-probes";

import { validateHomeContent, type HomeContent } from "../domain/home-content";

/** Where the home page content document comes from. */
export interface HomeContentSource {
  /** Resolves the raw, unvalidated document; rejects on transport failure. */
  fetchDocument(signal: AbortSignal): Promise<unknown>;
}

export interface HomeClock {
  nowIso(): string;
}

export interface HomeInvocationIds {
  nextCorrelationId(): string;
}

export type HomeContentLoadOutcome = "cancelled" | "failed" | "succeeded";

export type HomeContentFailureReason = "invalid-content" | "unavailable";

export type HomeProbe =
  | DomainProbe<"home.content.load.started", 1, Readonly<{ source: "static" }>>
  | DomainProbe<
      "home.content.load.completed",
      1,
      Readonly<{
        failureReason: HomeContentFailureReason | null;
        incidentCount: number | null;
        instanceCount: number | null;
        outcome: HomeContentLoadOutcome;
      }>
    >;

export interface HomeApplicationRuntime {
  readonly clock: HomeClock;
  readonly ids: HomeInvocationIds;
  readonly probes: DomainProbePublisher<HomeProbe>;
  readonly source: HomeContentSource;
}

/** Raised when content cannot be shown; the reason is safe to present. */
export class HomeContentUnavailableError extends Error {
  readonly reason: HomeContentFailureReason;

  constructor(reason: HomeContentFailureReason) {
    super(`Home page content ${reason}`);
    this.name = "HomeContentUnavailableError";
    this.reason = reason;
  }
}

function isAbort(error: unknown, signal: AbortSignal): boolean {
  return (
    signal.aborted || (error instanceof Error && error.name === "AbortError")
  );
}

/**
 * Loads and validates the home page content document. Publishes one started
 * probe and exactly one terminal probe per invocation.
 */
export async function loadHomeContent(
  runtime: HomeApplicationRuntime,
  signal: AbortSignal,
): Promise<HomeContent> {
  const context: DomainProbeContext = {
    correlationId: runtime.ids.nextCorrelationId(),
  };
  runtime.probes.publish({
    context,
    fields: { source: "static" },
    name: "home.content.load.started",
    occurredAt: runtime.clock.nowIso(),
    schemaVersion: 1,
  });

  const complete = (
    outcome: HomeContentLoadOutcome,
    failureReason: HomeContentFailureReason | null,
    content: HomeContent | null,
  ) => {
    runtime.probes.publish({
      context,
      fields: {
        failureReason,
        incidentCount: content?.incidents.length ?? null,
        instanceCount: content?.instances.length ?? null,
        outcome,
      },
      name: "home.content.load.completed",
      occurredAt: runtime.clock.nowIso(),
      schemaVersion: 1,
    });
  };

  let document: unknown;
  try {
    document = await runtime.source.fetchDocument(signal);
  } catch (error) {
    if (isAbort(error, signal)) {
      complete("cancelled", null, null);
      throw error;
    }
    complete("failed", "unavailable", null);
    throw new HomeContentUnavailableError("unavailable");
  }

  const result = validateHomeContent(document);
  if (!result.ok) {
    complete("failed", "invalid-content", null);
    throw new HomeContentUnavailableError("invalid-content");
  }

  complete("succeeded", null, result.content);
  return result.content;
}
